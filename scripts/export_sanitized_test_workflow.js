const { execSync } = require('child_process');
const fs = require('fs');

const DB = '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = 'up1n75qEhbsXswii';
const OUT = 'exports/workflows/test-workflow.sanitized.json';

function queryWorkflow() {
  const q = `select id,name,nodes,connections,settings,"staticData","pinData",meta,"versionId",active from workflow_entity where id='${WORKFLOW_ID}' limit 1;`;
  const raw = execSync(`sqlite3 -json ${DB} "${q}"`, { encoding: 'utf8' });
  const rows = JSON.parse(raw);
  if (!rows.length) throw new Error(`Workflow not found: ${WORKFLOW_ID}`);
  return rows[0];
}

function redactString(value) {
  if (typeof value !== 'string') return value;
  let out = value;

  out = out.replace(/AIza[0-9A-Za-z\-_]{20,}/g, '{{REDACTED_API_KEY}}');
  out = out.replace(/(x-goog-api-key\s*[:=]\s*)([^\s"'`}{]+)/gi, '$1{{REDACTED_API_KEY}}');
  out = out.replace(/(x-api-key\s*[:=]\s*)([^\s"'`}{]+)/gi, '$1{{REDACTED_API_KEY}}');
  out = out.replace(/\b(sk|rk|pk)_[0-9A-Za-z]{16,}\b/g, '{{REDACTED_TOKEN}}');
  out = out.replace(/\bocm-[0-9A-Za-z!@#$%^&*._-]{6,}\b/g, '{{REDACTED_SECRET}}');
  out = out.replace(/https:\/\/[^\s"']*ngrok[^\s"']*/gi, '{{REDACTED_URL}}');
  out = out.replace(/(https:\/\/docs\.google\.com\/spreadsheets\/d\/)([a-zA-Z0-9-_]+)/g, '$1{{REDACTED_SHEET_ID}}');
  out = out.replace(/\b[0-9]{10,}\b/g, (m) => (m.length >= 16 ? '{{REDACTED_ID}}' : m));

  return out;
}

const SENSITIVE_KEYS = new Set([
  'password', 'pass', 'token', 'accessToken', 'refreshToken', 'secret', 'clientSecret',
  'apiKey', 'apikey', 'authorization', 'username', 'user', 'privateKey', 'webhookId',
]);

function sanitize(obj, parentKey = '') {
  if (Array.isArray(obj)) return obj.map((v) => sanitize(v, parentKey));

  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'credentials') continue;

      const lk = k.toLowerCase();
      if (SENSITIVE_KEYS.has(k) || /(?:api.?key|token|secret|password|authorization|private.?key|webhookid|username)/i.test(lk)) {
        if (typeof v === 'string' && v.trim()) {
          out[k] = `{{REDACTED_${k.toUpperCase()}}}`;
        } else if (v && typeof v === 'object') {
          out[k] = '{{REDACTED_OBJECT}}';
        } else {
          out[k] = v;
        }
        continue;
      }

      out[k] = sanitize(v, k);
    }
    return out;
  }

  if (typeof obj === 'string') return redactString(obj);
  return obj;
}

function main() {
  const row = queryWorkflow();

  const nodes = sanitize(JSON.parse(row.nodes || '[]'));
  const connections = sanitize(JSON.parse(row.connections || '{}'));
  const settings = sanitize(JSON.parse(row.settings || '{}'));
  const staticData = sanitize(JSON.parse(row.staticData || '{}'));
  const pinData = sanitize(JSON.parse(row.pinData || '{}'));
  const meta = sanitize(JSON.parse(row.meta || '{}'));

  const exportPayload = {
    exported_at: new Date().toISOString(),
    source_workflow_id: row.id,
    source_workflow_name: row.name,
    note: 'Sanitized export for sharing. Credentials and sensitive values are redacted.',
    workflow: {
      id: row.id,
      name: row.name,
      active: false,
      versionId: row.versionId,
      settings,
      staticData,
      pinData,
      meta,
      nodes,
      connections,
    },
  };

  fs.mkdirSync('exports/workflows', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(exportPayload, null, 2));

  const outText = fs.readFileSync(OUT, 'utf8');
  const risky = [
    /AIza[0-9A-Za-z\-_]{20,}/,
    /x-goog-api-key\"?\s*[:=]\s*\"?(?!\{\{REDACTED)/i,
    /x-api-key\"?\s*[:=]\s*\"?(?!\{\{REDACTED)/i,
    /telegramApi\"\s*:/,
    /googleSheetsOAuth2Api\"\s*:/,
    /\"credentials\"\s*:/,
  ];

  const found = risky.filter((r) => r.test(outText)).map((r) => r.toString());
  if (found.length) {
    throw new Error(`Sanitization check failed. Risky patterns found: ${found.join(', ')}`);
  }

  console.log(`Wrote ${OUT}`);
}

main();
