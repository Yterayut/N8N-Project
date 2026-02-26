#!/usr/bin/env node

/*
Build gold dataset from OCR_CORRECTIONS via feedback API.

Required env:
- OCR_FEEDBACK_API_URL
- OCR_FEEDBACK_API_KEY (fallback OCR_SHARED_API_KEY)

Optional env:
- GOLD_MIN (default 200)
- GOLD_MAX (default 500)
*/

const fs = require('fs');
const path = require('path');

function needEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseMaybeJson(v) {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string' && v.trim()) {
    try {
      return JSON.parse(v);
    } catch (_) {
      return null;
    }
  }
  return null;
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
  const goldMin = Number(process.env.GOLD_MIN || 200);
  const goldMax = Number(process.env.GOLD_MAX || 500);

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const outDir = path.join('tmp', `gold-dataset-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const res = await postJson(apiUrl, apiKey, { action: 'read', sheet: 'OCR_CORRECTIONS', filter: {} });
  if (res.status < 200 || res.status >= 300) throw new Error(`API read failed: ${res.status} ${res.text}`);
  let rows = [];
  if (Array.isArray(res.json)) rows = res.json;
  else if (Array.isArray(res.json?.data)) rows = res.json.data;

  const dataset = [];
  const byType = {};
  for (const r of rows) {
    const pred = parseMaybeJson(r.pred_json);
    const fin = parseMaybeJson(r.final_json);
    if (!pred || !fin) continue;
    const docType = String(r.doc_type || 'unknown');
    const sample = {
      document_id: String(r.document_id || ''),
      request_id: String(r.request_id || ''),
      doc_type: docType,
      vendor_hint: String(r.vendor_hint || ''),
      layout_hint: String(r.layout_hint || ''),
      input_json: pred,
      target_json: fin,
    };
    dataset.push(sample);
    byType[docType] = (byType[docType] || 0) + 1;
  }

  const shuffled = dataset.slice().sort(() => Math.random() - 0.5);
  const trainSize = Math.floor(shuffled.length * 0.9);
  const train = shuffled.slice(0, trainSize);
  const val = shuffled.slice(trainSize);

  const writeJsonl = (file, arr) => {
    const lines = arr.map((x) => JSON.stringify(x));
    fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  };

  const allPath = path.join(outDir, 'gold_all.jsonl');
  const trainPath = path.join(outDir, 'gold_train.jsonl');
  const valPath = path.join(outDir, 'gold_val.jsonl');
  writeJsonl(allPath, shuffled);
  writeJsonl(trainPath, train);
  writeJsonl(valPath, val);

  const report = {
    ok: true,
    total_samples: shuffled.length,
    train_samples: train.length,
    val_samples: val.length,
    by_doc_type: byType,
    target_range: { min: goldMin, max: goldMax },
    readiness: shuffled.length >= goldMin && shuffled.length <= goldMax ? 'ready' : 'not_ready',
    artifacts: { out_dir: outDir, all_jsonl: allPath, train_jsonl: trainPath, val_jsonl: valPath },
  };

  const reportPath = path.join(outDir, 'gold_report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (shuffled.length < goldMin) process.exitCode = 2;
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});

