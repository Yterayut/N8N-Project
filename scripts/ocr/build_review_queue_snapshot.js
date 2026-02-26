#!/usr/bin/env node

/*
Build review queue snapshot from OCR_PREDICTIONS and write to OCR_REVIEW_QUEUE.

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

async function main() {
  const apiUrl = needEnv('OCR_FEEDBACK_API_URL');
  const apiKey = process.env.OCR_FEEDBACK_API_KEY || needEnv('OCR_SHARED_API_KEY');

  const readRes = await postJson(apiUrl, apiKey, { action: 'read', sheet: 'OCR_PREDICTIONS', filter: {} });
  if (readRes.status < 200 || readRes.status >= 300) throw new Error(`Read predictions failed: ${readRes.status} ${readRes.text}`);

  const rows = normalizeRows(readRes.json);
  const queue = [];
  for (const r of rows) {
    const decision = String(r.decision || '');
    const status = String(r.status || '');
    if (decision !== 'auto_pass' || status !== 'success') {
      queue.push({
        document_id: String(r.document_id || ''),
        request_id: String(r.request_id || ''),
        created_at_iso: String(r.created_at_iso || ''),
        doc_type: String(r.doc_type || 'unknown'),
        decision: decision || 'needs_review',
        status: status || 'unknown',
        confidence: Number(r.confidence || 0),
        reason: status !== 'success' ? 'ocr_status_not_success' : 'decision_not_auto_pass',
      });
    }
  }

  const writeRes = await postJson(apiUrl, apiKey, {
    action: 'replace_rows',
    sheet: 'OCR_REVIEW_QUEUE',
    rows: queue,
  });
  if (writeRes.status < 200 || writeRes.status >= 300) throw new Error(`Write review queue failed: ${writeRes.status} ${writeRes.text}`);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    total_predictions: rows.length,
    queue_size: queue.length,
    write_result: writeRes.json || null
  }, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});

