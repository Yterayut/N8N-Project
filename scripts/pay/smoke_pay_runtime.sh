#!/usr/bin/env bash
set -euo pipefail

PAY_GAS_EXEC_URL="${PAY_GAS_EXEC_URL:-https://script.google.com/macros/s/AKfycbz1_NiIQDVcEHE-byhCCifZ7mxuuJgQCWWWUyHrZoSi920APhRviGkLEBwMzYN9Kt1qKQ/exec}"
PAY_API_SHARED_SECRET="${PAY_API_SHARED_SECRET:-Marn2530}"
PAY_DUPLICATE_REF_ID="${PAY_DUPLICATE_REF_ID:-C20260316607516382771}"
PAY_SMOKE_ADD="${PAY_SMOKE_ADD:-0}"
PAY_SMOKE_ADD_REF_ID="${PAY_SMOKE_ADD_REF_ID:-SMOKE-ADD-$(date +%Y%m%d%H%M%S)}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

call() {
  local name="$1"
  local url="$2"
  local outfile="$tmpdir/$name.json"
  curl -sS -L "$url" > "$outfile"
  python3 - "$name" "$outfile" <<'PY'
import json, sys
name = sys.argv[1]
path = sys.argv[2]
with open(path, 'r', encoding='utf-8') as fh:
    data = json.load(fh)
print(f"[{name}] status={data.get('status')} success={data.get('success')}")
print(json.dumps(data, ensure_ascii=False, indent=2))
PY
}

assert_status() {
  local name="$1"
  local expected="$2"
  local outfile="$tmpdir/$name.json"
  python3 - "$expected" "$outfile" <<'PY'
import json, sys
expected = sys.argv[1]
path = sys.argv[2]
with open(path, 'r', encoding='utf-8') as fh:
    data = json.load(fh)
actual = data.get('status')
if actual != expected:
    raise SystemExit(f"expected status={expected}, got status={actual}")
PY
}

echo "== PAY runtime smoke =="
echo "endpoint: $PAY_GAS_EXEC_URL"
echo "duplicate ref: $PAY_DUPLICATE_REF_ID"
echo "add enabled: $PAY_SMOKE_ADD"
echo

if [[ "$PAY_SMOKE_ADD" == "1" ]]; then
  call add "${PAY_GAS_EXEC_URL}?endpoint=ingestSlip&api_key=${PAY_API_SHARED_SECRET}&date=2026-03-17&time=14:20&transaction_type=expense&amount=1&category=Food&sender_name=SMOKE_OWNER&sender_bank=SMOKE_BANK&receiver_name=SMOKE_ADD_CANONICAL&receiver_bank=SMOKE_BANK&ref_id=${PAY_SMOKE_ADD_REF_ID}&execution_id=SMOKE-ADD-$(date +%s)&request_id=SMOKE-ADD-REQ-$(date +%s)"
  assert_status add ok

  call add_find "${PAY_GAS_EXEC_URL}?endpoint=findByRefId&api_key=${PAY_API_SHARED_SECRET}&ref_id=${PAY_SMOKE_ADD_REF_ID}"
  assert_status add_find ok
fi

call unauthorized "${PAY_GAS_EXEC_URL}?endpoint=ingestSlip&api_key=WRONGKEY&date=2026-03-17&time=13:30&transaction_type=expense&amount=10&receiver_name=SMOKE_UNAUTH&ref_id=SMOKE-UNAUTH-20260317"
assert_status unauthorized unauthorized

call validation "${PAY_GAS_EXEC_URL}?endpoint=ingestSlip&api_key=${PAY_API_SHARED_SECRET}&date=2026-03-17&time=13:31&transaction_type=expense&receiver_name=SMOKE_VALIDATION&ref_id=SMOKE-VALIDATION-20260317"
assert_status validation validation_error

call duplicate "${PAY_GAS_EXEC_URL}?endpoint=ingestSlip&api_key=${PAY_API_SHARED_SECRET}&date=2026-03-16&time=16:35&transaction_type=expense&amount=187&category=Shopping&sender_name=%E0%B8%99%E0%B8%B2%E0%B8%A2%E0%B8%98%E0%B8%B5%E0%B8%A3%E0%B8%A2%E0%B8%B8%E0%B8%97%E0%B8%98%20h***&sender_bank=Krungthai&receiver_name=Shopee&ref_id=${PAY_DUPLICATE_REF_ID}&execution_id=SMOKE-DUP-$(date +%s)"
assert_status duplicate duplicate

call findByRefId "${PAY_GAS_EXEC_URL}?endpoint=findByRefId&api_key=${PAY_API_SHARED_SECRET}&ref_id=${PAY_DUPLICATE_REF_ID}"
assert_status findByRefId ok

echo
echo "PAY runtime smoke passed"
