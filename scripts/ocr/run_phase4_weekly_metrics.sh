#!/usr/bin/env bash
set -euo pipefail

# Required:
# - OCR_FEEDBACK_API_URL
# - OCR_FEEDBACK_API_KEY (or OCR_SHARED_API_KEY)

if [[ -z "${OCR_FEEDBACK_API_URL:-}" ]]; then
  echo "ERROR: OCR_FEEDBACK_API_URL is required" >&2
  exit 1
fi

if [[ -z "${OCR_FEEDBACK_API_KEY:-}" && -z "${OCR_SHARED_API_KEY:-}" ]]; then
  echo "ERROR: OCR_FEEDBACK_API_KEY or OCR_SHARED_API_KEY is required" >&2
  exit 1
fi

node scripts/ocr/run_phase4_weekly_metrics.js

