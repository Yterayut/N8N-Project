#!/usr/bin/env node
const { execSync } = require('child_process');

const OCR_URL = process.env.OCR_URL || 'http://127.0.0.1:5678/webhook/ocr-dev';
const API_KEY = process.env.OCR_API_KEY || '';
const TOTAL = Number(process.env.TOTAL || 20);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const FILE_PATH = process.env.OCR_FILE_PATH || '/tmp/ocr-load-test.pdf';
const FILE_MIME = process.env.OCR_FILE_MIME || 'application/pdf';

if (!API_KEY) {
  console.error('Set OCR_API_KEY before running load test');
  process.exit(1);
}

if (!require('fs').existsSync(FILE_PATH)) {
  console.error(`Set OCR_FILE_PATH to an existing file, got: ${FILE_PATH}`);
  process.exit(1);
}

function runOne(i) {
  const started = Date.now();
  const cmd = `curl -s -o /tmp/ocr-load-${i}.json -w "%{http_code}" -X POST '${OCR_URL}' -H 'x-api-key: ${API_KEY}' -F 'files=@${FILE_PATH};type=${FILE_MIME}'`;
  const code = Number(execSync(cmd, { encoding: 'utf8' }).trim());
  return { code, latencyMs: Date.now() - started };
}

(async () => {
  const results = { total: TOTAL, ok: 0, busy: 0, parse_error: 0, failed: 0, latencies: [] };
  let idx = 0;

  async function worker() {
    while (idx < TOTAL) {
      const i = idx++;
      try {
        const { code, latencyMs } = runOne(i);
        results.latencies.push(latencyMs);
        if (code >= 200 && code < 300) results.ok++;
        else if (code === 429 || code === 503) results.busy++;
        else if (code === 422) results.parse_error++;
        else results.failed++;
      } catch {
        results.failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const sorted = results.latencies.sort((a, b) => a - b);
  const p = (x) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))] : 0;
  const summary = {
    ...results,
    p50_ms: p(0.5),
    p95_ms: p(0.95),
    p99_ms: p(0.99),
    max_ms: sorted.length ? sorted[sorted.length - 1] : 0,
  };
  delete summary.latencies;
  console.log(JSON.stringify(summary, null, 2));
})();
