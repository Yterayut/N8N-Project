#!/bin/bash
# Role E — Ground Truth Generator
# Trigger: On-demand — CC รัน: ./gg-groundtruth.sh /path/to/invoice.pdf
# Purpose: อ่าน PDF → สร้าง ground_truth.json สำหรับ T029D benchmark

GG_ROLE="groundtruth"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

PDF_PATH="${1:-}"
if [ -z "$PDF_PATH" ] || [ ! -f "$PDF_PATH" ]; then
  echo "Usage: $0 <path_to_invoice.pdf>"
  echo "Example: $0 /tmp/invoice_001.pdf"
  exit 1
fi

PDF_BASENAME=$(basename "$PDF_PATH" .pdf)
log "=== GG Role E: Ground Truth Generator ==="
log "Processing: $PDF_PATH"

# Gemini CLI ใช้ --include-directories เพื่อให้ access ไฟล์
PDF_DIR=$(dirname "$PDF_PATH")

PROMPT="You are an OCR Ground Truth Generator for Thai invoices.
Read the invoice file carefully and extract ALL fields with high precision.
This output will be used as ground truth to benchmark OCR accuracy.

Invoice file: $PDF_PATH

Extract and return a JSON object with this exact structure:
{
  \"ground_truth_version\": \"1.0\",
  \"generated_by\": \"GG/Gemini\",
  \"generated_at\": \"$TIMESTAMP\",
  \"source_file\": \"$(basename "$PDF_PATH")\",
  \"requires_human_review\": true,
  \"confidence\": \"high|medium|low\",
  \"fields\": {
    \"doc_type\": \"invoice|receipt|tax_invoice|credit_note|other\",
    \"invoice_number\": \"exact string or null\",
    \"invoice_date\": \"YYYY-MM-DD or null\",
    \"vendor_name\": \"exact Thai/English string\",
    \"vendor_tax_id\": \"13-digit string or null\",
    \"vendor_address\": \"full address string or null\",
    \"buyer_name\": \"string or null\",
    \"buyer_tax_id\": \"string or null\",
    \"subtotal\": number_or_null,
    \"vat_rate\": \"7%|0%|null\",
    \"vat_amount\": number_or_null,
    \"total_amount\": number_or_null,
    \"currency\": \"THB|USD|other\",
    \"payment_method\": \"string or null\",
    \"line_items\": [
      {\"description\": \"string\", \"quantity\": number, \"unit_price\": number, \"amount\": number}
    ]
  },
  \"extraction_notes\": \"Any fields that were unclear or ambiguous\",
  \"human_review_required_fields\": [\"list of field names needing human verification\"]
}"

# รัน Gemini พร้อม file access
log "Running Gemini extraction (multimodal)..."
OUTPUT=$(gemini \
  --include-directories "$PDF_DIR" \
  -p "$PROMPT" \
  --output-format text \
  --yolo \
  2>>"$LOGS_DIR/gg-error.log") || {
  log_error "Gemini CLI failed for $PDF_PATH"
  exit 1
}

# Extract JSON จาก output
JSON_OUTPUT=$(echo "$OUTPUT" | python3 -c "
import sys, re, json
text = sys.stdin.read()
# หา JSON block
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

# Save output
FILENAME="${DATE_TAG}-groundtruth-${PDF_BASENAME}.json"
FILEPATH=$(save_proposal "$FILENAME" "$JSON_OUTPUT")

echo ""
echo "✅ Ground truth saved: $FILEPATH"
echo "⚠️  Human spot-check required (≥10% of fields) before using in benchmark"
log "=== Role E complete: $FILEPATH ==="
