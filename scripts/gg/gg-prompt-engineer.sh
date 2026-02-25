#!/bin/bash
# Role G — Auto Prompt Engineer
# Trigger: อัตโนมัติเมื่อ error rate > 20% (จาก n8n monitor) หรือ CC รันเอง
# Purpose: วิเคราะห์ failed cases → propose improved OCR prompt

GG_ROLE="prompt-engineer"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

log "=== GG Role G: Auto Prompt Engineer started ==="

# รับ error threshold จาก argument (default 20%)
ERROR_THRESHOLD="${1:-20}"

# 1. Fetch recent OCR_FEEDBACK (failed cases)
log "Fetching OCR_FEEDBACK for failed cases..."
FEEDBACK=$(fetch_sheet "OCR_FEEDBACK")
FIELD_DIFFS=$(fetch_sheet "FIELD_DIFFS")

# อ่าน current prompt จาก file ที่ CC เก็บไว้
CURRENT_PROMPT_FILE="$PROJECT_DIR/docs/gg/current-ocr-prompt.md"
CURRENT_PROMPT=""
if [ -f "$CURRENT_PROMPT_FILE" ]; then
  CURRENT_PROMPT=$(cat "$CURRENT_PROMPT_FILE")
fi

FAILED_COUNT=$(echo "$FEEDBACK" | python3 -c "
import sys,json
d=json.load(sys.stdin)
failed=[r for r in d if r.get('feedback_type') in ['incorrect','partial']]
print(len(failed))
" 2>/dev/null || echo "?")

log "Found $FAILED_COUNT failed/partial OCR cases"

# 2. Build prompt
PROMPT="You are an OCR Prompt Engineer for a Thai invoice processing system.
The system uses Google Gemini to extract structured data from Thai invoices.

## Current Error Rate trigger: ${ERROR_THRESHOLD}%+ failures detected

## Current OCR Prompt (what the system uses now):
${CURRENT_PROMPT:-[Not captured yet — see n8n workflow up1n75qEhbsXswii Code nodes]}

## Recent OCR Feedback (failures/corrections):
$FEEDBACK

## Field-level Differences (what was wrong):
$FIELD_DIFFS

## Your Task
1. Identify the TOP 3 error patterns causing the most failures
2. Diagnose WHY the current prompt fails for these patterns
3. Propose an improved prompt section targeting these failures
4. Provide before/after comparison

Format:
# OCR Prompt Engineering Report
**Date:** $DATE_TAG
**Error threshold triggered:** ${ERROR_THRESHOLD}%

## Top 3 Error Patterns
1. **[Field name]** — X% of failures
   Root cause: [why the prompt fails here]

2. ...

## Proposed Prompt Improvements

### Change 1: [Description]
**Before:**
\`\`\`
[current prompt section]
\`\`\`
**After:**
\`\`\`
[improved prompt section]
\`\`\`
**Expected impact:** [which error pattern this fixes]

### Change 2: ...

## A/B Test Recommendation
- Run new prompt on [N] test invoices before deploying
- Compare fields: [list of fields most affected]
- Success criteria: error rate drops below [X]%

## Risk Assessment
- Low/Medium/High — [reasoning]
- Rollback plan: [how to revert if worse]

## CC Decision Required
[ ] Approve changes → update prompt in n8n Code node
[ ] Reject → continue monitoring
[ ] Test further → specify what additional data needed"

# 3. Run GG
log "Running Gemini prompt analysis..."
OUTPUT=$(gg_run "$PROMPT") || {
  log_error "Gemini CLI failed"
  notify "G" "❌ Prompt engineering FAILED — see gg-error.log"
  exit 1
}

# 4. Save proposal
FILENAME="${DATE_TAG}-prompt-update.md"
FILEPATH=$(save_proposal "$FILENAME" "$OUTPUT")

# 5. Notify CC
notify "G" "⚠️ Error rate ${ERROR_THRESHOLD}%+ detected — prompt update proposal ready: $FILENAME" "$FILEPATH"

log "=== Role G complete: $FILEPATH ==="
