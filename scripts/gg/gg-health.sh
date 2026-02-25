#!/bin/bash
# Role: Health Check — validate GG infrastructure readiness

set -euo pipefail

GG_ROLE="health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

json_obj() {
  python3 - "$@" <<'PY'
import json, sys
args = sys.argv[1:]
it = iter(args)
obj = {}
for k, v in zip(it, it):
    if v == "__true__":
        obj[k] = True
    elif v == "__false__":
        obj[k] = False
    elif v == "__null__":
        obj[k] = None
    elif v.startswith("__int__:"):
        obj[k] = int(v.split(":", 1)[1])
    else:
        obj[k] = v
print(json.dumps(obj, separators=(",", ":")))
PY
}

check_cli() {
  if ! command -v gemini >/dev/null 2>&1; then
    json_obj status fail version __null__
    return 0
  fi
  local version
  if version="$(gemini --version 2>/dev/null | head -1)"; then
    json_obj status ok version "${version:-unknown}"
  else
    json_obj status fail version __null__
  fi
}

check_api() {
  local t0 t1 ms status
  t0=$(date +%s%3N)
  if command -v timeout >/dev/null 2>&1; then
    if timeout 20s gemini -p "ping" --output-format text >/dev/null 2>&1; then
      status="ok"
    else
      status="fail"
    fi
  elif gemini -p "ping" --output-format text >/dev/null 2>&1; then
    status="ok"
  else
    status="fail"
  fi
  t1=$(date +%s%3N)
  ms=$((t1 - t0))
  json_obj status "$status" latency_ms "__int__:$ms"
}

check_scripts() {
  local scripts=(
    "common.sh"
    "gg-synthesize.sh"
    "gg-groundtruth.sh"
    "gg-prompt-engineer.sh"
    "gg-spec-draft.sh"
    "gg-validate.sh"
    "gg-curate.sh"
  )
  local found=0
  local missing_json
  local missing=()
  local s
  for s in "${scripts[@]}"; do
    if [ -x "$SCRIPT_DIR/$s" ]; then
      found=$((found + 1))
    else
      missing+=("$s")
    fi
  done
  missing_json="$(printf '%s\n' "${missing[@]:-}" | python3 -c 'import sys,json; print(json.dumps([x for x in sys.stdin.read().splitlines() if x]))')"
  python3 - <<PY
import json
print(json.dumps({
  "status": "warn" if ${#missing[@]} else "ok",
  "found": $found,
  "missing": $missing_json,
}, separators=(",", ":")))
PY
}

check_storage() {
  local status="ok"
  local writable="__true__"
  if ! (touch "$PROPOSALS_DIR/.write_test" && rm -f "$PROPOSALS_DIR/.write_test"); then
    status="fail"
    writable="__false__"
  fi
  if ! (touch "$REPORTS_DIR/.write_test" && rm -f "$REPORTS_DIR/.write_test"); then
    status="fail"
    writable="__false__"
  fi
  json_obj status "$status" writable "$writable"
}

check_data_gateway() {
  local tmp status="fail" rows=0
  tmp="$(mktemp)"
  if curl -sf --max-time 5 \
    -H "x-api-key: ${OCR_SHARED_API_KEY:-}" \
    "$GG_DATA_WEBHOOK?sheet=TRAIN_CASES" >"$tmp" 2>/dev/null; then
    status="ok"
    rows="$(python3 -c 'import json,sys; 
try:
 d=json.load(open(sys.argv[1]))
 print(len(d) if isinstance(d,list) else 0)
except Exception:
 print(0)' "$tmp" 2>/dev/null || echo 0)"
  fi
  rm -f "$tmp"
  json_obj status "$status" rows "__int__:${rows:-0}"
}

check_recent_errors() {
  local count=0
  if [ -f "$LOGS_DIR/gg-error.log" ]; then
    # Log lines currently have time-only timestamps; use file mtime as a 24h gate.
    if find "$LOGS_DIR/gg-error.log" -mmin -1440 | grep -q .; then
      count="$(wc -l < "$LOGS_DIR/gg-error.log" | tr -d ' ')"
    fi
  fi
  json_obj recent_errors "__int__:${count:-0}"
}

CLI="$(check_cli)"
API="$(check_api)"
SCRIPTS="$(check_scripts)"
STORAGE="$(check_storage)"
GATEWAY="$(check_data_gateway)"
ERRORS="$(check_recent_errors)"

OVERALL="ok"
if printf '%s%s%s%s%s' "$CLI" "$API" "$SCRIPTS" "$STORAGE" "$GATEWAY" | grep -q '"status":"fail"'; then
  OVERALL="fail"
elif printf '%s' "$SCRIPTS" | grep -q '"status":"warn"'; then
  OVERALL="warn"
fi

python3 - <<PY
import json
print(json.dumps({
  "status": "$OVERALL",
  "timestamp": "$TIMESTAMP",
  "agent": "GG (Gemini)",
  "checks": {
    "cli": json.loads('''$CLI'''),
    "api": json.loads('''$API'''),
    "scripts": json.loads('''$SCRIPTS'''),
    "storage": json.loads('''$STORAGE'''),
    "data_gateway": json.loads('''$GATEWAY'''),
    **json.loads('''$ERRORS''')
  }
}, indent=2))
PY
