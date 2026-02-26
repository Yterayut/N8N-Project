#!/usr/bin/env node

/*
Build dashboard snapshot from OCR_PREDICTIONS + OCR_CORRECTIONS and write to OCR_DASHBOARD.

Required env:
- OCR_FEEDBACK_API_URL
- OCR_FEEDBACK_API_KEY (fallback OCR_SHARED_API_KEY)
*/

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

function normalizeRows(resJson) {
  if (Array.isArray(resJson)) return resJson;
  if (Array.isArray(resJson?.data)) return resJson.data;
  return [];
}

function pct(n, d) {
  if (!d) return 0;
  return n / d;
}

async function main() {
  const apiUrl = needEnv('OCR_FEEDBACK_API_URL');
  const apiKey = process.env.OCR_FEEDBACK_API_KEY || needEnv('OCR_SHARED_API_KEY');

  const [predRes, corrRes] = await Promise.all([
    postJson(apiUrl, apiKey, { action: 'read', sheet: 'OCR_PREDICTIONS', filter: {} }),
    postJson(apiUrl, apiKey, { action: 'read', sheet: 'OCR_CORRECTIONS', filter: {} }),
  ]);
  if (predRes.status < 200 || predRes.status >= 300) throw new Error(`Read predictions failed: ${predRes.status} ${predRes.text}`);
  if (corrRes.status < 200 || corrRes.status >= 300) throw new Error(`Read corrections failed: ${corrRes.status} ${corrRes.text}`);

  const pred = normalizeRows(predRes.json);
  const corr = normalizeRows(corrRes.json);

  const totalPred = pred.length;
  const autoPass = pred.filter((x) => String(x.decision || '') === 'auto_pass').length;
  const needsReview = pred.filter((x) => String(x.decision || '') === 'needs_review').length;
  const hardFail = pred.filter((x) => String(x.decision || '') === 'hard_fail').length;
  const success = pred.filter((x) => String(x.status || '') === 'success').length;
  const parseError = pred.filter((x) => String(x.status || '') === 'parse_error').length;
  const error = pred.filter((x) => String(x.status || '') === 'error').length;

  const byType = {};
  for (const r of pred) {
    const t = String(r.doc_type || 'unknown');
    byType[t] = (byType[t] || 0) + 1;
  }

  const snapshot = [{
    snapshot_at_iso: new Date().toISOString(),
    total_predictions: totalPred,
    total_corrections: corr.length,
    auto_pass_count: autoPass,
    auto_pass_rate: pct(autoPass, totalPred),
    needs_review_count: needsReview,
    hard_fail_count: hardFail,
    success_count: success,
    parse_error_count: parseError,
    error_count: error,
    by_doc_type_json: JSON.stringify(byType),
  }];

  const writeRes = await postJson(apiUrl, apiKey, {
    action: 'replace_rows',
    sheet: 'OCR_DASHBOARD',
    rows: snapshot,
  });
  if (writeRes.status < 200 || writeRes.status >= 300) throw new Error(`Write dashboard failed: ${writeRes.status} ${writeRes.text}`);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    snapshot: snapshot[0],
    write_result: writeRes.json || null
  }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});

