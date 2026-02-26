# OCR Phase 0 Baseline

Generated at: 2026-02-18T16:58:35.564Z
Workflow: `up1n75qEhbsXswii` (`test-workflow`)
DB: `.n8n-dev/.n8n/database.sqlite`

## Snapshot Freeze
- Freeze file: `backups/workflow-freeze/up1n75qEhbsXswii-20260218-235835.json`
- Checksum file: `backups/workflow-freeze/up1n75qEhbsXswii-20260218-235835.sha256`
- SHA256: `b857626bb31ef4d6c1f2d26f0c72fefc33da1abc19675b08da05d32812b268eb`

## Execution Baseline (Latest 150 runs)

```json
{
  "window": 150,
  "execution_count": 150,
  "by_status": {
    "success": 149,
    "canceled": 1
  },
  "sec": {
    "min": 0.063,
    "p50": 0.845,
    "p95": 43.231,
    "max": 96.673,
    "avg": 6.323400000000001
  },
  "ocr_like_filter": "sec >= 10",
  "ocr_like_count": 20
}
```

## OCR Dataset Baseline (from parsed runs in latest window)

```json
{
  "parsed_execution_count": 19,
  "total_bills": 96,
  "bill_type_distribution": {
    "electricity": 29,
    "fuel": 13,
    "fleet": 3,
    "parking": 12,
    "mixed": 32,
    "unknown": 7
  },
  "parse_status": {
    "success": 19
  }
}
```

## Field Error Pattern (rule-based)

```json
{
  "vendor_tax_id": {
    "empty": 31,
    "invalid_format": 0
  },
  "invoice_number": {
    "empty": 6
  },
  "invoice_date_th": {
    "empty": 0,
    "invalid_format": 0
  },
  "total": {
    "empty": 0,
    "non_numeric": 0,
    "non_positive": 0
  },
  "meter_number": {
    "present": 7,
    "invalid_length": 2
  },
  "electricity_ref": {
    "present": 23,
    "invalid_length": 2
  },
  "card_number": {
    "present": 11,
    "non_digit": 0,
    "short_length": 0
  },
  "vehicle_plate": {
    "present": 33,
    "empty": 0
  },
  "odometer": {
    "present": 33,
    "non_numeric": 0
  }
}
```

## Critical Empty-rate (current baseline)

```json
{
  "vendor_tax_id": 0.3229166666666667,
  "invoice_number": 0.0625,
  "invoice_date_th": 0,
  "total": 0
}
```

## Observed Risks (from latest test evidence)
1. OCR parsed executions are sparse relative to total webhook runs in the same window; non-OCR traffic is mixed in this workflow.
2. vendor_tax_id empty/invalid remains the top critical-field risk.
3. Type-specific fields (meter_number, electricity_ref, card_number, odometer) still show format drift and require strict normalize+validate in Phase 2.
4. Some bills are classified as mixed; explicit classifier + type routing is still required before prompt execution.

## Phase 0 Deliverables
- [x] Baseline metrics captured from latest execution data
- [x] Active workflow frozen with checksum
- [x] Canonical schema spec defined (see docs/ocr/schema-standards-v1.md)
