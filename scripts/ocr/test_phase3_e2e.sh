#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
# - OCR_BASE_URL (e.g. https://xxxx.ngrok-free.dev)
# - OCR_API_KEY (x-api-key for /webhook/ocr-dev)
# - OCR_TEST_FILE (path to a PDF/image file)
#
# Optional:
# - OCR_FEEDBACK_API_KEY (default: OCR_API_KEY)
# - OCR_DEV_PATH (default: /webhook/ocr-dev)
# - OCR_FEEDBACK_PATH (default: /webhook/ocr-feedback)
# - OUT_DIR (default: ./tmp/phase3-e2e-<timestamp>)

if [[ -z "${OCR_BASE_URL:-}" ]]; then
  echo "ERROR: OCR_BASE_URL is required" >&2
  exit 1
fi
if [[ -z "${OCR_API_KEY:-}" ]]; then
  echo "ERROR: OCR_API_KEY is required" >&2
  exit 1
fi
if [[ -z "${OCR_TEST_FILE:-}" ]]; then
  echo "ERROR: OCR_TEST_FILE is required" >&2
  exit 1
fi
if [[ ! -f "${OCR_TEST_FILE}" ]]; then
  echo "ERROR: OCR_TEST_FILE not found: ${OCR_TEST_FILE}" >&2
  exit 1
fi

OCR_DEV_PATH="${OCR_DEV_PATH:-/webhook/ocr-dev}"
OCR_FEEDBACK_PATH="${OCR_FEEDBACK_PATH:-/webhook/ocr-feedback}"
OCR_FEEDBACK_API_KEY="${OCR_FEEDBACK_API_KEY:-${OCR_API_KEY}}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${OUT_DIR:-./tmp/phase3-e2e-${STAMP}}"
mkdir -p "${OUT_DIR}"

OCR_URL="${OCR_BASE_URL%/}${OCR_DEV_PATH}"
FEEDBACK_URL="${OCR_BASE_URL%/}${OCR_FEEDBACK_PATH}"

echo "[1/4] Calling OCR endpoint: ${OCR_URL}"
OCR_HTTP_CODE="$(curl -sS -o "${OUT_DIR}/ocr_response.json" -w "%{http_code}" \
  -X POST "${OCR_URL}" \
  -H "x-api-key: ${OCR_API_KEY}" \
  -F "files=@${OCR_TEST_FILE}")"

echo "OCR HTTP code: ${OCR_HTTP_CODE}"
if [[ "${OCR_HTTP_CODE}" != "200" && "${OCR_HTTP_CODE}" != "202" ]]; then
  echo "OCR request failed. Response:" >&2
  cat "${OUT_DIR}/ocr_response.json" >&2 || true
  exit 1
fi

echo "[2/4] Building feedback payload from OCR response"
node scripts/ocr/build_feedback_payload.js "${OUT_DIR}/ocr_response.json" > "${OUT_DIR}/feedback_payload.json"

echo "[3/4] Posting feedback payload: ${FEEDBACK_URL}"
FEEDBACK_HTTP_CODE="$(curl -sS -o "${OUT_DIR}/feedback_response.json" -w "%{http_code}" \
  -X POST "${FEEDBACK_URL}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${OCR_FEEDBACK_API_KEY}" \
  --data @"${OUT_DIR}/feedback_payload.json")"

echo "Feedback HTTP code: ${FEEDBACK_HTTP_CODE}"
if [[ "${FEEDBACK_HTTP_CODE}" != "200" ]]; then
  echo "Feedback request failed. Response:" >&2
  cat "${OUT_DIR}/feedback_response.json" >&2 || true
  exit 1
fi

echo "[4/4] Summary"
node - <<'NODE' "${OUT_DIR}/ocr_response.json" "${OUT_DIR}/feedback_response.json"
const fs = require('fs');
const [ocrPath, feedbackPath] = process.argv.slice(2);
const ocr = JSON.parse(fs.readFileSync(ocrPath, 'utf8'));
const fb = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
const out = {
  ocr: {
    success: ocr.success,
    status: ocr.status,
    request_id: ocr.request_id,
    document_id: ocr.document_id,
    decision: ocr.decision,
    confidence: ocr.confidence,
    bills_count: ocr.bills_count
  },
  feedback: {
    success: fb.success,
    request_id: fb.request_id,
    document_id: fb.document_id,
    changed_fields_count: fb.changed_fields_count,
    message: fb.message
  }
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
NODE

echo "Artifacts saved in: ${OUT_DIR}"
