# OCR Phase 3: Feedback Loop + Accuracy Engine

Updated: 2026-02-19
Target workflow: `up1n75qEhbsXswii` (`test-workflow`)

## Scope (Phase 3)

1. Persist prediction metadata for training/analysis.
2. Add correction ingestion endpoint from Admin UI.
3. Build diff between OCR prediction and admin-corrected JSON.
4. Store reusable examples by `vendor/layout/doc_type`.
5. Produce weekly field-level metrics from prediction/correction pairs.
6. Use few-shot examples in OCR prompt assembly (when feedback store is available).

## Data Contracts

### `OCR_PREDICTIONS`

Recommended columns:
- `document_id`
- `request_id`
- `created_at_iso`
- `doc_type`
- `doc_type_confidence`
- `decision`
- `confidence`
- `status`
- `source_file`
- `model_version`
- `pred_json`
- `validation_errors_json`
- `critical_error_count`
- `used_reask`

### `OCR_CORRECTIONS`

Recommended columns:
- `correction_id`
- `document_id`
- `request_id`
- `reviewer_id`
- `reviewed_at_iso`
- `doc_type`
- `vendor_hint`
- `layout_hint`
- `pred_json`
- `final_json`
- `diff_json`
- `changed_fields_count`

### `OCR_EXAMPLES`

Recommended columns:
- `example_key` (e.g. `ptt_tax_invoice_v1`)
- `doc_type`
- `vendor_hint`
- `layout_hint`
- `input_features_json`
- `gold_json`
- `active`
- `updated_at_iso`
- `source_document_id`

## Endpoints (Phase 3)

1. OCR inference endpoint (existing): `POST /webhook/ocr-dev`
2. Correction ingestion endpoint (new): `POST /webhook/ocr-feedback`
3. Feedback endpoint auth: require `x-api-key` (`OCR_FEEDBACK_API_KEY` or fallback `OCR_SHARED_API_KEY`)

## Runtime Integration (Completed)

1. `ocr-dev` flow now attempts to read examples from `OCR_EXAMPLES` via `OCR_FEEDBACK_API_URL`.
2. If feedback API is unavailable, flow continues without few-shot (no hard fail).
3. Selected examples are appended to extraction prompt as reference-only section.

## Test (End-to-End)

### A) Auto script (recommended)

```bash
export OCR_BASE_URL="https://YOUR_NGROK_OR_DOMAIN"
export OCR_API_KEY="YOUR_OCR_SHARED_API_KEY"
export OCR_FEEDBACK_API_KEY="YOUR_OCR_FEEDBACK_API_KEY" # optional, defaults to OCR_API_KEY in script
export OCR_TEST_FILE="/absolute/path/to/your-bill.pdf"

bash scripts/ocr/test_phase3_e2e.sh
```

Expected:
1. OCR returns `200` or `202`.
2. Response includes `document_id` and `request_id`.
3. Feedback endpoint returns `200` with `success: true`.

### B) Manual steps

1. OCR call:

```bash
curl -X POST "$OCR_BASE_URL/webhook/ocr-dev" \
  -H "x-api-key: $OCR_API_KEY" \
  -F "files=@$OCR_TEST_FILE"
```

2. Build feedback payload from OCR response:

```bash
node scripts/ocr/build_feedback_payload.js ocr_response.json > feedback_payload.json
```

3. Send correction:

```bash
curl -X POST "$OCR_BASE_URL/webhook/ocr-feedback" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $OCR_FEEDBACK_API_KEY" \
  --data @feedback_payload.json
```

## Metrics Utilities

1. JSON diff (`pred` vs `final`)

```bash
node scripts/ocr/feedback_diff.js pred.json final.json
```

2. Field-level metrics from correction pairs

```bash
node scripts/ocr/generate_phase3_metrics.js feedback_pairs.json
```

## Correction Payload

```json
{
  "document_id": "doc_...",
  "request_id": "1771...",
  "doc_type": "fuel",
  "vendor_hint": "PTT",
  "layout_hint": "tax_invoice_v1",
  "reviewer_id": "admin01",
  "ocr_pred_json": { "bills": [] },
  "admin_final_json": { "bills": [] }
}
```

## Phase 3 Rollout Steps

1. Add non-blocking prediction log branch from OCR finalize node.
2. Add correction webhook branch (validate -> diff -> save -> respond).
3. Keep all new save operations non-blocking (`continueOnFail`) to avoid impacting OCR SLA.
4. Enable external save URL via env:
- `OCR_FEEDBACK_API_URL` (Apps Script/Webhook receiver for CRUD)
5. Schedule metrics script weekly.
6. Enable feedback auth key:
- `OCR_FEEDBACK_API_KEY` (fallback: `OCR_SHARED_API_KEY`)

## Guardrails

1. No change to core OCR response path semantics.
2. One request still returns one response for `/ocr-dev`.
3. If feedback persistence is unavailable, OCR response must still succeed.
4. All correction payloads must carry both prediction and final JSON.
5. `/ocr-feedback` must reject unauthorized or invalid payloads with explicit JSON error codes.
