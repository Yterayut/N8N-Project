#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"
cd "$ROOT_DIR"

pattern='SpreadsheetApp\.openById|appendRow\(|deleteRow\(|setValues\(|setValue\(|insertRow'

echo "== PAY write-path audit =="
echo "root: $(pwd)"
echo

echo "## Canonical writer"
rg -n "$pattern" apps-script/pay-finance -g '*.js' || true
echo

echo "## Non-canonical candidates"
rg -n "$pattern" PAY .tmp workflow_patches backups scripts archive -g '*.js' \
  | rg -v '^apps-script/pay-finance/' || true
echo

echo "## Verdict"
echo "- Allowed direct sheet writes should exist only in apps-script/pay-finance/Code.js"
echo "- Hits in archive/.tmp/backups are snapshot or temp unless explicitly promoted"
echo "- Hits in active source paths outside canonical source are violations"
