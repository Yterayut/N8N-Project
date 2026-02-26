#!/usr/bin/env node

/*
Phase 4 utility:
- Pull correction rows from feedback storage API (OCR_CORRECTIONS sheet)
- Convert to prediction/final pairs
- Compute field-level metrics
- Save artifacts to tmp/phase4-metrics-<timestamp>

Required env:
- OCR_FEEDBACK_API_URL
- OCR_FEEDBACK_API_KEY (fallback OCR_SHARED_API_KEY)
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function needEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
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
  try {
    json = JSON.parse(text);
  } catch (_) {
    // keep null
  }
  return { status: res.status, json, text };
}

async function main() {
  const apiUrl = needEnv('OCR_FEEDBACK_API_URL');
  const apiKey = process.env.OCR_FEEDBACK_API_KEY || needEnv('OCR_SHARED_API_KEY');

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const outDir = path.join('tmp', `phase4-metrics-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const req = { action: 'read', sheet: 'OCR_CORRECTIONS', filter: {} };
  const res = await postJson(apiUrl, apiKey, req);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Feedback API read failed: HTTP ${res.status} ${res.text}`);
  }

  let rows = [];
  if (Array.isArray(res.json)) rows = res.json;
  else if (Array.isArray(res.json?.data)) rows = res.json.data;
  else if (Array.isArray(res.json?.rows)) rows = res.json.rows;

  const pairs = [];
  for (const r of rows) {
    const pred = parseMaybeJson(r.pred_json);
    const fin = parseMaybeJson(r.final_json);
    if (!pred || !fin) continue;
    pairs.push({
      document_id: String(r.document_id || ''),
      ocr_pred_json: pred,
      admin_final_json: fin,
    });
  }

  const pairsPath = path.join(outDir, 'feedback_pairs.json');
  fs.writeFileSync(pairsPath, `${JSON.stringify(pairs, null, 2)}\n`, 'utf8');

  const metricsPath = path.join(outDir, 'metrics.json');
  const cmd = `node scripts/ocr/generate_phase3_metrics.js ${pairsPath} > ${metricsPath}`;
  execSync(cmd, { stdio: 'inherit' });

  const summary = {
    ok: true,
    rows_fetched: rows.length,
    valid_pairs: pairs.length,
    artifacts: {
      out_dir: outDir,
      pairs_json: pairsPath,
      metrics_json: metricsPath,
    },
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});

