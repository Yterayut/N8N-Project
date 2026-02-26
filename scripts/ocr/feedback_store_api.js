#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.OCR_FEEDBACK_STORE_PORT || 8787);
const PATHNAME = process.env.OCR_FEEDBACK_STORE_PATH || '/ocr-feedback-store';
const API_KEYS = Array.from(
  new Set(
    [process.env.OCR_FEEDBACK_API_KEY, process.env.OCR_SHARED_API_KEY]
      .filter(Boolean)
      .flatMap((v) => String(v).split(',').map((x) => x.trim()).filter(Boolean))
      .concat([
        '={{ $env.OCR_FEEDBACK_API_KEY || $env.OCR_SHARED_API_KEY }}',
        '={{$env.OCR_FEEDBACK_API_KEY || $env.OCR_SHARED_API_KEY}}',
      ])
  )
);
const DB_FILE = process.env.OCR_FEEDBACK_STORE_FILE || path.join(process.cwd(), '.tmp', 'ocr_feedback_store.json');
const DISABLE_AUTH = String(process.env.OCR_FEEDBACK_STORE_DISABLE_AUTH || '').toLowerCase() === 'true';

const REQUIRED_SHEETS = ['OCR_PREDICTIONS','OCR_CORRECTIONS','OCR_EXAMPLES','OCR_REVIEW_QUEUE','OCR_DASHBOARD','OCR_DEDUPE','OCR_LEARNING_RULES','OCR_RELEASE_AUDIT'];
const DEFAULT_LEASE_TTL_SEC = Number(process.env.OCR_ADMISSION_LEASE_TTL_SEC || 180);

function ensureDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const base = { sheets: {}, dedupe: {}, admission: { leases: {} } };
    for (const s of REQUIRED_SHEETS) base.sheets[s] = [];
    fs.writeFileSync(DB_FILE, JSON.stringify(base, null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const db = JSON.parse(raw || '{}');
  db.sheets = db.sheets || {};
  db.dedupe = db.dedupe || {};
  db.admission = db.admission || {};
  db.admission.leases = db.admission.leases || {};
  for (const s of REQUIRED_SHEETS) if (!Array.isArray(db.sheets[s])) db.sheets[s] = [];
  return db;
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function matches(row, filter = {}) {
  const keys = Object.keys(filter || {});
  if (!keys.length) return true;
  return keys.every((k) => String(row[k] ?? '') === String(filter[k] ?? ''));
}

function nowMs() {
  return Date.now();
}

function pruneLeases(leases) {
  const now = nowMs();
  for (const token of Object.keys(leases || {})) {
    const lease = leases[token] || {};
    const exp = Number(lease.expires_at_ms || 0);
    if (!exp || exp <= now) delete leases[token];
  }
}

function activeLeaseCount(leases, tenant) {
  let n = 0;
  for (const token of Object.keys(leases || {})) {
    const lease = leases[token] || {};
    if (!tenant || String(lease.tenant_id || '') === String(tenant)) n++;
  }
  return n;
}

function handle(body) {
  const action = String(body.action || '').trim();
  const db = readDb();

  if (action === 'sheets') {
    return { code: 200, data: REQUIRED_SHEETS.map((name) => ({ name })) };
  }

  if (action === 'create') {
    const sheet = String(body.sheet || '');
    const data = body.data && typeof body.data === 'object' ? body.data : null;
    if (!sheet || !data) return { code: 422, error: 'INVALID_PAYLOAD', message: 'sheet and data required' };
    if (!db.sheets[sheet]) db.sheets[sheet] = [];
    db.sheets[sheet].push({ ...data, _created_at: new Date().toISOString() });
    writeDb(db);
    return { code: 200, data: { created: true, sheet, total: db.sheets[sheet].length } };
  }

  if (action === 'read') {
    const sheet = String(body.sheet || '');
    const filter = body.filter && typeof body.filter === 'object' ? body.filter : {};
    if (!sheet) return { code: 422, error: 'INVALID_PAYLOAD', message: 'sheet required' };
    const rows = (db.sheets[sheet] || []).filter((r) => matches(r, filter));
    return { code: 200, data: rows };
  }

  if (action === 'replace_rows') {
    const sheet = String(body.sheet || '');
    const rows = Array.isArray(body.rows) ? body.rows : null;
    if (!sheet || !rows) return { code: 422, error: 'INVALID_PAYLOAD', message: 'sheet and rows[] required' };
    db.sheets[sheet] = rows.map((r) => ({ ...(r || {}), _updated_at: new Date().toISOString() }));
    writeDb(db);
    return { code: 200, data: { replaced: true, sheet, total: db.sheets[sheet].length } };
  }

  if (action === 'reserve_key') {
    const sheet = String(body.sheet || 'OCR_DEDUPE');
    const keyCol = String(body.key_column || 'row_key');
    const keyVal = String(body.key_value || '').trim();
    if (!keyVal) return { code: 422, error: 'INVALID_PAYLOAD', message: 'key_value required' };
    const bucket = `${sheet}::${keyCol}`;
    db.dedupe[bucket] = db.dedupe[bucket] || {};
    if (db.dedupe[bucket][keyVal]) {
      return { code: 200, data: { reserved: false, duplicate: true } };
    }
    db.dedupe[bucket][keyVal] = { at: new Date().toISOString() };
    if (!db.sheets[sheet]) db.sheets[sheet] = [];
    db.sheets[sheet].push({ [keyCol]: keyVal, reserved_at: new Date().toISOString() });
    writeDb(db);
    return { code: 200, data: { reserved: true, duplicate: false } };
  }

  if (action === 'acquire_slot') {
    const tenantId = String(body.tenant_id || 'default');
    const requestId = String(body.request_id || `req_${nowMs()}`);
    const globalLimit = Math.max(1, Number(body.global_limit || process.env.OCR_ADMISSION_GLOBAL_LIMIT || 8));
    const tenantLimit = Math.max(1, Number(body.tenant_limit || process.env.OCR_ADMISSION_TENANT_LIMIT || 4));
    const ttlSec = Math.max(30, Number(body.ttl_sec || DEFAULT_LEASE_TTL_SEC));
    const retryAfterSec = Math.max(5, Number(body.retry_after_sec || process.env.OCR_ADMISSION_RETRY_AFTER_SEC || 15));

    pruneLeases(db.admission.leases);
    const globalActive = activeLeaseCount(db.admission.leases);
    const tenantActive = activeLeaseCount(db.admission.leases, tenantId);

    if (globalActive >= globalLimit || tenantActive >= tenantLimit) {
      writeDb(db);
      return {
        code: 200,
        data: {
          allowed: false,
          code: 429,
          reason: 'SYSTEM_BUSY',
          retry_after_sec: retryAfterSec,
          global_active: globalActive,
          tenant_active: tenantActive,
          global_limit: globalLimit,
          tenant_limit: tenantLimit
        }
      };
    }

    const token = `slot_${tenantId}_${requestId}_${Math.random().toString(16).slice(2, 8)}`;
    const expires = nowMs() + (ttlSec * 1000);
    db.admission.leases[token] = {
      tenant_id: tenantId,
      request_id: requestId,
      created_at_ms: nowMs(),
      expires_at_ms: expires
    };
    writeDb(db);
    return {
      code: 200,
      data: {
        allowed: true,
        code: 200,
        slot_token: token,
        expires_at_ms: expires,
        global_active: activeLeaseCount(db.admission.leases),
        tenant_active: activeLeaseCount(db.admission.leases, tenantId),
        global_limit: globalLimit,
        tenant_limit: tenantLimit
      }
    };
  }

  if (action === 'release_slot') {
    const token = String(body.slot_token || '').trim();
    if (!token) return { code: 422, error: 'INVALID_PAYLOAD', message: 'slot_token required' };
    pruneLeases(db.admission.leases);
    const existed = Boolean(db.admission.leases[token]);
    if (existed) delete db.admission.leases[token];
    writeDb(db);
    return { code: 200, data: { released: existed } };
  }

  if (action === 'slot_stats') {
    const tenantId = String(body.tenant_id || '').trim();
    pruneLeases(db.admission.leases);
    writeDb(db);
    return {
      code: 200,
      data: {
        active_global: activeLeaseCount(db.admission.leases),
        active_tenant: tenantId ? activeLeaseCount(db.admission.leases, tenantId) : null
      }
    };
  }

  if (action === 'clear_admission') {
    db.admission.leases = {};
    writeDb(db);
    return { code: 200, data: { cleared: true } };
  }

  return { code: 400, error: 'UNKNOWN_ACTION', message: 'unsupported action' };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== PATHNAME) {
    return json(res, 404, { success: false, message: 'Not Found' });
  }
  if (!DISABLE_AUTH && !API_KEYS.length) {
    return json(res, 500, { success: false, error: 'API_KEY_NOT_CONFIGURED' });
  }
  const key = String(req.headers['x-api-key'] || '');
  if (!DISABLE_AUTH && !API_KEYS.includes(key)) {
    return json(res, 401, { success: false, error: 'UNAUTHORIZED' });
  }

  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 10 * 1024 * 1024) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch {
      return json(res, 400, { success: false, error: 'INVALID_JSON' });
    }

    const out = handle(body);
    if (out.error) return json(res, out.code || 400, { success: false, error: out.error, message: out.message || '' });
    return json(res, out.code || 200, { success: true, data: out.data });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`feedback-store-api listening on http://127.0.0.1:${PORT}${PATHNAME}`);
});
