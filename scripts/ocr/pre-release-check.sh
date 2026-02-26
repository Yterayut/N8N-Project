#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

DB_PATH="${N8N_DB_PATH:-.n8n-dev/.n8n/database.sqlite}"
WORKFLOW_ID="${WORKFLOW_ID:-up1n75qEhbsXswii}"

echo "[1/5] Verify code-node newline safety"
node scripts/ocr/verify_code_nodes_newlines.js

echo "[2/5] Verify n8n sqlite exists"
if [[ ! -f "$DB_PATH" ]]; then
  echo "FAIL: database not found at $DB_PATH"
  exit 1
fi

echo "[3/5] Verify latest execution status on workflow ${WORKFLOW_ID}"
LATEST_STATUS="$(sqlite3 "$DB_PATH" "select status from execution_entity where workflowId='${WORKFLOW_ID}' order by id desc limit 1;")"
LATEST_ID="$(sqlite3 "$DB_PATH" "select id from execution_entity where workflowId='${WORKFLOW_ID}' order by id desc limit 1;")"
if [[ -z "${LATEST_STATUS}" ]]; then
  echo "FAIL: no execution found for workflow ${WORKFLOW_ID}"
  exit 1
fi
if [[ "${LATEST_STATUS}" == "error" ]]; then
  echo "FAIL: latest execution is error (id=${LATEST_ID})"
  exit 1
fi
echo "OK: latest execution id=${LATEST_ID}, status=${LATEST_STATUS}"

echo "[4/5] Verify env readiness for feedback store"
if [[ -z "${OCR_FEEDBACK_API_URL:-}" ]]; then
  echo "WARN: OCR_FEEDBACK_API_URL is empty"
fi
if [[ -z "${OCR_FEEDBACK_API_KEY:-}" && -z "${OCR_SHARED_API_KEY:-}" ]]; then
  echo "WARN: OCR_FEEDBACK_API_KEY and OCR_SHARED_API_KEY are both empty"
fi

echo "[5/5] Optional smoke test"
if [[ -n "${OCR_DEV_WEBHOOK_URL:-}" && -n "${OCR_SHARED_API_KEY:-}" && -n "${OCR_TEST_FILE:-}" ]]; then
  if [[ ! -f "${OCR_TEST_FILE}" ]]; then
    echo "FAIL: OCR_TEST_FILE not found: ${OCR_TEST_FILE}"
    exit 1
  fi
  HTTP_CODE="$(curl -sS -o /tmp/ocr-precheck-response.json -w "%{http_code}" \
    -X POST "${OCR_DEV_WEBHOOK_URL}" \
    -H "x-api-key: ${OCR_SHARED_API_KEY}" \
    -F "files=@${OCR_TEST_FILE};type=application/pdf")"
  if [[ "${HTTP_CODE}" != "200" && "${HTTP_CODE}" != "202" ]]; then
    echo "FAIL: smoke test http=${HTTP_CODE}"
    cat /tmp/ocr-precheck-response.json || true
    exit 1
  fi
  echo "OK: smoke test http=${HTTP_CODE}"
else
  echo "SKIP: set OCR_DEV_WEBHOOK_URL + OCR_SHARED_API_KEY + OCR_TEST_FILE to enable smoke test"
fi

echo "PASS: pre-release checks completed"

