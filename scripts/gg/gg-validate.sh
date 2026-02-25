#!/bin/bash
# Role J — OCR Output Validator
# Trigger: n8n Execute Command node หลัง OCR batch หรือ CC รันเอง
# Purpose: เปรียบเทียบ PDF จริง vs OCR JSON output → confidence score + flag

GG_ROLE="validate"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

PDF_PATH="${1:-}"
JSON_PATH="${2:-}"
EXEC_ID="${3:-unknown}"

if [ -z "$PDF_PATH" ] || [ -z "$JSON_PATH" ]; then
  echo "Usage: $0 <pdf_path> <ocr_json_path> [exec_id]"
  echo "Example: $0 /tmp/invoice.pdf /tmp/ocr-result.json 151800"
  exit 1
fi

if [ ! -f "$PDF_PATH" ]; then log_error "PDF not found: $PDF_PATH"; exit 1; fi
if [ ! -f "$JSON_PATH" ]; then log_error "JSON not found: $JSON_PATH"; exit 1; fi

PDF_DIR=$(dirname "$PDF_PATH")
OCR_RESULT=$(cat "$JSON_PATH")
log "=== GG Role J: OCR Output Validator ==="
log "PDF: $PDF_PATH | JSON: $JSON_PATH | ExecID: $EXEC_ID"

PROMPT="You are an OCR Quality Validator for Thai invoices.
Compare the actual invoice (attached file) against the OCR-extracted JSON.
Score each field and identify errors.

## OCR Output (what the system extracted):
$OCR_RESULT

## Invoice File: $PDF_PATH
(Read the file to see what's actually on the invoice)

## Your Task
For each field in the OCR output, validate against the actual invoice.

Return a JSON report:
{
  \"validation_id\": \"val_${EXEC_ID}_$(date +%s)\",
  \"exec_id\": \"$EXEC_ID\",
  \"validated_at\": \"$TIMESTAMP\",
  \"overall_confidence\": \"high|medium|low\",
  \"overall_score\": 0.0,
  \"pass\": true,
  \"fields\": [
    {
      \"field_name\": \"invoice_number\",
      \"ocr_value\": \"extracted value\",
      \"actual_value\": \"what's on the invoice\",
      \"match\": true,
      \"confidence\": 0.95,
      \"issue\": null
    }
  ],
  \"flags\": [
    {
      \"severity\": \"high|medium|low\",
      \"field\": \"field_name\",
      \"issue\": \"description of what's wrong\",
      \"recommendation\": \"what to fix\"
    }
  ],
  \"summary\": \"1-sentence summary\",
  \"needs_human_review\": false,
  \"human_review_reason\": null
}

Scoring:
- overall_score: 0.0-1.0 (1.0 = perfect match)
- pass: true if overall_score >= 0.8
- Flag severity: high = wrong amount/tax_id, medium = wrong date/name, low = formatting
- needs_human_review: true if any high severity flags"

# รัน Gemini พร้อม file access
log "Running Gemini validation..."
OUTPUT=$(gemini \
  --include-directories "$PDF_DIR" \
  -p "$PROMPT" \
  --output-format text \
  --yolo \
  2>>"$LOGS_DIR/gg-error.log") || {
  log_error "Validation failed for exec $EXEC_ID"
  exit 1
}

# Parse JSON
JSON_OUTPUT=$(echo "$OUTPUT" | python3 -c "
import sys, re, json
text = sys.stdin.read()
match = re.search(r'\{[\s\S]*\}', text)
if match:
    try:
        parsed = json.loads(match.group())
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
    except:
        print(text)
else:
    print(text)
" 2>/dev/null || echo "$OUTPUT")

# Save report
FILENAME="${DATE_TAG}-validation-${EXEC_ID}.json"
FILEPATH=$(save_report "$FILENAME" "$JSON_OUTPUT")

# Check if needs human review
NEEDS_REVIEW=$(echo "$JSON_OUTPUT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print('YES' if d.get('needs_human_review') else 'NO')
except:
    print('UNKNOWN')
" 2>/dev/null || echo "UNKNOWN")

OVERALL_SCORE=$(echo "$JSON_OUTPUT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get('overall_score', '?'))
except:
    print('?')
" 2>/dev/null || echo "?")

if [ "$NEEDS_REVIEW" = "YES" ]; then
  notify "J" "⚠️ OCR validation exec $EXEC_ID — score: $OVERALL_SCORE — NEEDS HUMAN REVIEW" "$FILEPATH"
else
  notify "J" "✅ OCR validation exec $EXEC_ID — score: $OVERALL_SCORE — PASSED" "$FILEPATH"
fi

log "=== Role J complete: score=$OVERALL_SCORE needs_review=$NEEDS_REVIEW ==="
echo "$FILEPATH"
