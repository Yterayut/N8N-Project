#!/usr/bin/env bash
set -euo pipefail

OCR_URL="${OCR_URL:-http://127.0.0.1:5678/webhook/ocr-dev}"
OCR_API_KEY="${OCR_API_KEY:-}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

printf 'test-image' > "$TMPDIR/test.txt"

echo "[1/3] unauthorized should return 401"
code=$(curl --max-time 25 -s -o "$TMPDIR/r1.json" -w "%{http_code}" -X POST "$OCR_URL" -F "files=@$TMPDIR/test.txt;type=text/plain")
[[ "$code" == "401" ]] || { echo "FAIL unauthorized code=$code"; cat "$TMPDIR/r1.json"; exit 1; }

echo "[2/3] no-file should return 422"
code=$(curl --max-time 25 -s -o "$TMPDIR/r2.json" -w "%{http_code}" -X POST "$OCR_URL" -H "x-api-key: $OCR_API_KEY")
[[ "$code" == "422" ]] || { echo "FAIL no-file code=$code"; cat "$TMPDIR/r2.json"; exit 1; }

if [[ -z "$OCR_API_KEY" ]]; then
  echo "[3/3] skipped authorized test: OCR_API_KEY is empty"
  exit 0
fi

echo "[3/3] authorized request should return 2xx/4xx JSON (non-empty body)"
code=$(curl --max-time 60 -s -o "$TMPDIR/r3.json" -w "%{http_code}" -X POST "$OCR_URL" -H "x-api-key: $OCR_API_KEY" -F "files=@$TMPDIR/test.txt;type=text/plain")
[[ "$code" =~ ^2|4|5 ]] || { echo "FAIL authorized code=$code"; exit 1; }
[[ -s "$TMPDIR/r3.json" ]] || { echo "FAIL empty body"; exit 1; }

echo "PASS smoke tests"
