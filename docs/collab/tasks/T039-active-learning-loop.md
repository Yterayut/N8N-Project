# T039 — Active Learning Loop: Feedback → Training Data → Prompt Improvement

**Author:** Claude Code (CC)
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** Medium
**Risk:** ต่ำ — เพิ่ม side-call เข้า existing workflow ไม่แตะ main OCR path
**Depends on:** T026 ✅, T029A ✅, T029B ✅, T038 (ควรเสร็จก่อน แต่ไม่บังคับ)

---

## Overview

ตอนนี้เมื่อ admin CarbonReceipt ส่ง feedback correction เข้ามา:

```
Admin feedback → OCR_FEEDBACK sheet ✅ (T026)
                       ↓
              KPI tracking daily ✅ (T026)
                       ↓
              TRAIN_CASES / FIELD_DIFFS ❌ ← ยังไม่ได้ต่อ
                       ↓
              T029B pattern analysis ❌ ← ไม่มี data จาก real corrections
                       ↓
              OCR ดีขึ้น ❌ ← loop ยังไม่ปิด
```

**T039 ปิด loop นี้** โดยเพิ่ม bridge ระหว่าง `ocr-feedback-receiver` (T026) → `ocr-km-logger` (T029A) เพื่อให้การแก้ไขของ admin กลายเป็น training data จริงๆ

**ผลที่ได้หลัง T039:**
- ทุก feedback correction → เข้า TRAIN_CASES + FIELD_DIFFS อัตโนมัติ
- T029B วิเคราะห์ real user corrections ด้วย (ไม่ใช่แค่ manual seed)
- เมื่อ error pattern เจอ ≥3 ครั้ง → สร้าง LESSONS entry อัตโนมัติ

---

## Scope

**In scope:**

### Step 1 — Bridge: `ocr-feedback-receiver` → `ocr-km-logger`

Patch workflow `ztJ8oCBHREUPPry6` (`ocr-feedback-receiver`) เพิ่ม HTTP Request node ต่อท้าย `Append OCR_FEEDBACK` node:

- **เงื่อนไข:** เรียก km-logger เฉพาะเมื่อ `diff_count > 0` (มี correction จริง)
- **Call:** `POST http://localhost:5678/webhook/ocr-km-log`
- **continueOnFail: true** — ถ้า km-logger ล้ม ไม่กระทบ feedback flow
- **ไม่ block** response กลับ admin (ทำ async — ส่ง response ก่อน แล้ว km-log ทีหลัง)

**Payload ที่ส่งไป km-logger:**
```json
{
  "source": "feedback_kpi",
  "request_id": "{{ $json.request_id }}",
  "doc_type": "{{ $json.doc_type }}",
  "vendor_tax_id": "{{ $json.vendor_tax_id }}",
  "vendor_name": "{{ $json.vendor_name }}",
  "ocr_accuracy_pct": "{{ $json.accuracy_pct }}",
  "drive_file_id": "{{ $json.drive_file_id }}",
  "example_id_ref": "",
  "ocr_bills": "{{ $json.ocr_bills }}",
  "correct_bills": "{{ $json.correct_bills }}"
}
```

> **หมายเหตุ:** `ocr_bills` = OCR output ต้นฉบับ (lookup จาก OCR_RAW), `correct_bills` = ที่ admin แก้ไข — T026 มีทั้งสองอยู่แล้ว

### Step 2 — Enhance T029B: รวม `feedback_kpi` source ในการวิเคราะห์

Patch workflow `NkKd02QyzLRcpIJM` (`ocr-km-suggest`) ใน Code node ที่ filter TRAIN_CASES:

**Current behavior:** exclude `source = 'manual'` เท่านั้น (7 seed rows)
**After patch:** include `source IN ['feedback_kpi', 'telegram_train']` → วิเคราะห์ real corrections

เพิ่ม logic ใน `Code (Build Pattern Summary)`:
```javascript
// กรอง: เฉพาะ feedback_kpi และ telegram_train (ไม่ใช่ manual seed)
const realCases = cases.filter(c =>
  c.source === 'feedback_kpi' || c.source === 'telegram_train'
);
// ถ้า realCases < 3 → ยังไม่พอ analysis → skip (ไม่ส่ง Telegram noise)
if (realCases.length < 3) {
  return [{ json: { skipped: true, reason: 'insufficient_real_cases', count: realCases.length } }];
}
```

### Step 3 — Auto-LESSON: เมื่อ pattern ≥3 → สร้าง LESSONS entry

ใน T029B เพิ่ม: ถ้า field เดิม + doc_type เดิม มี error ≥3 ครั้งใน FIELD_DIFFS → append ไปที่ LESSONS sheet อัตโนมัติ:

```javascript
// pattern: { field_name, doc_type, count, common_ocr_value, common_correct_value }
const hotPatterns = patterns.filter(p => p.count >= 3);
// → Append to LESSONS sheet: lesson_id, detected_at, field_name, doc_type,
//   pattern_desc, sample_ocr, sample_correct, status='pending_review'
```

**LESSONS row schema เพิ่ม:**

| column | value |
|--------|-------|
| `lesson_id` | `L_<timestamp>` |
| `detected_at` | ISO timestamp |
| `source` | `auto_pattern` |
| `field_name` | เช่น `total` |
| `doc_type` | เช่น `tax_invoice` |
| `pattern_desc` | เช่น `total off by small amount (rounding?)` |
| `sample_ocr` | เช่น `650` |
| `sample_correct` | เช่น `630` |
| `occurrence_count` | 3 |
| `status` | `pending_review` |

> CC จะ review LESSONS entries ก่อน enable เข้า runtime rules เสมอ

**Out of scope:**
- ห้ามแตะ main OCR workflow (`up1n75qEhbsXswii`) โดยตรง
- ไม่แก้ OCR prompt ในงานนี้ (prompt update = T040 ถ้าจำเป็น)
- ไม่ auto-enable runtime rules — LESSONS ต้องผ่าน CC review ก่อน
- ไม่เพิ่ม OCR_EXAMPLES entry อัตโนมัติ (เสี่ยงเกินไป)

---

## Technical Spec

### Workflow: `ocr-feedback-receiver` (`ztJ8oCBHREUPPry6`)

ดู node graph ปัจจุบัน: `GET /rest/workflows/ztJ8oCBHREUPPry6`

เพิ่ม node ต่อท้าย `Append OCR_FEEDBACK` (ต้อง verify ชื่อ node จริงจาก API):

```
[Append OCR_FEEDBACK] → [IF diff_count > 0] → [HTTP: Call km-logger]
                                              ↓ (false)
                                         [end / no-op]
```

**IF node condition:**
```
{{ $json.diff_count > 0 }}
```

**HTTP Request node:**
```
Method: POST
URL: http://localhost:5678/webhook/ocr-km-log
Headers:
  x-api-key: {{ $env.OCR_SHARED_API_KEY }}
  Content-Type: application/json
Body (JSON):
  {
    "source": "feedback_kpi",
    "request_id": "{{ $('Code (Compute Diff)').first().json.request_id }}",
    ...
  }
continueOnFail: true
```

> ใช้ `$('NodeName').first().json.field` ตาม PATTERN-006 — ไม่ใช่ `$json`

### Workflow: `ocr-km-suggest` (`NkKd02QyzLRcpIJM`)

ดู current Code nodes ก่อน patch:
```bash
source .env
curl -s http://localhost:5678/rest/workflows/NkKd02QyzLRcpIJM \
  -b cookie.txt | python3 -c "import json,sys; d=json.load(sys.stdin); [print(n['name']) for n in d['data']['nodes']]"
```

แก้ Code node ที่ query TRAIN_CASES เพิ่ม source filter + pattern threshold

### Google Sheets: LESSONS tab

ตรวจว่า LESSONS tab มีอยู่แล้ว (T029B สร้างไว้) → ถ้ามี: append ต่อ, ถ้าไม่มี: สร้าง header row ก่อน

Spreadsheet ID: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`

---

## Security Considerations

1. **มีจุดรับ input ใหม่ไหม?** — ไม่ (เพิ่มแค่ internal call localhost)
2. **มี secret/credential ใหม่ไหม?** — ไม่ (ใช้ `OCR_SHARED_API_KEY` เดิม)
3. **มีข้อมูล sensitive รั่วไหม?** — ระวัง: `vendor_name`, `vendor_tax_id` ใน LESSONS → ใช้ได้เพราะ Sheet ไม่ public

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| HTTP call ไป km-logger fail | `continueOnFail: true` — feedback flow ไม่กระทบ |
| km-logger รับ payload ผิด schema | km-logger validate เอง → return error แต่ไม่กระทบ caller |
| LESSONS entry สร้างอัตโนมัติโดยไม่มี review | `status='pending_review'` ทุก row — CC review ก่อน enable |

---

## Discussion

_Codex: เพิ่ม concerns ก่อน implement_

**CC Pre-notes:**
- ตรวจ T026 workflow ว่า node ที่เก็บ `ocr_bills` (ต้นฉบับ) ชื่อว่าอะไรจริงๆ ก่อน patch
- ถ้า T026 ไม่ได้เก็บ `ocr_bills` ไว้ใน flow → ต้อง lookup เพิ่ม (GET OCR_RAW row แล้วดึง `bills_json`)
- km-logger รับ `ocr_bills` + `correct_bills` เป็น array — ต้องส่ง JSON string หรือ object ตาม km-logger schema จริง (ดู T029A spec)

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | ส่ง feedback พร้อม corrections | POST /webhook/ocr-feedback-kpi (diff_count > 0) | OCR_FEEDBACK append ✅ + TRAIN_CASES append ✅ + FIELD_DIFFS append ✅ |
| T2 | ส่ง feedback ไม่มี correction (accuracy=100%) | POST feedback | OCR_FEEDBACK append ✅, km-logger ไม่ถูกเรียก (diff_count=0) |
| T3 | km-logger down ขณะ feedback มา | ปิด km-logger workflow ชั่วคราว | Feedback flow ยังทำงาน + response 200 ✅ (continueOnFail) |
| T4 | T029B daily run หลังมี feedback_kpi ใน TRAIN_CASES | trigger POST /webhook/ocr-km-suggest | วิเคราะห์รวม feedback_kpi rows ✅ |
| T5 | Pattern ≥3 ครั้ง → LESSONS auto-create | seed FIELD_DIFFS ด้วย 3 rows field เดียวกัน | LESSONS row ใหม่ status=pending_review ✅ |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T6 | wrong API key บน /ocr-feedback-kpi | 401 |
| T7 | feedback payload ไม่มี corrections fields | OCR_FEEDBACK บันทึก, km-logger ไม่เรียก |
| T8 | FIELD_DIFFS < 3 pattern count | ไม่สร้าง LESSONS (ไม่ถึง threshold) |

---

## Definition of Done

**Implemented:**
- [ ] `ocr-feedback-receiver` มี IF + HTTP node → km-logger (continueOnFail)
- [ ] `ocr-km-suggest` filter รวม `feedback_kpi` source
- [ ] `ocr-km-suggest` auto-LESSONS เมื่อ pattern ≥3

**Verified from system:**
- [ ] TRAIN_CASES มี row ใหม่ source=`feedback_kpi` หลัง test feedback
- [ ] FIELD_DIFFS มี rows สำหรับ feedback นั้น
- [ ] T029B exec ใช้ feedback rows ในการวิเคราะห์

**E2E Passed:**
- [ ] Exec ID: `_______` — feedback → TRAIN_CASES flow
- [ ] Exec ID: `_______` — T029B daily run พร้อม real corrections

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] T039 closing template filled

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
