# T052 — OCR Accuracy Roadmap: Push Field Accuracy Toward 100%

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex / CC
**Priority:** Critical
**Risk:** กลางถึงสูง
**Depends on:** T026, T027, T029A, T039, T044, T046, T047, T050, T051

---

## Overview

ระบบ OCR ปัจจุบันมี learning loop แล้ว แต่ยังมีช่องว่างสำคัญ 4 จุดที่ทำให้ KPI ดูดีเกินจริงและทำให้ field accuracy ยังห่างจากเป้า "ใกล้ 100%":

1. KPI หลักปะปน `telegram_train` proxy score กับ audited OCR score
2. OCR extraction ยังพึ่ง prompt/example เยอะ แต่ validation และ repair loop หลัง OCR ยังไม่เข้มพอ
3. vendor/layout canonicalization ยังไม่สะอาดพอ ทำให้ routing, examples, KPI, และ rule analysis เพี้ยน
4. feedback data ถูกเก็บแล้ว แต่ยังใช้เป็น "ระบบปรับปรุงความแม่นยำแบบ deterministic" ไม่เต็มที่

เป้าของแผนนี้ไม่ใช่ "ทำให้ LLM อ่านถูกทุกใบแบบ magic" แต่คือทำให้ระบบนี้เข้าใกล้ 100% สำหรับฟิลด์ที่ธุรกิจต้องการ โดยใช้แนวทาง production-grade:

- แยก `accepted-by-user` ออกจาก `audited OCR accuracy`
- ทำ extraction แบบหลายชั้น: classify -> extract -> validate -> targeted repair -> confidence gate
- ใช้ vendor/layout-specific examples + rules + canonicalization
- ใช้ human review เฉพาะเคสที่ระบบไม่มั่นใจ

นิยามความสำเร็จของแผนนี้:

- Critical fields มี audited accuracy >= 99% บน holdout benchmark
- Auto-pass rate สูงขึ้นโดยไม่ดัน false-positive ขึ้น
- KPI สะท้อนความจริง และแยก proxy / accepted / audited ออกจากกันชัดเจน
- ทุก correction ที่มีคุณภาพถูกเปลี่ยนเป็น knowledge ที่ใช้งานได้จริงในรอบถัดไป

---

## Scope

**In scope:**
- แยก metric pipeline เป็น `audited`, `proxy`, `accepted`
- ออกแบบ canonical schema สำหรับ critical fields
- เพิ่ม vendor/layout routing และ canonical vendor map
- เพิ่ม post-OCR validation, repair, and confidence gate
- เพิ่ม audited benchmark / holdout set สำหรับ regression
- ปรับ feedback loop ให้ admin corrections และ Telegram confirmed cases ถูกใช้ถูกประเภท
- ออกแบบ release gates สำหรับ prompt/rule changes
- เพิ่ม dashboard / daily report ให้ report ความจริงตาม source type

**Out of scope (explicit):**
- ไม่ทำ model fine-tuning ของ external OCR/LLM provider ในแผนนี้
- ไม่เปลี่ยน synchronous contract ของ `ocr-dev`
- ไม่ redesign CarbonReceipt app ทั้งระบบ
- ไม่ย้าย data store ใหญ่จาก Google Sheets ไป DB ในรอบแรก ถ้าไม่จำเป็น

---

## Current-State Diagnosis

### 1. KPI problem

จากระบบปัจจุบัน:
- `ocr-kpi-report` (`yCqvdl3vrHGgiBMt`) เคย aggregate `OCR_TRAIN_CASES`
- `telegram_train` เคสบางส่วนได้ `ocr_accuracy_pct=100` จาก confirm baseline logic
- metric นี้ไม่เท่ากับ true OCR extraction accuracy

ผลกระทบ:
- overall KPI สูงเกินจริง
- vendor breakdown ถูกดันด้วย training-confirm rows
- ทีมตีความผิดว่า OCR อ่านฟิลด์จริงได้แม่นแล้ว

### 2. Learning problem

ตอนนี้มีข้อมูล 3 ประเภท:
- `Telegram confirm/correct`
- `Admin feedback`
- `Manual seed/example`

แต่ระบบยังไม่แยกบทบาทชัดพอ:
- อะไรคือ example
- อะไรคือ audited truth
- อะไรคือ diff evidence
- อะไรคือ acceptance signal

### 3. Extraction problem

OCR ปัจจุบันมี strengths:
- few-shot examples
- prompt updates
- runtime rules
- vendor enrichment

แต่ยังขาดชั้นสำคัญ:
- strict field validators
- targeted re-ask เฉพาะ field ที่ fail
- confidence model ต่อ field
- cross-field consistency checks
- layout-specific extraction fallback

### 4. Routing problem

ปัญหาที่เห็นแล้วในระบบจริง:
- `PTT`, `PTT OR`, `OR` แยกไม่ดี
- `Succo/Socco` ไม่ canonical
- blank/unknown vendor ยังโผล่ใน active rows
- vendor taxonomy ไม่ strict พอสำหรับ KPI และ example retrieval

---

## Target Architecture

```
Input Bill
  -> Preprocess
  -> DocType/Vendor/Layout Classifier
  -> Extract Pass 1 (LLM OCR + examples)
  -> Normalize
  -> Validate critical fields
  -> If failed:
       -> Targeted Repair Pass
       -> Cross-field consistency check
  -> Decision:
       -> auto_pass
       -> needs_review
  -> Log:
       -> OCR_RAW
       -> VALIDATION_TRACE
       -> TRAIN_CASES
       -> FIELD_DIFFS
       -> EXAMPLES (only trusted/approved path)
```

### Data classes that must be distinct

1. `audited_case`
- มี OCR output จริง
- มี corrected/final truth จริง
- ใช้คำนวณ OCR accuracy ได้

2. `accepted_case`
- ผู้ใช้ยืนยันว่า output ใช้งานได้
- ใช้เป็น acceptance / example signal ได้
- แต่ไม่ใช่ audited accuracy เสมอ

3. `proxy_case`
- derive จาก workflow logic หรือ fallback
- ใช้ภายในบาง flow ได้
- ห้ามเอาไปปน KPI หลัก

4. `example_case`
- trusted enough สำหรับ few-shot / vendor-layout memory

---

## North-Star KPIs

### Business KPIs

1. `critical_field_audited_accuracy`
- เป้าหมาย: >= 99%
- fields: `vendor_tax_id`, `invoice_number`, `invoice_date_th`, `total`

2. `document_auto_pass_precision`
- เป้าหมาย: >= 99%
- เมื่อระบบบอกว่า auto-pass แล้ว ต้องถูกจริงเกือบทั้งหมด

3. `manual_review_rate`
- เป้าหมาย: ลดลงต่อเนื่องโดยไม่กด quality ลง

4. `vendor_coverage`
- top vendors มี canonical routing + examples + validation ครบ

### Operational KPIs

1. `audited_case_count`
- ต้องมีจำนวนพอใช้ตัดสิน regression

2. `proxy_case_count`
- ต้องรายงานแยกเสมอ

3. `duplicate_case_rate`
- target = 0 ใน KPI source

4. `unknown_vendor_active_rate`
- target < 1% สำหรับ active production cases

---

## Workstreams

## WS1 — Metric Integrity

### Goal
ทำให้ทุก KPI สะท้อนความจริง และไม่มี proxy contamination

### Deliverables
- แยก `audited`, `accepted`, `proxy` ใน `OCR_TRAIN_CASES`
- KPI report ใหม่
- dashboard ใหม่
- source-aware filters ทุก workflow analytics

### Spec

#### 1. Add columns to `OCR_TRAIN_CASES`

ต้องมี column เพิ่ม:
```text
case_class | accepted_by_user | audited_by_admin | metric_eligible | example_eligible | source_confidence
```

Recommended semantics:
- `case_class`:
  - `audited`
  - `accepted`
  - `proxy`
  - `manual_seed`
- `accepted_by_user`:
  - `true/false`
- `audited_by_admin`:
  - `true/false`
- `metric_eligible`:
  - `true` เฉพาะ audited/manual trusted cases
- `example_eligible`:
  - `true` ถ้าใช้ few-shot ได้
- `source_confidence`:
  - `trusted/high/medium/low`

#### 2. Classification rules

`feedback_kpi`
- default: `case_class=audited`
- `metric_eligible=true`
- `example_eligible=true` ถ้า validation ผ่านและ correction complete

`telegram_train confirm`
- `case_class=accepted`
- `accepted_by_user=true`
- `metric_eligible=false`
- `example_eligible=true` ถ้าผ่าน trust rules

`telegram_train correct`
- `case_class=accepted`
- `metric_eligible=false`
- `example_eligible=true` หลัง normalize + approval rule

`manual`
- `case_class=manual_seed`
- `metric_eligible=true` ได้เฉพาะ benchmark/holdout approved rows

#### 3. KPI report contract

workflow `ocr-kpi-report` ต้อง report อย่างน้อย:
```json
{
  "audited_overall_accuracy_pct": 91,
  "audited_case_count": 9,
  "accepted_case_count": 23,
  "proxy_case_count": 0,
  "duplicate_rows_removed": 2,
  "audited_by_doc_type": [],
  "audited_by_vendor": [],
  "accepted_by_doc_type": [],
  "accepted_by_vendor": []
}
```

Telegram report ต้องขึ้นหัวข้อชัด:
- `Audited OCR Accuracy`
- `User Accepted Cases`
- `Proxy Cases Excluded`

#### 4. Duplicate prevention

ทุก analytics workflow ต้อง dedupe ตาม:
```text
primary key priority:
request_id > case_id > row_number
```

Retention rule:
- keep latest `created_at`
- ถ้า `created_at` เท่ากัน ใช้ `row_number` สูงกว่า

---

## WS2 — Canonical Vendor / Layout / DocType Routing

### Goal
ให้ OCR ใช้ examples/rules ถูกกลุ่ม และให้ KPI ไม่แตก vendor มั่ว

### Deliverables
- canonical `VENDOR_MAP`
- `LAYOUT_MAP`
- vendor/layout classifier contract
- normalization library ที่ใช้ร่วมกันในทุก workflow

### Spec

#### 1. Canonical vendor model

สร้าง canonical schema:
```json
{
  "vendor_code": "ptt_or",
  "vendor_name_canonical": "PTT OR",
  "vendor_name_aliases": ["PTT", "OR", "PTT OR", "ปตท", "ปตท.โออาร์"],
  "vendor_tax_ids": ["0107536000550", "..."],
  "default_doc_type": "fuel",
  "layout_family": ["ptt_or_tax_invoice_v1", "ptt_or_handwritten_v1"]
}
```

#### 2. Required maps

ต้องมี logical tables หรือ equivalent config:
- `VENDOR_MAP`
- `VENDOR_ALIAS_MAP`
- `LAYOUT_MAP`
- `DOC_TYPE_RULES`

#### 3. Resolution order

ทุก workflow ที่ต้องตี vendor/layout ใช้ order เดียวกัน:

1. explicit OCR `doc_type/layout/vendor` ถ้า confidence สูง
2. exact `vendor_tax_id`
3. alias by vendor text
4. layout fingerprint
5. fallback `unknown`

#### 4. Layout fingerprint

เก็บ fields เช่น:
- top labels found
- presence of Thai/English anchors
- section positions
- count of bills
- fuel/electricity/fleet-card heuristics

output:
```json
{
  "layout_id": "shell_tax_invoice_v2",
  "layout_confidence": 0.91
}
```

#### 5. KPI rules

KPI vendor grouping ห้ามใช้ raw string ตรงๆ อีก
ต้องใช้:
- `vendor_name_canonical`
- `layout_id`

---

## WS3 — Field-Critical Extraction Pipeline

### Goal
ให้ฟิลด์ critical ถูกต้องเกือบ 100% โดยใช้หลายชั้น ไม่ใช่ prompt อย่างเดียว

### Critical Fields v1
- `vendor_tax_id`
- `invoice_number`
- `invoice_date_th`
- `total`

### Phase design

#### Pass 0 — Preprocess
- image/PDF cleanup
- page split
- orientation fix
- contrast normalize
- OCR page metadata

#### Pass 1 — Initial extraction
- current LLM OCR + examples
- output canonical schema ทุกครั้ง

#### Pass 2 — Normalize
- trim
- Thai/English punctuation cleanup
- OCR confusion map เช่น `O/0`, `I/1`, `S/5`
- Thai date normalization if applicable
- money normalization

#### Pass 3 — Validate

Validators ต่อ field:

`vendor_tax_id`
- must be 13 digits
- optional checksum rule if applicable
- must not equal buyer tax id

`invoice_number`
- non-empty
- reject forbidden symbol patterns
- anchor proximity check
- vendor-specific regex if known

`invoice_date_th`
- parseable
- within allowed date range
- vendor/date-format rule by layout

`total`
- parseable decimal
- greater than zero
- within plausible amount range

#### Pass 4 — Cross-field consistency

Examples:
- `subtotal + vat ~= total`
- `quantity * unit_price ~= amount`
- `invoice_date` must not be future-dated beyond tolerance
- `vendor_tax_id` must match canonical vendor if vendor resolved

#### Pass 5 — Targeted repair

ถ้า field critical fail:
- ยิง targeted prompt/re-ask เฉพาะ field นั้น
- แนบ localized context หรือ cropped text region ถ้ามี
- อย่ารัน full extraction ใหม่เสมอ

#### Pass 6 — Decision gate

Decision:
- `auto_pass` ถ้า critical validators ผ่านทั้งหมด + confidence threshold + consistency ok
- `needs_review` ถ้ามี critical fail หรือ confidence ต่ำ

### Response schema changes

`/ocr-dev` response ควรมี:
```json
{
  "decision": "auto_pass|needs_review",
  "field_confidence": {
    "vendor_tax_id": 0.99,
    "invoice_number": 0.94,
    "invoice_date_th": 0.97,
    "total": 0.99
  },
  "field_validation": {
    "vendor_tax_id": {"ok": true, "code": "valid_tax_id"},
    "invoice_number": {"ok": false, "code": "anchor_not_found"},
    "invoice_date_th": {"ok": true, "code": "valid_date"},
    "total": {"ok": true, "code": "cross_check_pass"}
  },
  "used_reask": true,
  "validation_trace": []
}
```

---

## WS4 — Example Learning and Trusted Memory

### Goal
ทำให้ cases ที่ยืนยันแล้วมีผลกับ OCR รอบหน้าแบบควบคุมได้

### Principle

`accepted example` != `audited accuracy`

### Spec

#### 1. `OCR_EXAMPLES` split

เพิ่ม columns:
```text
example_class | trust_level | source_case_class | canonical_vendor | layout_id | active_for_prompt
```

Meaning:
- `example_class`
  - `trusted_gold`
  - `accepted_example`
  - `experimental`
- `trust_level`
  - `high`, `medium`, `low`

#### 2. Promotion rules

Telegram confirm:
- promote ไป `accepted_example`
- `trust_level=medium`
- ใช้กับ prompt ได้ ถ้า vendor/layout known และ validations ผ่าน

Admin corrected audited case:
- promote ไป `trusted_gold`
- `trust_level=high`
- priority สูงกว่า Telegram example

#### 3. Retrieval policy

ก่อน OCR extraction:
- ดึง examples ตาม `doc_type + canonical_vendor + layout_id`
- rank:
  1. `trusted_gold`
  2. `accepted_example`
  3. `experimental`
- cap จำนวน examples ต่อ request เช่น 3-5

#### 4. Expiration / pruning

examples ต้องมี pruning policy:
- stale > 90 days review
- duplicate examples merge
- superseded layout examples retire

---

## WS5 — Admin Feedback to Deterministic Improvement

### Goal
ให้ admin corrections ถูกใช้ "ทำให้ระบบดีขึ้นจริง" ไม่ใช่แค่เก็บไว้ดู

### Deliverables
- correction quality rules
- diff clustering
- prompt/rule proposal pipeline
- approval flow

### Spec

#### 1. Diff taxonomy

FIELD_DIFFS ต้องมี category มาตรฐาน:
- `missing`
- `wrong_value`
- `format_error`
- `cross_field_inconsistent`
- `vendor_misclassification`
- `layout_misclassification`

#### 2. Pattern clustering

cluster key:
```text
canonical_vendor + layout_id + field_name + diff_type
```

#### 3. Rule proposal thresholds

ถ้า cluster เดิมเกิด:
- >= 3 ครั้ง: create `suggestion`
- >= 5 ครั้ง และ precision สูง: create `draft_rule`
- >= 10 ครั้ง + holdout pass: eligible for `canary`

#### 4. Rule types

- `normalize`
- `post_validate`
- `anchor_preference`
- `vendor_override`
- `layout_route`
- `reject_pattern`

#### 5. Release controls

ห้าม auto-enable production rule ตรงๆ
ต้องผ่าน:
1. holdout benchmark
2. canary traffic
3. regression gate

---

## WS6 — Holdout Benchmark and Release Gate

### Goal
ไม่มี prompt/rule release ใดขึ้น production โดยไม่มี benchmark ที่เชื่อถือได้

### Deliverables
- curated holdout dataset
- per-field benchmark
- release checker

### Spec

#### 1. Benchmark sets

แยก 3 ชุด:

1. `train_examples`
- ใช้สร้าง examples/rules

2. `dev_regression`
- ใช้ iterate ระหว่างพัฒนา

3. `holdout_gold`
- ห้ามใช้สร้าง prompt/rules
- ใช้ตัดสิน release เท่านั้น

#### 2. Required benchmark dimensions

ต้องครอบคลุม:
- top vendors
- top layouts
- hard cases
- multi-bill
- fleet-card
- electricity
- handwritten / low-quality scans

#### 3. Release gate

ก่อน promote prompt/rule:
- critical field audited accuracy must not drop
- auto-pass precision must not drop
- unknown_vendor rate must not increase

#### 4. Required outputs

ทุก benchmark run ต้อง output:
```json
{
  "benchmark_run_id": "...",
  "overall_accuracy_pct": 0,
  "critical_field_accuracy": {},
  "by_vendor": {},
  "by_layout": {},
  "transport_fail_count": 0,
  "parse_fail_count": 0,
  "scored_count": 0,
  "holdout_pass": true
}
```

---

## WS7 — Review Queue and Human-in-the-Loop Precision

### Goal
ให้ระบบ auto-pass เฉพาะเคสที่มั่นใจจริง และโยนเฉพาะเคสเสี่ยงให้คนตรวจ

### Spec

#### Needs-review triggers

ต้อง review ถ้าอย่างน้อย 1 ข้อจริง:
- critical field validator fail
- layout unknown
- vendor unknown
- field confidence ต่ำกว่า threshold
- cross-field inconsistency
- multi-bill parsing ambiguous

#### Review output requirements

review UI / feedback payload ควรส่งกลับ:
- corrected fields
- reason code
- whether OCR was materially wrong or only normalization wrong

#### Queue priority

priority สูง:
- critical field fail
- top vendor
- high-value bill

---

## Phase Plan

## Phase A — Metric Cleanup and Trust Boundary (3-5 days)

### Objective
หยุด KPI หลอกตาทันที

### Work
1. เพิ่ม source-aware case classification
2. patch KPI report + dashboard
3. dedupe analytics
4. split `audited` / `accepted` / `proxy`

### Exit criteria
- ทุก daily KPI แสดง audited accuracy แยกจาก accepted cases
- proxy rows ไม่เข้า overall KPI

## Phase B — Canonical Routing Core (5-7 days)

### Objective
ให้ vendor/layout grouping สะอาด

### Work
1. canonical vendor map
2. alias map
3. layout fingerprint v1
4. normalize KPI/example retrieval ให้ใช้ canonical vendor

### Exit criteria
- active rows มี `unknown_vendor` ต่ำลงชัดเจน
- vendor breakdown ไม่แตกมั่ว

## Phase C — Critical Field Validation + Re-Ask (1-2 weeks)

### Objective
ทำให้ 4 critical fields เข้มขึ้นมาก

### Work
1. field validators
2. validation trace
3. targeted repair prompt
4. decision gate auto_pass/needs_review

### Exit criteria
- critical field audited accuracy ดีขึ้นบน dev benchmark
- false auto-pass ลดลง

## Phase D — Trusted Example Memory (1 week)

### Objective
ให้ Telegram/admin confirmed data มีผลต่อ OCR รอบหน้าแบบควบคุมได้

### Work
1. split example trust levels
2. trusted retrieval ranking
3. prune stale/duplicate examples

### Exit criteria
- OCR_EXAMPLES มี class ชัด
- top vendors ได้ trusted examples ครบ

## Phase E — Rule Learning Release Loop (ongoing)

### Objective
ให้ corrections กลายเป็น deterministic improvement

### Work
1. diff clustering
2. rule suggestions
3. benchmark gate
4. canary / rollback

### Exit criteria
- ทุก rule change มี benchmark evidence
- regressions rollback ได้

---

## Technical Spec by Workflow

## 1. `ocr-training` (`KW0QRXxRh9MjdPaY`)

### Required changes
- แยก `telegram_train confirm` กับ `telegram_train correct`
- ส่ง fields เพิ่มเข้า `ocr-km-log`:
```json
{
  "source": "telegram_train",
  "event_type": "confirm|correct",
  "accepted_by_user": true,
  "metric_eligible": false,
  "example_candidate": true
}
```

### Required behavior
- confirm:
  - create accepted example candidate
  - do not claim audited OCR accuracy
- correct:
  - create accepted example candidate + field diffs

## 2. `ocr-km-logger` (`jmJHPPj0OM5LcZ0n`)

### Required changes
- write `case_class`, `metric_eligible`, `example_eligible`
- preserve fallback baseline if needed for accepted flow
- but mark those rows as `metric_eligible=false`

### Required output
`train_case` example:
```json
{
  "case_id": "tc_...",
  "source": "telegram_train",
  "case_class": "accepted",
  "accepted_by_user": true,
  "audited_by_admin": false,
  "metric_eligible": false,
  "example_eligible": true,
  "ocr_accuracy_pct": 100,
  "notes": "accepted_by_user_baseline"
}
```

## 3. `ocr-feedback-receiver` (`ztJ8oCBHREUPPry6`)

### Required changes
- every admin feedback case must set:
```json
{
  "case_class": "audited",
  "audited_by_admin": true,
  "metric_eligible": true
}
```

### Required behavior
- no-diff audited case still counts as audited accuracy
- correction case goes to FIELD_DIFFS + pattern analysis

## 4. `ocr-km-suggest` (`NkKd02QyzLRcpIJM`)

### Required changes
- analyze only `metric_eligible=true` for accuracy KPI
- analyze `example_eligible=true` for example/rule opportunities
- report breakdown by:
  - audited
  - accepted
  - proxy

## 5. `ocr-kpi-report` (`yCqvdl3vrHGgiBMt`)

### Required changes
- audited KPI only
- accepted count separate
- proxy excluded count
- duplicate removed count

## 6. `ocr-dashboard` (`FsMOrto8DmG1LYjD`)

### Required changes
- tabs:
  - Audited Accuracy
  - User Accepted Cases
  - Proxy / Excluded
  - Vendor/Layout Coverage
  - Critical Field Failures

---

## Security Considerations (required)

> ตอบ 3 คำถามนี้ก่อนเสมอ:
> 1. มีจุดรับ input ใหม่ไหม? มี อาจมี fields เพิ่มใน webhook payload เดิม
> 2. มี secret/credential ใหม่ไหม? ไม่จำเป็นใน phase แรก
> 3. มีข้อมูล sensitive ที่อาจรั่วใน log/response/Telegram ไหม? มี vendor tax id, invoice number, totals, addresses

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| KPI / Telegram หลุดข้อมูลใบกำกับละเอียดเกินไป | report เฉพาะ aggregate; ไม่ส่ง raw field values |
| webhook payload ใหม่รับข้อมูลมากขึ้น | validate schema + truncate strings |
| correction/examples มี PII | ห้าม echo raw JSON ใน Telegram หรือ error response |
| prompt examples ใส่ข้อมูลเกินจำเป็น | sanitize examples ให้มีเฉพาะ fields ที่จำเป็น |
| unknown source ใช้ปน KPI | `metric_eligible` gate |

**Required security controls:**
- [ ] Auth บน webhook ใหม่ทุกตัว (x-api-key vs `$env.OCR_SHARED_API_KEY`)
- [ ] Input validation + truncation ก่อน write ไป Sheet/DB
- [ ] `continueOnFail: true` บน side-system calls (Drive, Sheets, Telegram)
- [ ] Error response ไม่ส่ง internal details ออก
- [ ] Aggregate report ไม่ expose raw OCR/corrected content

---

## Discussion

Concerns / tradeoffs:

1. ถ้าต้องการ "ใกล้ 100%" แต่ยังยึด LLM-only extraction โดยไม่มี validation gate ระบบจะตันเร็ว
2. ถ้าเอา Telegram confirm ไปนับ accuracy ต่อ จะได้เลขสวยแต่ใช้ตัดสิน release ไม่ได้
3. ถ้าจะให้ top vendors ดีจริง ต้องยอมลงทุนทำ vendor/layout-specific rules
4. ถ้ายังใช้ Google Sheets เป็น source-of-truth ต่อได้ในระยะสั้น แต่เมื่อ volume สูงขึ้น ควรมี DB mirror สำหรับ analytics/benchmark

Recommendation:
- ทำ Phase A-C ก่อน
- ถ้า critical fields ยังไม่ขยับหลัง Phase C ค่อยพิจารณา OCR engine/path ที่ deterministic เพิ่มเติม เช่น text-region extraction หรือ vendor-specific parser

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Telegram confirm case | Telegram flow | `accepted`, `metric_eligible=false`, `example_eligible=true` |
| T2 | Telegram correct case | Telegram flow | FIELD_DIFFS created, accepted example candidate stored |
| T3 | Admin no-diff feedback | feedback webhook | `audited`, `metric_eligible=true`, accuracy counted |
| T4 | Admin correction feedback | feedback webhook | TRAIN_CASES + FIELD_DIFFS + audited metric updated |
| T5 | KPI daily run | workflow execution | audited accuracy excludes Telegram proxy rows |
| T6 | Example retrieval | OCR request top vendor | trusted_gold examples ranked first |
| T7 | Validation fail + repair | OCR request crafted bad invoice number | targeted repair runs, validation trace present |
| T8 | Unknown vendor | OCR request | `needs_review`, no false auto-pass |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T9 | wrong API key | 401 |
| T10 | malformed payload | 422 |
| T11 | duplicate request_id in TRAIN_CASES | KPI dedupe removes duplicates |
| T12 | proxy rows exist | audited KPI unchanged |
| T13 | vendor alias conflict | canonical vendor resolution deterministic |
| T14 | prompt example unavailable | OCR continues without hard fail |
| T15 | validation repair fails | decision=`needs_review` |
| T16 | benchmark transport failure | not counted as accuracy=0 |

---

## Definition of Done

> Codex: อย่า mark Done ถ้ายังไม่ครบทุก checkbox

**Implemented:**
- [ ] `OCR_TRAIN_CASES` schema supports audited/accepted/proxy split
- [ ] KPI report and dashboard split accuracy by source class
- [ ] canonical vendor/layout routing implemented
- [ ] critical field validation layer implemented
- [ ] targeted repair flow implemented
- [ ] trusted example ranking implemented
- [ ] release benchmark and holdout gate implemented

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [ ] live workflow re-fetch confirms new fields/logic
- [ ] TRAIN_CASES rows show correct case classes
- [ ] KPI execution confirms audited metric excludes Telegram accepted cases
- [ ] benchmark run returns per-field audited accuracy
- [ ] validation trace visible in OCR execution payload

**E2E Passed:**
- [ ] Exec ID: `_______` — Telegram confirm path
- [ ] Exec ID: `_______` — Admin correction path
- [ ] Exec ID: `_______` — KPI daily run
- [ ] Exec ID: `_______` — OCR request with targeted repair

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Implementation Order (Recommended)

### Sprint 1
- WS1 Metric Integrity
- WS2 Canonical Vendor Routing

### Sprint 2
- WS3 Critical Field Validation
- WS7 Human Review Gate

### Sprint 3
- WS4 Trusted Example Memory
- WS5 Rule Proposal Pipeline

### Sprint 4
- WS6 Holdout Benchmark Gate
- Canary / rollback automation

---

## Immediate Next Actions

1. Patch `TRAIN_CASES` write path to add `case_class`, `metric_eligible`, `example_eligible`
2. Patch dashboard to display `Audited OCR Accuracy` only
3. Implement validator library for 4 critical fields
4. Build first top-vendor canonical map for:
   - PTT OR
   - Shell
   - Caltex
   - Succo/Socco
   - Bangchak
   - PT MAX LPG
   - MEA
   - KTB Fleet
5. Create holdout benchmark set for top vendors before next prompt/rule rollout

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```

