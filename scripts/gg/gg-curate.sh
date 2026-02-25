#!/bin/bash
# Role O — Training Data Curator
# Trigger: Cron Sunday 23:00 Bangkok
# Purpose: ตรวจ TRAIN_CASES ทั้งหมด หา noise/dup/contradiction → report ให้ CC review

GG_ROLE="curate"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

log "=== GG Role O: Training Data Curator started ==="

# 1. Fetch TRAIN_CASES + FIELD_DIFFS
log "Fetching TRAIN_CASES from Sheets..."
TRAIN_CASES=$(fetch_sheet "TRAIN_CASES")
FIELD_DIFFS=$(fetch_sheet "FIELD_DIFFS")

CASE_COUNT=$(echo "$TRAIN_CASES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "?")
log "Found $CASE_COUNT TRAIN_CASES"

if [ "$CASE_COUNT" = "0" ] || [ "$TRAIN_CASES" = "[]" ]; then
  log "No data to curate — skipping"
  notify "O" "⏭️ Curation skipped — no TRAIN_CASES data yet"
  exit 0
fi

# 2. Build prompt
PROMPT="You are an OCR Training Data Curator for a Thai invoice OCR system.

Review the following TRAIN_CASES and FIELD_DIFFS data, then produce a curation report in markdown format.

TRAIN_CASES (JSON):
$TRAIN_CASES

FIELD_DIFFS (JSON):
$FIELD_DIFFS

Analyze and report:
1. **Duplicates** — cases with same invoice/vendor but different corrections (conflicting labels)
2. **Noise** — cases where the 'correction' looks wrong or inconsistent with others
3. **Low Quality** — cases missing critical fields (doc_type, vendor_tax_id, or corrections empty)
4. **Patterns worth keeping** — the most reliable and consistent correction patterns
5. **Recommended actions** — which case_ids to keep, flag, or remove

Format output as:
# GG Training Data Curation Report
**Date:** $DATE_TAG
**Total cases analyzed:** $CASE_COUNT

## Duplicates Found
...

## Noise / Inconsistencies
...

## Low Quality Cases
...

## High-Quality Patterns (Keep These)
...

## Recommended Actions
| case_id | action | reason |
|---------|--------|--------|
...

## Summary for CC
(1-paragraph summary of data quality + what needs manual review)"

# 3. Run GG
log "Running Gemini analysis..."
OUTPUT=$(gg_run "$PROMPT") || {
  log_error "Gemini CLI failed"
  notify "O" "❌ Curation FAILED — see gg-error.log"
  exit 1
}

# 4. Save report
FILENAME="${DATE_TAG}-curation.md"
FILEPATH=$(save_report "$FILENAME" "$OUTPUT")

# 5. Notify CC
notify "O" "✅ Curation report ready: $FILENAME — review before Monday's synthesizer runs" "$FILEPATH"

log "=== Role O complete: $FILEPATH ==="
