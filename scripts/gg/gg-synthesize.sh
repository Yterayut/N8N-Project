#!/bin/bash
# Role C — Knowledge Synthesizer
# Trigger: Cron Monday 08:00 Bangkok (after Sunday curation)
# Purpose: วิเคราะห์ TRAIN_CASES → propose runtime rules ให้ CC review

GG_ROLE="synthesize"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

log "=== GG Role C: Knowledge Synthesizer started ==="

# Check if curation report exists from last night
CURATION_REPORT="$REPORTS_DIR/${DATE_TAG}-curation.md"
PREV_CURATION=$(ls "$REPORTS_DIR"/*-curation.md 2>/dev/null | tail -1 || echo "")
CURATION_CONTEXT=""
if [ -n "$PREV_CURATION" ]; then
  CURATION_CONTEXT=$(cat "$PREV_CURATION")
  log "Using curation report: $PREV_CURATION"
fi

# 1. Fetch all relevant Sheets data
log "Fetching data from Sheets..."
TRAIN_CASES=$(fetch_sheet "TRAIN_CASES")
FIELD_DIFFS=$(fetch_sheet "FIELD_DIFFS")
CURRENT_RULES=$(fetch_sheet "OCR_KM_RUNTIME_RULES")

CASE_COUNT=$(echo "$TRAIN_CASES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "?")
log "Analyzing $CASE_COUNT training cases..."

if [ "$CASE_COUNT" = "0" ] || [ "$TRAIN_CASES" = "[]" ]; then
  log "Insufficient data — need ≥3 cases per pattern to generate rules"
  notify "C" "⏭️ Synthesizer skipped — insufficient TRAIN_CASES (need ≥3 per pattern)"
  exit 0
fi

# 2. Build prompt
PROMPT="You are an OCR Knowledge Synthesizer for a Thai invoice OCR system.
Your job: analyze training data and propose NEW runtime rules to improve OCR accuracy.

## Current Runtime Rules (already active — do NOT re-propose these):
$CURRENT_RULES

## Training Cases (corrections made by humans):
$TRAIN_CASES

## Field Differences (what OCR got wrong vs ground truth):
$FIELD_DIFFS

## Curation Context (data quality notes from last Sunday):
$CURATION_CONTEXT

## Your Task
Generate runtime rule proposals following this format exactly (JSON array):

\`\`\`json
[
  {
    \"rule_id\": \"rr_proposed_001\",
    \"priority\": 50,
    \"doc_type\": \"*\",
    \"vendor_tax_id\": \"*\",
    \"scope\": \"post_normalize\",
    \"rule_type\": \"field_default\",
    \"rule_key\": \"field_name\",
    \"rule_value\": {\"field\": \"field_name\", \"default\": \"value\"},
    \"description\": \"Why this rule was proposed\",
    \"evidence\": \"How many cases support this (e.g. 5/7 cases)\",
    \"confidence\": \"high/medium/low\",
    \"approved_by\": \"GG (pending CC review)\"
  }
]
\`\`\`

Rules for proposing:
- Only propose rules supported by ≥3 cases
- Only rule_types: field_default, skip_validation (field_format = placeholder, don't use)
- Confidence: high=≥5 consistent cases, medium=3-4 cases, low=<3
- Do NOT propose rules that conflict with current active rules

After the JSON, write:
# Analysis Summary
**Date:** $DATE_TAG
**Cases analyzed:** $CASE_COUNT

## Top Error Patterns
(top 5 fields that are corrected most often + frequency)

## Rules Proposed: X
(summary table with rule_id, confidence, evidence)

## Rules NOT proposed (and why)
(patterns seen but insufficient evidence or conflicting)

## Recommendation for CC
(1 paragraph: what to activate first, what to monitor)"

# 3. Run GG
log "Running Gemini synthesis..."
OUTPUT=$(gg_run "$PROMPT") || {
  log_error "Gemini CLI failed"
  notify "C" "❌ Synthesis FAILED — see gg-error.log"
  exit 1
}

# 4. Save proposal
FILENAME="${DATE_TAG}-runtime-rules.md"
FILEPATH=$(save_proposal "$FILENAME" "$OUTPUT")

# 5. Notify CC
notify "C" "✅ Runtime rules proposal ready: $FILENAME — review + approve before activating in sheet" "$FILEPATH"

log "=== Role C complete: $FILEPATH ==="
