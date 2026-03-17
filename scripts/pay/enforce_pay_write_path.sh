#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
cd "$ROOT_DIR"

pattern='SpreadsheetApp\.openById|appendRow\(|deleteRow\(|setValues\(|setValue\(|insertRow'

# Only active source paths should be checked here.
# Snapshot / backup / temp paths are intentionally excluded.
violations="$(
  rg -n "$pattern" apps-script PAY scripts -g '*.js' \
    | rg -v '^apps-script/pay-finance/Code\.js:' \
    | rg -v '^scripts/gas-prompts-crud/' \
    || true
)"

if [[ -n "$violations" ]]; then
  echo "PAY write-path enforcement failed"
  echo
  echo "$violations"
  exit 1
fi

echo "PAY write-path enforcement passed"
