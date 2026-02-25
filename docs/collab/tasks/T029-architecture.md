# T029 — OCR Closed Learning Loop: Architecture & Master Plan

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Status:** Approved — implementation starts T029A

---

## Vision

ปัจจุบัน OCR loop มี PDCA แต่ยัง "เปิด" ที่ Act:
```
Plan ✅ → Do ✅ → Check ✅ → Act ⚠️ (manual / partial)
```

เป้าหมาย T029: ปิด loop อัตโนมัติ
```
Error/Feedback
    ↓
Field Diff Logging (TRAIN_CASES + FIELD_DIFFS)   ← T029A
    ↓
Pattern Analysis → Lesson/Rule Suggestion         ← T029B
    ↓
Approval Gate → Runtime Rules (feature-flagged)  ← T029C
    ↓
Benchmark → Regression Guard → Activate Rule     ← T029D
    ↑_____________________________________________|
```

---

## Phase Summary

| Phase | Task | Scope | Risk | Dependency |
|-------|------|-------|------|-----------|
| 1 | **T029A** | Logging: TRAIN_CASES + FIELD_DIFFS | ต่ำ | ไม่มี |
| 2 | **T029B** | Knowledge Suggestion: LESSONS + CHANGELOG | ต่ำ-กลาง | T029A complete |
| 3 | **T029C** | Runtime Rules: อ่าน RUNTIME_RULES เข้า main workflow | สูงมาก | T029B + T029D |
| 4 | **T029D** | Benchmark Runner + Regression Guard | กลาง | T029A + ground truth data |

---

## Sheet Schemas (ออกแบบโดย CC)

Spreadsheet ID: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`

---

### Sheet 1: OCR_TRAIN_CASES

หน้าที่: เก็บ 1 row ต่อ 1 feedback/correction event

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `case_id` | string | ✅ | PK — `tc_{timestamp}_{rand6}` |
| `created_at` | datetime | ✅ | ISO8601 |
| `source` | enum | ✅ | `feedback_kpi` / `telegram_train` / `manual` |
| `request_id` | string | ✅ | FK → OCR_RAW |
| `doc_type` | string | ✅ | `fuel` / `electricity` / `fleet_card` / ... |
| `vendor_tax_id` | string | ✅ | |
| `vendor_name` | string | ❌ | ถ้ารู้ |
| `ocr_accuracy_pct` | number | ❌ | จาก feedback payload ถ้ามี |
| `diff_count` | number | ✅ | จำนวน field ที่ผิด |
| `severity` | enum | ✅ | `low` (1-2) / `medium` (3-4) / `high` (5+) |
| `root_cause_tag` | string | ✅ | `amount_mismatch` / `date_format` / `tax_id_wrong` / `invoice_number_mismatch` / `multi_field_error` / `full_ocr_failure` / `no_diff` |
| `example_id_ref` | string | ❌ | FK → OCR_EXAMPLES ถ้า promoted |
| `drive_file_id` | string | ❌ | FK → GDrive |
| `status` | enum | ✅ | `pending_review` / `reviewed` / `promoted` |
| `notes` | string | ❌ | |

---

### Sheet 2: OCR_TRAIN_FIELD_DIFFS

หน้าที่: เก็บ field-level diff (N rows ต่อ 1 case)

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `diff_id` | string | ✅ | PK — `df_{timestamp}_{rand6}` |
| `case_id` | string | ✅ | FK → OCR_TRAIN_CASES |
| `created_at` | datetime | ✅ | |
| `doc_type` | string | ✅ | |
| `vendor_tax_id` | string | ✅ | |
| `field_name` | string | ✅ | `total` / `invoice_number` / `invoice_date_th` / `vendor_tax_id` / `customer_name` / `address` / `currency` / `item_description` / `item_unit_price` / `item_amount` |
| `ocr_value` | string | ✅ | ค่าที่ OCR อ่านได้ (อาจเป็น "") |
| `correct_value` | string | ✅ | ค่าที่ถูกต้อง |
| `diff_type` | enum | ✅ | `wrong_value` / `missing` / `extra` / `format_error` |
| `severity` | enum | ✅ | `low` / `medium` / `high` (ตาม field — total/tax_id = high, date = medium, others = low) |

**Field severity rules:**
- `high`: `total`, `vendor_tax_id`
- `medium`: `invoice_date_th`, `invoice_number`
- `low`: ทุกอย่างที่เหลือ

---

### Sheet 3: OCR_KM_LESSONS

หน้าที่: บทเรียน auto-generated (pending approval)

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `lesson_id` | string | ✅ | PK — `ls_{timestamp}_{rand6}` |
| `created_at` | datetime | ✅ | |
| `status` | enum | ✅ | `suggestion` / `approved` / `rejected` / `archived` |
| `doc_type` | string | ✅ | `*` = ทุก type |
| `vendor_tax_id` | string | ❌ | `*` = ทุก vendor |
| `field_affected` | string | ✅ | field ที่มีปัญหา หรือ `*` |
| `pattern_observed` | string | ✅ | อธิบาย pattern ที่พบ |
| `lesson_text` | string | ✅ | บทเรียนที่มนุษย์อ่าน |
| `suggested_action` | string | ✅ | สิ่งที่ควรทำ |
| `evidence_count` | number | ✅ | จำนวน cases ที่ trigger |
| `source_case_ids` | string | ✅ | comma-separated case_ids |
| `approved_by` | string | ❌ | |
| `approved_at` | datetime | ❌ | |
| `rule_id_ref` | string | ❌ | FK → OCR_KM_RUNTIME_RULES ถ้า promoted เป็น rule |

---

### Sheet 4: OCR_RULE_CHANGELOG

หน้าที่: audit trail ของทุก rule change (append-only)

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `change_id` | string | ✅ | PK — `rc_{timestamp}_{rand6}` |
| `created_at` | datetime | ✅ | |
| `rule_id` | string | ✅ | FK → OCR_KM_RUNTIME_RULES |
| `change_type` | enum | ✅ | `created` / `updated` / `activated` / `deactivated` / `deprecated` |
| `changed_by` | string | ✅ | `system` / admin_id |
| `reason` | string | ✅ | |
| `lesson_id_ref` | string | ❌ | |
| `case_id_refs` | string | ❌ | |
| `before_value` | string | ❌ | JSON snapshot ก่อนเปลี่ยน |
| `after_value` | string | ❌ | JSON snapshot หลังเปลี่ยน |

---

### Sheet 5: OCR_KM_RUNTIME_RULES

หน้าที่: machine-readable rules ที่ runtime อ่านไปใช้

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `rule_id` | string | ✅ | PK — `rr_{rand8}` |
| `created_at` | datetime | ✅ | |
| `updated_at` | datetime | ✅ | |
| `status` | enum | ✅ | `active` / `inactive` / `pending_approval` / `deprecated` |
| `priority` | number | ✅ | 1 = สูงสุด (apply ก่อน) |
| `doc_type` | string | ✅ | หรือ `*` |
| `vendor_tax_id` | string | ✅ | หรือ `*` |
| `scope` | enum | ✅ | `post_normalize` / `validation_exception` / `prompt_hint` |
| `rule_type` | enum | ✅ | `field_format` / `field_default` / `skip_validation` / `vendor_hint` |
| `rule_key` | string | ✅ | unique name |
| `rule_value` | string | ✅ | JSON payload (schema ขึ้นกับ rule_type) |
| `description` | string | ✅ | human-readable |
| `approved_by` | string | ✅ | ห้าม active ถ้าไม่มี |
| `approved_at` | datetime | ✅ | |
| `source_lesson_id` | string | ❌ | |
| `benchmark_result` | string | ❌ | `pass` / `fail` / `not_run` |
| `benchmark_run_at` | datetime | ❌ | |

**rule_value JSON schema by rule_type:**
```json
// field_format: บังคับ format ของ field
{ "field": "invoice_date_th", "regex": "^\\d{2}/\\d{2}/\\d{4}$", "transform": "DD/MM/YYYY" }

// field_default: ถ้า OCR อ่านไม่ได้ให้ใช้ค่านี้
{ "field": "currency", "default": "THB" }

// skip_validation: ข้าม validation rule บางตัวสำหรับ vendor/type นี้
{ "validation_id": "TAX_ID_REQUIRED", "reason": "vendor ไม่ต้องการ tax_id" }

// vendor_hint: inject ข้อความเพิ่มเข้า prompt (ใช้ระวัง)
{ "hint_text": "สำหรับ vendor นี้ total มักอยู่บรรทัดสุดท้าย" }
```

---

### Sheet 6: OCR_FUEL_TEMPLATES

หน้าที่: vendor-specific document templates

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `template_id` | string | ✅ | PK |
| `vendor_tax_id` | string | ✅ | |
| `vendor_name` | string | ✅ | |
| `doc_type` | string | ✅ | |
| `expected_fields` | string | ✅ | JSON array ของ fields ที่ต้องมี |
| `field_formats` | string | ✅ | JSON map: `{field: regex_pattern}` |
| `special_handling` | string | ❌ | JSON: notes พิเศษ |
| `status` | enum | ✅ | `active` / `inactive` |
| `version` | number | ✅ | |
| `updated_at` | datetime | ✅ | |
| `source_case_ids` | string | ❌ | |

---

### Sheet 7: OCR_BENCHMARK_FUEL

หน้าที่: ground truth test cases สำหรับ benchmark

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `benchmark_id` | string | ✅ | PK — `bm_{rand8}` |
| `doc_type` | string | ✅ | |
| `vendor_tax_id` | string | ✅ | |
| `vendor_name` | string | ✅ | |
| `difficulty` | enum | ✅ | `easy` / `medium` / `hard` |
| `input_drive_file_id` | string | ✅ | GDrive file ID ของ test doc |
| `ground_truth` | string | ✅ | JSON: expected bills[] output |
| `fields_to_check` | string | ❌ | JSON array: subset of fields (default: all) |
| `notes` | string | ❌ | |
| `last_run_at` | datetime | ❌ | |
| `last_run_exec_id` | string | ❌ | n8n execution ID |
| `last_run_accuracy` | number | ❌ | % (0-100) |
| `last_run_result` | enum | ❌ | `pass` / `fail` / `partial` |

---

## Risk Assessment

### T029A (Logging) — Risk: ต่ำ
- ไม่กระทบ main OCR workflow เลย
- ถ้า Sheet write fail → `continueOnFail: true` → OCR ยังทำงาน
- Worst case: TRAIN_CASES ว่าง แต่ feedback ยังเดิน

### T029B (Knowledge Suggestion) — Risk: ต่ำ-กลาง
- Generate suggestions เท่านั้น ไม่ activate อัตโนมัติ
- Risk: suggestion ผิดพลาด → human review catch ได้ก่อน
- Worst case: lesson ไม่ generate แต่ LESSONS sheet ว่าง

### T029C (Runtime Rules) — Risk: สูงมาก
- กระทบ main OCR workflow ทุก request
- Mitigations:
  - Feature flag: `OCR_RUNTIME_RULES_ENABLED=false` (default)
  - Rules load ครั้งเดียวต่อ execution (cache)
  - ถ้า load fail → ใช้ empty rules (fail-open)
  - rule_type จำกัดเฉพาะ post-normalize / validation_exception ก่อน (ห้าม prompt injection รอบแรก)
  - ต้องผ่าน T029D benchmark ก่อน activate จริง

### T029D (Benchmark) — Risk: กลาง
- ไม่กระทบ production โดยตรง
- Risk: benchmark cases น้อยเกินไป → false confidence
- Mitigation: ต้องมี ≥5 cases ต่อ doc_type ก่อนถือว่า benchmark มีความหมาย

---

## Security Considerations

1. **Poisoned training prevention** — validate schema ทุก field ก่อน write TRAIN_CASES
2. **Rule injection** — `vendor_hint` (prompt injection) ต้องมี human approval + audit trail ทุกครั้ง
3. **Privilege escalation** — approval gate: ถ้าไม่มี `approved_by` → ห้าม status=active ใน RUNTIME_RULES
4. **Data leakage** — TRAIN_CASES/FIELD_DIFFS ไม่ส่ง raw OCR response ออกไปนอก Sheets
5. **Input validation** — field values ใน FIELD_DIFFS ต้อง truncate ที่ 500 chars ก่อน write

---

## Workflows ใหม่ที่ต้องสร้าง

| Workflow | Task | หน้าที่ |
|----------|------|--------|
| `ocr-km-logger` | T029A | รับ event → compute diff → write TRAIN_CASES + FIELD_DIFFS |
| `ocr-km-suggester` | T029B | Scheduled — analyze patterns → write LESSONS suggestions |
| `ocr-benchmark-runner` | T029D | On-demand — รัน test cases → วัดผล |

Existing workflows ที่ต้อง patch:
| Workflow | Task | การเปลี่ยน |
|----------|------|-----------|
| `ocr-feedback-receiver` (T026) | T029A | เพิ่ม HTTP call → ocr-km-logger |
| `ocr-training` (T028) | T029A | เพิ่ม HTTP call → ocr-km-logger หลัง confirm |
| `ocr-invoice-processor` (main) | T029C | เพิ่ม node อ่าน RUNTIME_RULES (feature-flagged) |

---

## Definition of Done (ต่อ Phase)

### T029A Done:
- [ ] `ocr-km-logger` workflow active + endpoint `/webhook/ocr-km-log`
- [ ] TRAIN_CASES ได้ row อัตโนมัติเมื่อ feedback-kpi ถูก submit
- [ ] TRAIN_CASES ได้ row อัตโนมัติเมื่อ user confirm/correct ผ่าน Telegram
- [ ] FIELD_DIFFS ได้ N rows ต่อ case (1 row ต่อ field ที่ผิด)
- [ ] severity + root_cause_tag ถูกต้องตาม rules ที่กำหนด
- [ ] ถ้า logger fail → feedback flow ยังทำงานปกติ (continueOnFail verified)
- [ ] Verified ด้วย execution จริง + exec ID บันทึก

### T029B Done: (future)
- [ ] `ocr-km-suggester` workflow active (scheduled)
- [ ] LESSONS มี suggestion row เมื่อ same field ผิดซ้ำ ≥3 cases
- [ ] Status=suggestion (ไม่ auto-activate)

### T029C Done: (future)
- [ ] Feature flag `OCR_RUNTIME_RULES_ENABLED` controls behavior
- [ ] active rules ถูก apply ที่ post_normalize scope
- [ ] fail-open verified (rules load fail → OCR ยังทำงาน)

### T029D Done: (future)
- [ ] `ocr-benchmark-runner` workflow active
- [ ] ≥5 test cases ใน OCR_BENCHMARK_FUEL
- [ ] Benchmark result บันทึกกลับใน sheet
