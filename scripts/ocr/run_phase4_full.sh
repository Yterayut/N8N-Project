#!/usr/bin/env bash
set -euo pipefail

# Required:
# - OCR_FEEDBACK_API_URL
# - OCR_FEEDBACK_API_KEY (or OCR_SHARED_API_KEY)
#
# Optional KPI thresholds:
# - KPI_CRITICAL_MIN (default 0.99)
# - KPI_NON_CRITICAL_MIN (default 0.97)
# - KPI_CRITICAL_EMPTY_MAX (default 0.01)
# - KPI_AUTO_PASS_MIN (default 0.90)
#
# Optional gold target:
# - GOLD_MIN (default 200)
# - GOLD_MAX (default 500)

if [[ -z "${OCR_FEEDBACK_API_URL:-}" ]]; then
  echo "ERROR: OCR_FEEDBACK_API_URL is required" >&2
  exit 1
fi

if [[ -z "${OCR_FEEDBACK_API_KEY:-}" && -z "${OCR_SHARED_API_KEY:-}" ]]; then
  echo "ERROR: OCR_FEEDBACK_API_KEY or OCR_SHARED_API_KEY is required" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="tmp/phase4-full-${STAMP}"
mkdir -p "$OUT_DIR"

echo "[1/5] Weekly metrics"
node scripts/ocr/run_phase4_weekly_metrics.js | tee "$OUT_DIR/weekly_metrics_run.json"
METRICS_PATH="$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$OUT_DIR/weekly_metrics_run.json','utf8'));console.log(j.artifacts.metrics_json)")"

echo "[2/5] KPI gate"
node scripts/ocr/enforce_kpi_gate.js "$METRICS_PATH" | tee "$OUT_DIR/kpi_gate.json"

echo "[3/5] Gold dataset"
node scripts/ocr/generate_gold_dataset.js | tee "$OUT_DIR/gold_dataset.json"

echo "[4/5] Review queue snapshot"
node scripts/ocr/build_review_queue_snapshot.js | tee "$OUT_DIR/review_queue.json"

echo "[5/5] Dashboard snapshot"
node scripts/ocr/build_dashboard_snapshot.js | tee "$OUT_DIR/dashboard_snapshot.json"

echo "DONE: $OUT_DIR"

