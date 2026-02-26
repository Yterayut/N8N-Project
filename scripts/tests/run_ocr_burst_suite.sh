#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OCR_URL="${OCR_URL:-http://127.0.0.1:5678/webhook/ocr-dev}"
OCR_API_KEY="${OCR_API_KEY:-}"
OCR_FILE_PATH="${OCR_FILE_PATH:-/tmp/ocr-load-test.pdf}"
OCR_FILE_MIME="${OCR_FILE_MIME:-application/pdf}"
CONCURRENCY="${CONCURRENCY:-5}"

if [[ -z "$OCR_API_KEY" ]]; then
  echo "ERROR: set OCR_API_KEY" >&2
  exit 1
fi
if [[ ! -f "$OCR_FILE_PATH" ]]; then
  echo "ERROR: OCR_FILE_PATH not found: $OCR_FILE_PATH" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="tmp/loadtest-${STAMP}"
mkdir -p "$OUT_DIR"

run_case() {
  local total="$1"
  local out="$OUT_DIR/burst-${total}.json"
  OCR_URL="$OCR_URL" OCR_API_KEY="$OCR_API_KEY" OCR_FILE_PATH="$OCR_FILE_PATH" OCR_FILE_MIME="$OCR_FILE_MIME" TOTAL="$total" CONCURRENCY="$CONCURRENCY" \
    node scripts/tests/ocr_load_test.js | tee "$out"
}

run_case 10
run_case 20
run_case 50

node - <<'NODE' "$OUT_DIR"
const fs=require('fs');
const outDir=process.argv[2];
const files=['burst-10.json','burst-20.json','burst-50.json'];
const rows=[];
for(const f of files){
  const p=`${outDir}/${f}`;
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  rows.push({burst:j.total,ok:j.ok,busy:j.busy,parse_error:j.parse_error,failed:j.failed,p50_ms:j.p50_ms,p95_ms:j.p95_ms,p99_ms:j.p99_ms,max_ms:j.max_ms});
}
const md=[];
md.push('# OCR Load Test Report');
md.push('');
md.push(`Generated at: ${new Date().toISOString()}`);
md.push('');
md.push('| Burst | OK | Busy(429/503) | Parse(422) | Failed | p50 ms | p95 ms | p99 ms | max ms |');
md.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const r of rows){
  md.push(`| ${r.burst} | ${r.ok} | ${r.busy} | ${r.parse_error} | ${r.failed} | ${r.p50_ms} | ${r.p95_ms} | ${r.p99_ms} | ${r.max_ms} |`);
}
fs.writeFileSync(`${outDir}/report.md`,md.join('\n')+'\n');
console.log(JSON.stringify({ok:true,outDir,report:`${outDir}/report.md`},null,2));
NODE

echo "DONE: $OUT_DIR"
