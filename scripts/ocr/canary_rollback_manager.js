#!/usr/bin/env node
const https = require('https');
const http = require('http');

const API_URL = process.env.OCR_FEEDBACK_API_URL;
const API_KEY = process.env.OCR_FEEDBACK_API_KEY || process.env.OCR_SHARED_API_KEY || '';

if (!API_URL) {
  console.error('ERROR: OCR_FEEDBACK_API_URL is required');
  process.exit(1);
}

const action = process.argv[2] || 'status';
const targetVersion = process.argv[3] || '';
const reason = process.argv[4] || '';

function call(payload) {
  const url = new URL(API_URL);
  const body = Buffer.from(JSON.stringify(payload));
  const lib = url.protocol === 'https:' ? https : http;
  const opts = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length,
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
  };
  return new Promise((resolve, reject) => {
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
        return reject(new Error(`HTTP ${res.statusCode} ${raw}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getRules() {
  const r = await call({ action: 'read', sheet: 'OCR_LEARNING_RULES' });
  return Array.isArray(r.data) ? r.data : [];
}

async function saveRules(rows) {
  await call({ action: 'replace_rows', sheet: 'OCR_LEARNING_RULES', rows });
}

async function audit(entry) {
  await call({ action: 'create', sheet: 'OCR_RELEASE_AUDIT', data: { at_iso: new Date().toISOString(), ...entry } });
}

function markAll(rows, fromStatuses, toStatus) {
  return rows.map((r) => fromStatuses.includes(String(r.status || '')) ? { ...r, status: toStatus, updated_at_iso: new Date().toISOString() } : r);
}

(async () => {
  const rules = await getRules();
  if (action === 'status') {
    const out = {
      total: rules.length,
      active: rules.filter((r) => r.status === 'active').length,
      canary: rules.filter((r) => r.status === 'canary').length,
      draft: rules.filter((r) => r.status === 'draft').length,
      rolled_back: rules.filter((r) => r.status === 'rolled_back').length,
    };
    console.log(JSON.stringify({ ok: true, action, ...out }, null, 2));
    return;
  }

  if (action === 'promote-canary') {
    if (!targetVersion) throw new Error('targetVersion required for promote-canary');
    const updated = rules.map((r) => (String(r.version || '') === targetVersion ? { ...r, status: 'canary', updated_at_iso: new Date().toISOString() } : r));
    await saveRules(updated);
    await audit({ action, target_version: targetVersion, reason });
    console.log(JSON.stringify({ ok: true, action, target_version: targetVersion }, null, 2));
    return;
  }

  if (action === 'activate-canary') {
    const updated = markAll(rules, ['active'], 'rolled_back').map((r) => r.status === 'canary' ? { ...r, status: 'active', updated_at_iso: new Date().toISOString() } : r);
    await saveRules(updated);
    await audit({ action, target_version: targetVersion, reason });
    console.log(JSON.stringify({ ok: true, action }, null, 2));
    return;
  }

  if (action === 'rollback-active') {
    const updated = markAll(rules, ['active', 'canary'], 'rolled_back');
    await saveRules(updated);
    await audit({ action, target_version: targetVersion, reason });
    console.log(JSON.stringify({ ok: true, action }, null, 2));
    return;
  }

  throw new Error(`Unsupported action: ${action}`);
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2));
  process.exit(1);
});
