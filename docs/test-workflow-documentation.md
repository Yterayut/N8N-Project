# test-workflow Documentation

**Workflow ID:** `up1n75qEhbsXswii`
**Status:** Inactive (manually triggered via webhooks)
**Execution Timeout:** 300 seconds
**Last Export:** 2026-02-23
**Documentation Sync:** 2026-02-23 (updated after P0/P1 fixes T003/T004/T005)

---

## Overview

ระบบ OCR อัจฉริยะสำหรับอ่านใบแจ้งหนี้/ใบเสร็จภาษาไทย โดยใช้ Google Gemini 2.5 Flash เป็น AI engine หลัก รองรับเอกสาร 4 ประเภท ได้แก่ ใบเสร็จน้ำมัน (fuel), ใบแจ้งค่าไฟ (electricity), ใบ fleet card, และใบจอดรถ (parking)

ระบบมีความสามารถระดับ enterprise ได้แก่ admission control (rate limiting), duplicate detection, re-ask loop สำหรับแก้ไขข้อผิดพลาด, feedback loop สำหรับเรียนรู้จากการแก้ไขของมนุษย์ (few-shot learning), และ async queue processing

---

## Endpoints

| Endpoint | Method | Path | Status | Description |
|---|---|---|---|---|
| `Webhook_OCR_Test5` | POST | `/ocr-dev` | Active | Main OCR endpoint รับไฟล์เอกสารเพื่อทำ OCR |
| `Queue Receiver` | POST | `/ocr-queue` | Active | Async queue intake สำหรับส่งไฟล์เข้าคิว |
| `Webhook_OCR_Feedback` | POST | `/ocr-feedback` | Active | รับ feedback/correction จาก admin |
| `Schedule Trigger` | - | - | **Disabled** | Queue worker ทำงานทุก 1 นาที |
| `Webhook_OCR_Test9` | POST | `/ocr-dev` | **Disabled** | Old test webhook (legacy) |

---

## Main Flow: OCR Processing (`/ocr-dev`)

### 1. Request Validation

```
Client POST /ocr-dev (multipart/form-data with file)
  |
  v
MIME Type Normalizer --> ตรวจสอบ magic bytes (PDF, JPEG, PNG) แก้ไข MIME ที่ผิด
  (P1: optimized MIME sniffing to inspect base64 prefix only)
  |
  v
Extract API Key + Normalize bill_type
  |
  v
Has File? --NO--> 422 "No file uploaded"
  |YES
  v
API Key Valid? --NO--> 401 "Unauthorized"
  |YES
  v
Admission Control (ถ้า configured)
  |
  v
Allowed? --NO--> 429 "Too Many Requests" + Retry-After header
  |YES
  v
Continue to Document Classification
```

**P1 fixes reflected in Request Validation**
- `Code in JavaScript5` now propagates `allHeaders` so downstream logging can extract caller IP (`x-forwarded-for`).
- File-count guard is enforced in queue upload splitting path to prevent excessive fan-out (protects Google Drive/Sheets rate limits).

### 2. Document Classification & SLA Assignment

- **Document Classifier** ใช้ regex matching กับชื่อไฟล์:
  - `electricity`: `/ค่าไฟ|electric|ab[0-9]|meter|kwh/`
  - `fuel`: `/น้ำมัน|fuel|ptt|gasohol|diesel/`
  - `fleet_card`: `/fleet|card|ระยะทาง|odometer/`
  - `parking`: `/park|parking|ที่จอด/`
- หรือรับ `bill_type` / `doc_type` จาก request parameter โดยตรง

- **SLA Lane** กำหนด timeout ตาม file size + doc_type:
  - `fast`: 45 วินาที
  - `standard`: 65 วินาที
  - `heavy`: 90 วินาที

### 3. Prompt Assembly

```
Load active prompts from PROMPTS sheet (Google Sheets)
  |
  v
Select base prompt + type-specific prompt
  |
  v
Fetch few-shot examples from OCR_EXAMPLES (ถ้า Feedback API configured)
  --> เลือกสูงสุด 3 examples, truncate ที่ 6,000 chars
  |
  v
Build final Gemini request with file URI + assembled prompt
```

### 4. Gemini OCR Inference

1. Upload ไฟล์ไปยัง Gemini Files API
2. เรียก `gemini-2.5-flash:generateContent` (temperature=0.1, JSON response mode)
3. ถ้า Gemini error --> ตอบ structured error response + log error ลง OCR_RAW + ส่ง Telegram notification

### 5. Normalize + Validate (Node หลักของระบบ, ~500 lines)

- **Normalize field names**: เช่น `invoice_no` --> `invoice_number`, `grand_total` --> `total`
- **P0 helper fix**: `round3()` is available for fleet-card quantity derivation (prevents `ReferenceError`)
- **Fuel heuristics**: ตรวจจับ LPG manual form (tax ID `0135553012766`), แก้ไข column สลับกัน
- **Fleet card heuristics**: คำนวณ quantity จาก `amount/unit_price`
- **Deduplicate within response**: ใช้ tax_id + date + total + invoice number
- **Validation checks**:
  - Date format: `DD/MM/YYYY`
  - Tax ID: 13 หลัก เริ่มต้นด้วย `0`
  - Arithmetic: `qty * unit_price ≈ amount`
  - Fuel line sum vs total
- กำหนด `confidence`, `needs_reask`, error list

### 6. Re-ask Loop (ถ้ามี critical errors)

```
needs_reask = true?
  |YES
  v
Build repair prompt (ระบุ critical errors + current JSON)
  |
  v
Gemini re-ask call (same model, temp=0.1)
  |
  v
Apply Re-ask Result
  |
  v
Normalize + Validate (re-run on repaired payload)
  |
  v
Finalize Decision
```

**P1 fix (T004):** Re-ask results are revalidated before final decision/storage, preventing invalid repaired JSON from bypassing normalization/validation.

### 7. Final Decision

| Decision | Condition |
|---|---|
| `auto_pass` | ไม่มี critical errors, bills > 0, confidence >= 0.9 |
| `needs_review` | มี errors บางส่วน หรือ confidence < 0.9 |
| `hard_fail` | ไม่สามารถ parse ได้เลย |

### 8. Post-Processing (4 parallel paths)

1. **Response** --> ส่ง structured JSON กลับ client (HTTP 200/202/422/500)
2. **Log to OCR_RAW** --> append row ลง Google Sheets
   - Split bills --> ตรวจ duplicate (row_key matching) --> atomic reserve (ถ้า configured) --> append ลง OCR sheet
3. **Save Prediction** --> บันทึก prediction metadata ผ่าน Feedback API (ถ้า configured)
4. **Telegram Notification** --> ส่งแจ้งเตือนสถานะ OCR + release admission slot

---

## Async Queue Flow (`/ocr-queue`)

```
Client POST /ocr-queue (multipart with files)
  |
  v
Split files --> สร้าง file_id ต่อไฟล์
  |
  v
Upload to Google Drive (folder: Upload_Carbonrecipt)
  |
  v
Append to OCR_QUEUE sheet (status=pending)
  |
  v
Return 200 "file received"
```

**Queue Worker (Disabled / rollout-dependent)**:
- Poll OCR_QUEUE ทุก 1 นาที
- ดึงงาน pending สูงสุด 10 items
- ประมวลผลทีละ 1 item (wait 6s ระหว่าง item)
- Download จาก Google Drive --> Upload to Gemini --> Inference
- Success -> Update status=`done`
- Failure -> Update status=`error` (P1 fix, T005) for retry/recovery visibility

**P1 fix (T005):** Queue worker no longer marks failed items as `done`. Failed queue items are persisted as `error`.

---

## Feedback/Correction Flow (`/ocr-feedback`)

```
Client POST /ocr-feedback (JSON body)
  |
  v
Validate: auth key + schema (ocr_pred_json, admin_final_json)
  - Date format: DD/MM/YYYY
  - Tax ID: 13 หลัก
  |
  v
Valid? --NO--> 400/401/422/500
  |YES
  v
Deep diff: ocr_pred_json vs admin_final_json (field by field)
  |
  v
Save to OCR_CORRECTIONS (via Feedback API)
  |
  v
Save to OCR_EXAMPLES (gold JSON for few-shot learning)
  |
  v
Return 200 "feedback accepted"
```

---

## External Dependencies

### APIs

| Service | Endpoint | Purpose |
|---|---|---|
| Google Gemini 2.5 Flash | `generativelanguage.googleapis.com` | OCR inference + re-ask |
| Internal Feedback API | `$env.OCR_FEEDBACK_API_URL` | Admission control, dedupe, corrections, predictions, few-shot examples |
| Telegram Bot API | via n8n Telegram node | Notification |

### Google Sheets (Spreadsheet: `OCM-INFRA`)

| Sheet Tab | Purpose |
|---|---|
| `PROMPTS` | OCR prompt templates (base + per-type) |
| `OCR_RAW` | Raw request log (1 row per request) |
| `OCR` | Normalized bill rows (1 row per bill) |
| `OCR_QUEUE` | Async processing queue |

### Google Drive

| Folder | Purpose |
|---|---|
| `Upload_Carbonrecipt` | Temporary storage สำหรับไฟล์ในคิว |

---

## Environment Variables

| Variable | Description |
|---|---|
| `OCR_SHARED_API_KEY` | API key สำหรับ authenticate request |
| `GEMINI_API_KEY` | Google Gemini API key |
| `OCR_FEEDBACK_API_URL` | URL ของ Feedback API (optional, enables admission/dedupe/feedback features) |
| `TELEGRAM_OCR_CHAT_ID` | Telegram chat ID สำหรับส่ง notification (default: `1776637578`) |

---

## Node Inventory

### Active Nodes: 56 total

| Category | Count | Key Nodes |
|---|---|---|
| Triggers | 3 | Webhook_OCR_Test5, Queue Receiver, Webhook_OCR_Feedback |
| Code (JavaScript) | 22 | Document Classifier, Normalize+Validate, Build Request, etc. |
| HTTP Request | 10 | Gemini upload/inference, Feedback API calls |
| Google Sheets | 8 | PROMPTS read, OCR_RAW/OCR append, OCR_QUEUE CRUD |
| Google Drive | 2 | Upload, Download |
| IF/Conditional | 14 | Auth, error check, admission, dedupe, re-ask, etc. |
| Respond to Webhook | 8 | Success, error, unauthorized, busy, etc. |
| Other | 3 | Loop Over Items, Wait, Telegram |

### Disabled Nodes: ~16 total (legacy Webhook_OCR_Test9 path)

---

## Response Format (Success)

```json
{
  "status": "success",
  "decision": "auto_pass|needs_review|hard_fail",
  "confidence": 0.95,
  "doc_type": "fuel|electricity|fleet_card|parking|mixed|unknown",
  "used_reask": false,
  "bills_count": 1,
  "bills": [
    {
      "invoice_number": "...",
      "vendor_tax_id": "0123456789012",
      "invoice_date": "DD/MM/YYYY",
      "total": 1234.56,
      "supplier_name": "...",
      "list_detail": [
        {
          "description": "...",
          "quantity": 10,
          "unit_price": 30.50,
          "amount": 305.00
        }
      ],
      "row_key": "tax_id+invoice_number+date+total"
    }
  ],
  "request_id": "...",
  "model_version": "gemini-2.5-flash",
  "prompt_tokens": 1234,
  "candidates_tokens": 567,
  "total_tokens": 1801,
  "est_cost_thb": 0.0234
}
```

## Error Responses

| HTTP Status | Condition |
|---|---|
| 401 | API key ไม่ถูกต้อง |
| 422 | ไม่ได้แนบไฟล์ |
| 429 | Admission control ปฏิเสธ (ระบบเต็ม) |
| 500 | Gemini error หรือ internal error |

---

## P0/P1 Fix Notes (2026-02-23)

Following items from `docs/improve-by-claude-23-02-2026.md` were implemented by Claude Code and are reflected in workflow behavior:
- **T003:** `round3` helper fix, `allHeaders` propagation, MIME sniffing optimization, queue file-count guard, trailing URL newline cleanup
- **T004:** Re-ask result routed through normalization/validation before finalization
- **T005:** Queue worker failure status uses `error` (instead of `done`) to preserve retryability

---

## Architecture Diagram

```
                                    +-----------------+
                                    |   Telegram Bot  |
                                    +--------^--------+
                                             |
Client ---POST /ocr-dev---> [Auth] -> [Admission] -> [Classify] -> [SLA Lane]
                                                          |
                              +---------------------------+
                              |                           |
                     [Upload to Gemini]          [Load Prompts + Few-shot]
                              |                           |
                              +----------+----------------+
                                         |
                                  [Gemini Inference]
                                         |
                                  [Normalize+Validate]
                                         |
                                   [Need Re-ask?]
                                    /         \
                                  YES          NO
                                   |            |
                            [Re-ask Gemini]     |
                                   \           /
                                 [Finalize Decision]
                                    /    |    \     \
                              Response  Log   Dedupe  Telegram
                                        |      |
                                    OCR_RAW   OCR sheet
                                              (per bill)

Client ---POST /ocr-queue---> [Split Files] -> [Drive Upload] -> [Queue Sheet]

Client ---POST /ocr-feedback---> [Validate] -> [Diff] -> [Save Corrections + Examples]
```
