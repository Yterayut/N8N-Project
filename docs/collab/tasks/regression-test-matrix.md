# Regression Test Matrix (T002)

**Owner:** Codex  
**Scope:** OCR `test-workflow` regression checks after patches (P0/P1/P2 hotfixes)  
**References:** `docs/improve-by-claude-23-02-2026.md`, `docs/test-workflow-documentation.md`

## 1. Test Cases per Document Type

This section defines representative files, expected classification behavior, and key fields that must be correct per document type.

### 1.1 Fuel (`doc_type=fuel`)

| Template / Vendor | Sample Filename(s) | Expected `doc_type` | Expected Confidence (Target) | Key Fields That Must Be Correct |
|---|---|---:|---:|---|
| OR/PTTOR printed receipt/tax invoice | `PTT-OR.pdf`, `บิลน้ำมัน 3 Bill.pdf` (printed rows) | `fuel` | `>= 0.75` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, `list_detail[0].description`, `unit_price`, `quantity`, `amount` |
| OR/PTTOR handwritten matrix form | `PTT-เขียนมือ.pdf`, `บิลน้ำมัน 3 Bill.pdf` (handwritten rows) | `fuel` | `>= 0.70` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, row selection (`LPG/NGV` correct row), `unit_price/quantity` column mapping |
| Bangchak | `บางจาก.pdf`, `บางจาก01.pdf` | `fuel` | `>= 0.75` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, duplicate bill dedupe result |
| Shell / Shell station receipt | `shell.pdf` | `fuel` | `>= 0.70` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, parse `quantity/unit_price` from description pattern if OCR misses columns |
| Caltex | `caltex.pdf` | `fuel` | `>= 0.70` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, promo/warning tuning (no false `fuel_line_total_mismatch`) |
| PT-MAX | `PT-MAX.pdf` | `fuel` | `>= 0.70` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, free-item handling (`แถม...` should not cause false warnings) |
| Siam Gas / LPG | `สยามแก๊ส.pdf`, `gas.pdf` | `fuel` | `>= 0.65` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, derive `unit_price/quantity` from description patterns (`xxL,yyB/L`) |

### 1.2 Electricity (`doc_type=electricity`)

| Template / Provider | Sample Filename(s) | Expected `doc_type` | Expected Confidence (Target) | Key Fields That Must Be Correct |
|---|---|---:|---:|---|
| Multi-bill electricity statement | `บิลค่าไฟ.pdf` | `electricity` | `>= 0.75` | `bills_count`, `invoice_number` (per bill if present), `total`, `customer_name`, `list_detail` rows, no false FT zero-amount warnings |
| Electricity notice (single bill) | `ใบแจ้งค่าไฟ.pdf`, `ใบแจ้งค่าไฟ_02.pdf`, `ใบแจ้งค่าไฟ_04.pdf` | `electricity` | `>= 0.70` | `invoice_number`, `invoice_date_th`, `total`, `customer_name`, `address` |
| Electricity notice (batch/multi bills) | `ใบแจ้งค่าไฟ_03.pdf` | `electricity` | `>= 0.65` | `bills_count`, `invoice_number` consistency, `total` per bill, vendor identity fields (if present) |

### 1.3 Fleet Card (`doc_type=fleet_card`)

| Template / Vendor | Sample Filename(s) | Expected `doc_type` | Expected Confidence (Target) | Key Fields That Must Be Correct |
|---|---|---:|---:|---|
| Generic fleet card statement | `fleetcard.pdf` | `fleet_card` | `>= 0.70` | `bills_count`, `invoice_number`, `invoice_date_th`, `total`, line grouping |
| KTB fleet card | `บิลน้ำมัน_feedcard_02_KTB.pdf`, `บิลน้ำมัน_feedcard_03_KTB.pdf` | `fleet_card` | `>= 0.70` | `bills_count`, `invoice_number`, `invoice_date_th`, `total`, `list_detail` fuel rows |
| KBank fleet card (edge: missing quantity) | `บิลน้ำมัน_feedcard_04_kbank.pdf` | `fleet_card` | `>= 0.65` | `doc_type`, `bills_count`, `amount`, derive `quantity = amount / unit_price` when safe |

### 1.4 Parking (`doc_type=parking`)

| Template / Vendor | Sample Filename(s) | Expected `doc_type` | Expected Confidence (Target) | Key Fields That Must Be Correct |
|---|---|---:|---:|---|
| Airport/AOT parking receipt | (use sample from production set, e.g. Suvarnabhumi/AOT parking PDF) | `parking` | `>= 0.70` | `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`, `list_detail[0].description` parking fee |
| Standard parking slip | (any parking receipt fixture in regression set) | `parking` | `>= 0.65` | `invoice_date_th`, `total`, `description`, `amount` |

## 2. Test Scenarios (Regression Matrix)

Use this matrix after every patch to verify no regression in classification, extraction, validation, re-ask, and error handling.

| # | Scenario | Input | Expected HTTP Status | Expected decision | Expected confidence | Expected bills_count |
|---|---|---|---:|---|---|---:|
| 1 | Happy path - fuel OR/PTTOR printed | `PTT-OR.pdf` -> `POST /ocr-dev` | 200 | `needs_review` or `auto_pass` | `>=0.70` | 1 |
| 2 | Happy path - fuel handwritten OR matrix | `PTT-เขียนมือ.pdf` -> `POST /ocr-dev` | 200 | `needs_review` | `>=0.65` | 1 |
| 3 | Happy path - electricity single notice | `ใบแจ้งค่าไฟ_02.pdf` -> `POST /ocr-dev` | 200 | `needs_review` or `auto_pass` | `>=0.65` | 1 |
| 4 | Happy path - fleet_card KTB | `บิลน้ำมัน_feedcard_02_KTB.pdf` -> `POST /ocr-dev` | 200 | `needs_review` | `>=0.65` | `>=1` |
| 5 | Happy path - parking receipt | parking fixture -> `POST /ocr-dev` | 200 | `needs_review` or `auto_pass` | `>=0.65` | `>=1` |
| 6 | Parse error - corrupt PDF bytes | corrupt/invalid PDF -> `POST /ocr-dev` | 400 or 500* | `hard_fail` or N/A | `0` or omitted | 0 |
| 7 | Parse error - no pages PDF | `bad.pdf` (empty/no pages) -> `POST /ocr-dev` | 400 or 500* | `hard_fail` or N/A | `0` or omitted | 0 |
| 8 | Re-ask trigger - critical validation error | crafted fuel/electricity sample with bad tax/date from initial OCR (fixture) | 200 | `needs_review` | `>=0.50` | `>=1` |
| 9 | Re-ask fail - still invalid after repair | force Gemini re-ask to return invalid JSON/critical fields (mock/fixture) | 200 or 500** | `needs_review` / `hard_fail` | `<=0.88` | `>=0` |
| 10 | Duplicate bill detection in same response | `บางจาก01.pdf` | 200 | `needs_review` | `>=0.65` | 1 |
| 11 | Queue submit + process | `POST /ocr-queue` with 1-2 files, then worker run | 200 (submit), worker internal success | N/A (queue submit) | N/A | N/A |
| 12 | Multi-file upload (2-3 files) main endpoint | `POST /ocr-dev` multipart with 2-3 files | 200/422*** | `needs_review` or N/A | varies | varies |
| 13 | Oversized file >20MB | >20MB PDF/image -> `POST /ocr-dev` | 413 or 422**** | N/A | N/A | 0 |
| 14 | Wrong API key | valid file + wrong `x-api-key` | 401 | N/A | N/A | 0 |
| 15 | No file attached | `POST /ocr-dev` no multipart file | 422 | N/A | N/A | 0 |
| 16 | Admission denied / rate limited | saturate slots then call `/ocr-dev` | 429 or 503 | N/A | N/A | 0 |
| 17 | Fleet card missing quantity (round3 bug guard) | `บิลน้ำมัน_feedcard_04_kbank.pdf` | 200 | `needs_review` | `>=0.60` | `>=1` |
| 18 | Multi-bill mixed fuel page with 3 bills | `บิลน้ำมัน 3 Bill.pdf` | 200 | `needs_review` | `>=0.70` | 3 |

Notes:
- `*` Current implementation may wrap Gemini parse errors into `OCR_FAILED` with HTTP 400 or 500 depending on branch/path; treat body schema validation as primary gate.
- `**` Re-ask fail behavior must be re-verified after P1 patch (`Code (Apply Re-ask Result)` normalize/validate loop).
- `***` Multi-file on `/ocr-dev` behavior may depend on current file-split logic/path; if unsupported, expected result should be explicit `422`.
- `****` If file size guard is not implemented yet, current behavior may be 400/500/Gemini fail; once P2 done, lock expected to `413` or `422`.

## 3. Expected Output Format

The matrix below uses the **current production OCR response style** (wrapper with `success/status/decision/data`) as observed in live tests.

### 3.1 Success Response (`/ocr-dev`)

```json
{
  "success": true,
  "document_id": "doc_1771737187980-2f1a51c1bd3d1",
  "request_id": "1771737187980-2f1a51c1bd3d1",
  "status": "success",
  "decision": "auto_pass|needs_review|hard_fail",
  "confidence": 0.78,
  "doc_type": "fuel|electricity|fleet_card|parking|mixed|unknown",
  "doc_type_confidence": 0.78,
  "doc_type_reason": "filename_hint_fuel|content_hint_fuel|no_hint|...",
  "used_reask": false,
  "bills_count": 1,
  "validation_errors": [],
  "message": "OK",
  "data": {
    "bills": [
      {
        "vendor_tax_id": "0107561000013",
        "invoice_number": "100628",
        "invoice_date_th": "19/05/2568",
        "customer_name": "บริษัท...",
        "address": "1768 ...",
        "currency": "THB",
        "total": 1122.84,
        "list_detail": [
          {
            "description": "ผลิตภัณฑ์ GASOHOL 91 ...",
            "unit_price": 33.21,
            "quantity": 34.327,
            "amount": 1140
          }
        ]
      }
    ]
  }
}
```

### 3.2 Unauthorized (`401`)

```json
{
  "success": false,
  "error_code": "UNAUTHORIZED",
  "message": "Invalid API key",
  "status": "error",
  "data": {
    "bills": []
  }
}
```

### 3.3 No File Attached (`422`)

```json
{
  "success": false,
  "error_code": "PARSE_ERROR",
  "message": "No file uploaded",
  "status": "error",
  "request_id": "",
  "data": {
    "bills": []
  }
}
```

### 3.4 Admission Denied / Busy (`429` or `503`)

```json
{
  "success": false,
  "error_code": "SYSTEM_BUSY",
  "message": "OCR queue is busy. Please retry.",
  "retry_after_sec": 15,
  "status": "error",
  "data": {
    "bills": []
  }
}
```

### 3.5 OCR/Gemini Failure (`400`/`500` wrapped as OCR_FAILED)

```json
{
  "success": false,
  "error_code": "OCR_FAILED",
  "message": "400 - \"{...Gemini error...}\"",
  "request_id": "",
  "status": "error",
  "data": {
    "bills": []
  }
}
```

### 3.6 Queue Submit Success (`/ocr-queue`)

Current queue submit path may return a lightweight acceptance payload. Canonical target shape for testing:

```json
{
  "success": true,
  "status": "accepted",
  "message": "file received",
  "queued_files": 2
}
```

### 3.7 Feedback Success (`/ocr-feedback`) [for future regression]

```json
{
  "success": true,
  "status": "accepted",
  "feedback_id": "fbk_...",
  "ingestion_id": "ing_...",
  "message": "feedback accepted for learning pipeline"
}
```

## 4. Pass/Fail Criteria

### 4.1 Confidence Thresholds (Regression Gates)

Use thresholds by `doc_type` to avoid overfitting one strict threshold across all templates.

| doc_type | Minimum Pass Confidence (Happy Path) | Warning Threshold | Fail Threshold |
|---|---:|---:|---:|
| `fuel` | `>= 0.70` | `0.55 - 0.69` (manual review OK) | `< 0.55` |
| `electricity` | `>= 0.70` | `0.55 - 0.69` | `< 0.55` |
| `fleet_card` | `>= 0.65` | `0.50 - 0.64` | `< 0.50` |
| `parking` | `>= 0.65` | `0.50 - 0.64` | `< 0.50` |

Rules:
- Confidence below minimum does **not** automatically fail the test if `decision=needs_review` and extraction is otherwise correct.
- Confidence inflation checks: if re-ask occurs, confidence must remain plausible (no blind floor inflation without evidence).

### 4.2 Mandatory Fields per `doc_type`

#### Fuel
Mandatory (per bill):
- `vendor_tax_id` (13 digits when available on source)
- `invoice_number` (unless source truly missing)
- `invoice_date_th`
- `total`
- `list_detail` with at least one meaningful row (`description` and `amount` > 0, or recoverable fuel row)

#### Electricity
Mandatory (per bill):
- `invoice_date_th`
- `total`
- `customer_name` or `address` (at least one for notice-type docs)
- `invoice_number` if clearly present on source template

#### Fleet Card
Mandatory (per bill):
- `invoice_number`
- `invoice_date_th`
- `total`
- `list_detail` rows present
- For fuel-like line items: `amount` must be present; `quantity` may be derived if `unit_price` exists

#### Parking
Mandatory (per bill):
- `invoice_date_th`
- `total`
- `list_detail[0].description`
- `amount`

### 4.3 Acceptable `validation_errors` Counts

| Case Type | Acceptable `validation_errors` |
|---|---|
| Happy path (stable templates) | `0` preferred, `<=1` warning only if known non-critical |
| Handwritten fuel forms | `<=2` warnings acceptable if critical fields correct |
| Electricity multi-bill/statement | `<=3` warnings acceptable if known FT/zero-line patterns and no critical misses |
| Re-ask trigger case | `>=1` before re-ask is expected |
| Re-ask fail case | `>=1` after re-ask expected (test passes if response shape and decision are correct) |

Hard fail conditions (test fail):
- Wrong HTTP status for scenario
- Response schema missing required top-level keys (`success`, `status`, `data`)
- Critical field extracted incorrectly in a happy-path fixture with established ground truth
- Duplicate dedupe test returns duplicate count when canonical expected is 1
- Fleet card round3 regression/crash (exception path, empty body, or 500 without wrapped error JSON)

## 5. Regression Checklist (Post-Patch)

Use this after every patch on OCR workflow, validator, queue logic, re-ask logic, Telegram formatting, or error handling.

### 5.1 Core API Health
- [ ] `/ocr-dev` returns success JSON for `PTT-OR.pdf`
- [ ] `/ocr-dev` returns success JSON for one electricity sample
- [ ] `/ocr-dev` returns success JSON for one fleet card sample
- [ ] `/ocr-dev` returns 401 JSON for wrong API key
- [ ] `/ocr-dev` returns 422 JSON for missing file
- [ ] `/ocr-dev` returns wrapped `OCR_FAILED` JSON for `bad.pdf` (no empty body)
- [ ] Admission denied path returns 429/503 JSON with `retry_after_sec`

### 5.2 Classification Regression
- [ ] `PTT-OR.pdf` classified as `fuel`
- [ ] `บิลค่าไฟ_02.pdf` classified as `electricity`
- [ ] `บิลน้ำมัน_feedcard_02_KTB.pdf` classified as `fleet_card`
- [ ] Parking fixture classified as `parking`
- [ ] Non-fuel shop receipt in station context (e.g. `shell_02.pdf`) does not incorrectly trigger `fuel` if excluded by scope/rules

### 5.3 Extraction / Validation Regression
- [ ] OR/PTTOR printed template: total from summary remains correct
- [ ] OR handwritten template: `unit_price`/`quantity` column swap fix still works
- [ ] `บางจาก01.pdf` dedupe still returns 1 bill
- [ ] `บางจาก.pdf` phantom/blank bill is pruned
- [ ] `shell.pdf` parses `unit_price/quantity` from description pattern
- [ ] `สยามแก๊ส.pdf` parses line item from LPG pattern (if fixture retained)
- [ ] `PT-MAX.pdf` free-item row does not create false `line_amount_missing`
- [ ] `caltex.pdf` promo rows do not create false `fuel_line_total_mismatch`
- [ ] `บิลค่าไฟ.pdf` FT zero-amount rows do not create false warnings
- [ ] Fleet card missing quantity edge case does not crash and can derive quantity when safe

### 5.4 Re-ask / Queue / Error Flow
- [ ] Re-ask trigger path still returns structured response (not empty body)
- [ ] Re-ask success path output is normalized/validated (after P1 fix)
- [ ] Re-ask failure path returns structured error or `needs_review` response (not crash)
- [ ] `/ocr-queue` submit accepts files and returns queue acknowledgment
- [ ] Queue worker failure marks item `error` (not `done`) after retry exhaustion (after P1 fix)

### 5.5 Observability / Notifications
- [ ] Telegram success notification text renders (not `undefined`)
- [ ] Telegram failed notification text renders (not `undefined`)
- [ ] Telegram fallback path renders meaningful default text
- [ ] Daily Summary (20:30) workflow still executes and sends message

### 5.6 Documentation / KM Hygiene
- [ ] `docs/ocr/loop-learning-log.md` updated for new behavior changes
- [ ] `OCR_TRAIN_CASES` entries created for newly tested real files
- [ ] `OCR_KM_LESSONS` updated for incidents/patches
- [ ] `OCR_RULE_CHANGELOG` updated for rule changes
- [ ] Sanitized workflow export updated if workflow logic changed

## 6. Phase 2 Scenarios (Scale & Safety)

Use this section specifically after Phase 2 patches (T007/T008/T009/T011/T012/T013).

| # | Scenario | Input / Setup | Expected Result |
|---|---|---|---|
| P2-1 | T007 main path rejects file >20MB | `POST /ocr-dev` with PDF `> OCR_MAX_FILE_BYTES` (default >20MB) | HTTP `413` or `422`; structured JSON error; no OCR processing starts |
| P2-2 | T007 main path accepts file exactly 20MB | `POST /ocr-dev` with file size exactly `20971520` bytes | Request passes file-size guard (continues to normal OCR flow); no size-limit error |
| P2-3 | T007 queue path rejects oversized file | `POST /ocr-queue` (or queue submit path) with one file >20MB | Queue path rejects file before fan-out/upload; structured error/failed queue item status |
| P2-4 | T008 sanitize Gemini error response | Trigger Gemini/API failure (e.g. unsupported/corrupt file) | Client-facing error message contains only safe generic text (`Failed to process the document. Please try again.`) and **does not** include raw Gemini JSON/details |
| P2-5 | T009 safe few-shot truncation at example boundary | Seed few-shot examples so combined text > 6000 chars with 3+ examples | Selected few-shot prompt contains only complete examples; no cut/malformed JSON/example fragment |
| P2-6 | T011 re-ask HTTP failure continues workflow | Force `HTTP GenerateContent (Re-ask)` fail (temporary 5xx/timeout simulation) | Workflow does not crash; continues via `continueRegularOutput`; returns structured OCR response (likely `needs_review`) |
| P2-7 | T012 pricing uses env vars | Set `OCR_PRICE_THB_PER_1K_INPUT/OUTPUT` to known test values and run OCR | Cost calculation (`est_cost_thb` / response cost fields) uses env values, not hardcoded defaults |

### 6.1 Phase 2 Validation Notes

- For `P2-1/P2-3`, if implementation returns `422` instead of `413`, this is acceptable **only if** message clearly indicates file size exceeds max limit.
- For `P2-4`, test both:
  - raw Gemini parse fail (e.g. invalid/empty PDF)
  - OCR transport/API error path
- For `P2-5`, verification may require inspecting prompt build output or debug logs (not just final OCR response).
- For `P2-7`, record test env values and resulting computed THB in test evidence for reproducibility.

## 7. Phase 3 Scenarios (Cleanup & Maintainability)

Use this section after Phase 3 patches (T015-T019) to verify env-configured behavior, queue loop correctness, confidence logic, electricity validation flexibility, and MIME support additions.

| # | Scenario | Input / Setup | Expected Result |
|---|---|---|---|
| P3-1 | T015 queue batch size respects `OCR_QUEUE_BATCH_SIZE` | Set `OCR_QUEUE_BATCH_SIZE=3`; enqueue 10 items; run queue worker cycle | Only 3 items processed in one batch cycle; remaining items stay pending for next cycle |
| P3-2 | T015 SLA lanes honor env thresholds | Set `OCR_SLA_FAST_KB=500`, `OCR_SLA_HEAVY_KB=2000`; test files around thresholds | Lane selection switches according to env values (fast/standard/heavy) rather than hardcoded 700/4000 |
| P3-3 | T015 Telegram uses dynamic workflow name | Run OCR workflow with current name (or renamed clone) | Telegram message shows actual workflow name from `$workflow.name` (not hardcoded `test-workflow`) |
| P3-4 | T016 queue completion uses correct `file_id` for 2nd loop item | Process queue batch with at least 2 items and distinct `file_id`s | `Code  Set Done` writes status/update to the matching 2nd item `file_id`, not item 1 |
| P3-5 | T017 re-ask confidence not inflated when critical errors remain | Simulate re-ask result still containing critical validation errors | Confidence is **not** force-raised by `OCR_REASK_CONF_BOOST`; decision remains consistent with unresolved critical errors |
| P3-6 | T017 re-ask confidence boost applies only when all critical errors resolved | Set `OCR_REASK_CONF_BOOST=0.88`; simulate re-ask that clears all critical errors | Confidence boosted to at least `0.88` (or env value) only in fully-resolved re-ask case |
| P3-7 | T018 electricity ref: 10 digits accepted | Electricity fixture with ref length 10 digits | Validation accepts reference under default `/^\\d{10,15}$/`; no hard error for ref length |
| P3-8 | T018 electricity ref: 16 digits rejected/warned | Electricity fixture with ref length 16 digits | Validation flags reference as invalid under default pattern (warning severity per T018 behavior) |
| P3-9 | T018 custom `OCR_ELEC_REF_PATTERN` overrides default | Set custom env regex (e.g. allow 16 digits), rerun same fixture | Validation behavior follows env regex, overriding default pattern |
| P3-10 | T019 TIFF magic-byte detection | Upload TIFF file (LE and/or BE magic bytes) | MIME identified as `image/tiff`; file passes MIME detection path |
| P3-11 | T019 HEIC/HEIF extension detection | Upload `.heic` or `.heif` file | MIME identified as `image/heic` (or supported HEIF mapping) via extension handling |

### 7.1 Phase 3 Validation Notes

- `P3-1` may require inspecting queue table/sheet state before and after worker run to confirm exact processed count.
- `P3-2` verification is easiest via debug output/log fields from `Code (SLA Lane + Timeout Budget)` (lane + timeout values).
- `P3-3` should test both:
  - normal `$workflow.name` availability
  - fallback via `WORKFLOW_NAME` env var (if possible)
- `P3-5/P3-6` require fixtures or simulated re-ask outputs that deterministically produce `criticalErrs > 0` vs `criticalErrs === 0`.
- `P3-8` expected result is a **warning**, not hard-fail, per T018 severity downgrade.
- `P3-10/P3-11` may be limited by upstream OCR provider support even if MIME detection succeeds; this scenario validates detection path first.

## 8. T024 GDrive Save Scenarios (Fast/Standard Path Audit Trail)

Use this section after T024 changes (Google Drive save before Gemini upload on main fast/standard path).

| # | Scenario | Input / Setup | Expected Result |
|---|---|---|---|
| T024-1 | Fast/standard OCR uploads original file to Google Drive | `POST /ocr-dev` with small PDF (e.g. `shell.pdf`) | OCR success response includes non-empty `drive_file_id`; execution shows `Google Drive (Upload - Direct)` node ran successfully |
| T024-2 | Google Drive file naming uses `YYYY-MM_request_id.ext` | Same as T024-1 | Uploaded Drive file name begins with `YYYY-MM_` and includes request ID + original extension |
| T024-3 | `drive_file_id` propagates to final webhook response | Any successful fast/standard OCR request | `Respond to Webhook6` JSON contains `drive_file_id` matching Google Drive upload node output `id` |
| T024-4 | `drive_file_id` saved in `OCR_RAW` row | Fast/standard OCR request with successful Drive upload | `OCR_RAW` append row includes `drive_file_id` column value (non-empty) |
| T024-5 | Drive upload failure does not block OCR | Temporarily invalidate Google Drive credential / simulate Drive node failure | OCR flow still returns structured OCR result; `drive_file_id = \"UPLOAD_FAILED\"` |
| T024-6 | Heavy queue path remains unaffected | Run heavy/queue OCR path request | Queue path still processes via existing `Queue Receiver` chain; no regression in queue upload/save flow |

### 8.1 T024 Validation Notes

- `T024-1` and `T024-3` can be verified from n8n execution runData:
  - `Google Drive (Upload - Direct).json.id`
  - `Respond to Webhook6.json.drive_file_id`
- `T024-4` requires checking the latest appended row in `OCR_RAW` sheet (or execution output of `Append row in OCR_RAW4` if available).
- `T024-5` is destructive if using live credential changes; run only in controlled test window and restore credential immediately.
- `T024-6` focuses on regression safety: T024 patch targets main fast/standard path only.
