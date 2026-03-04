#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OCR_URL="${OCR_URL:-http://127.0.0.1:5678/webhook/ocr-dev}"
OCR_API_KEY="${OCR_API_KEY:-}"
DB_PATH="${DB_PATH:-$ROOT_DIR/.n8n-dev/.n8n/database.sqlite}"
RULE_TEXT="ห้ามนำสัญลักษณ์ # * หรือเครื่องหมายพิเศษอื่น ๆ มาใส่นำหน้าเลขที่"

FILES=(
  "$ROOT_DIR/file/shell.pdf"
  "$ROOT_DIR/file/fleetcard.pdf"
  "$ROOT_DIR/file/PTT-OR.pdf"
)

if [[ -z "$OCR_API_KEY" ]]; then
  if [[ -f "$ROOT_DIR/.env" ]]; then
    OCR_API_KEY="$(grep -E '^OCR_SHARED_API_KEY=' "$ROOT_DIR/.env" | head -n1 | cut -d= -f2- | tr -d '\"')"
  fi
fi

if [[ -z "$OCR_API_KEY" ]]; then
  echo "FAIL: OCR_API_KEY is empty (set OCR_API_KEY or OCR_SHARED_API_KEY in .env)"
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "FAIL: database not found: $DB_PATH"
  exit 1
fi

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "FAIL: missing fixture file: $f"
    exit 1
  fi
done

python3 - "$OCR_URL" "$OCR_API_KEY" "$DB_PATH" "$RULE_TEXT" "${FILES[@]}" <<'PY'
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

ocr_url = sys.argv[1]
api_key = sys.argv[2]
db_path = sys.argv[3]
rule_text = sys.argv[4]
files = sys.argv[5:]

conn = sqlite3.connect(db_path)
failures = []
results = []

for file_path in files:
    out_file = f"/tmp/ocr-guard-{Path(file_path).name}.json"
    cmd = (
        f"curl -s -o '{out_file}' -w '%{{http_code}}' -X POST '{ocr_url}' "
        f"-H 'x-api-key: {api_key}' -F 'files=@{file_path}'"
    )
    http_code = subprocess.check_output(["bash", "-lc", cmd], text=True).strip()

    try:
        payload = json.loads(Path(out_file).read_text())
    except Exception as exc:
        failures.append(f"{Path(file_path).name}: invalid JSON response ({exc})")
        continue

    ok_http = http_code == "202"
    ok_success = payload.get("success") is True
    request_id = str(payload.get("request_id") or "").strip()

    has_rule = False
    exec_id = None
    if request_id:
        # OCR endpoint returns HTTP 202 before downstream persistence is always queryable.
        # Poll briefly until request_id is visible in execution_data.
        for _ in range(45):
            row = conn.execute(
                """
                SELECT e.id, instr(d.data, ?) > 0
                FROM execution_entity e
                JOIN execution_data d ON d.executionId = e.id
                WHERE e.workflowId = 'up1n75qEhbsXswii'
                  AND instr(d.data, ?) > 0
                ORDER BY e.id DESC
                LIMIT 1
                """,
                (rule_text, request_id),
            ).fetchone()
            if row:
                exec_id = row[0]
                has_rule = bool(row[1])
                break
            time.sleep(2)

    if not ok_http:
        failures.append(f"{Path(file_path).name}: expected HTTP 202, got {http_code}")
    if not ok_success:
        failures.append(f"{Path(file_path).name}: expected success=true, got {payload.get('success')}")
    if not has_rule:
        failures.append(f"{Path(file_path).name}: rule text not found in execution_data (request_id={request_id})")

    results.append(
        {
            "file": Path(file_path).name,
            "http": http_code,
            "success": payload.get("success"),
            "request_id": request_id,
            "execution_id": exec_id,
            "rule_seen_in_execution_data": has_rule,
        }
    )

conn.close()
print(json.dumps(results, ensure_ascii=False, indent=2))

if failures:
    print("\nFAILURES:")
    for item in failures:
        print(f"- {item}")
    sys.exit(1)

print("\nPASS: OCR prompt guard regression checks passed")
PY
