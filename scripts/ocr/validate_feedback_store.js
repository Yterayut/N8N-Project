#!/usr/bin/env node

/*
Validate feedback store readiness via CRUD API.

Required env:
- OCR_FEEDBACK_API_URL
- OCR_FEEDBACK_API_KEY (fallback OCR_SHARED_API_KEY)
*/

const REQUIRED_SHEETS = [
  'OCR_PREDICTIONS',
  'OCR_CORRECTIONS',
  'OCR_EXAMPLES',
  'OCR_REVIEW_QUEUE',
  'OCR_DASHBOARD',
  'OCR_DEDUPE',
];

function needEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function postJson(url, apiKey, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, text, json };
}

async function main() {
  const apiUrl = needEnv('OCR_FEEDBACK_API_URL');
  const apiKey = process.env.OCR_FEEDBACK_API_KEY || needEnv('OCR_SHARED_API_KEY');

  const sheetRes = await postJson(apiUrl, apiKey, { action: 'sheets' });
  if (sheetRes.status < 200 || sheetRes.status >= 300) {
    throw new Error(`Cannot list sheets: ${sheetRes.status} ${sheetRes.text}`);
  }

  let list = [];
  if (Array.isArray(sheetRes.json)) list = sheetRes.json;
  else if (Array.isArray(sheetRes.json?.data)) list = sheetRes.json.data;
  const names = new Set(list.map((x) => String(x.name || '')));

  const missing = REQUIRED_SHEETS.filter((s) => !names.has(s));
  const out = {
    ok: missing.length === 0,
    required_sheets: REQUIRED_SHEETS,
    found_sheets: Array.from(names),
    missing_sheets: missing,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  if (missing.length) process.exit(2);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});

