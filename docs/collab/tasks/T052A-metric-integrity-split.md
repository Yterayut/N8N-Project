# T052A — Metric Integrity Split: Audited vs Accepted vs Proxy

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex
**Priority:** Critical
**Risk:** กลาง
**Depends on:** T050, T051

---

## Overview

KPI ปัจจุบันยังมีความเสี่ยงตีความผิด เพราะ source data ใน `OCR_TRAIN_CASES` ปะปนกันระหว่าง:
- `feedback_kpi` ที่เป็น audited OCR correction
- `telegram_train` ที่เป็น accepted/training flow
- rows ที่ derive จาก fallback logic หรือ duplicate rows

ผลคือ `Overall Accuracy` เคยสูงเกินจริง และ vendor/doc_type breakdown ถูกดันโดย proxy/accepted rows ที่ไม่ควรนับเป็น OCR audited metric

เป้าของ T052A คือแยก trust boundary ให้ชัด:
- อะไรนับ `Audited OCR Accuracy`
- อะไรนับ `User Accepted Cases`
- อะไรเป็น `Proxy/Excluded`

โดยไม่ไปแตะ main OCR extraction ในรอบนี้

---

## Scope

**In scope:**
- เพิ่ม source classification fields ใน `OCR_TRAIN_CASES`
- patch `ocr-km-logger`, `ocr-training`, `ocr-feedback-receiver`, `ocr-kpi-report`, `ocr-dashboard`
- dedupe KPI/report/dashboard ตาม `request_id`
- เปลี่ยน daily KPI wording และ output contract

**Out of scope (explicit):**
- ยังไม่แก้ extraction logic
- ยังไม่แก้ OCR prompt
- ยังไม่ทำ benchmark holdout
- ยังไม่ทำ validator / repair loop

---

## Technical Spec

### 1. `OCR_TRAIN_CASES` schema extension

เพิ่ม columns ต่อท้าย:
```text
case_class | accepted_by_user | audited_by_admin | metric_eligible | example_eligible | source_confidence
```

ความหมาย:
- `case_class`
  - `audited`
  - `accepted`
  - `proxy`
  - `manual_seed`
- `accepted_by_user`
  - `true` เมื่อ user confirm/correct ผ่าน Telegram
- `audited_by_admin`
  - `true` เมื่อมาจาก admin feedback
- `metric_eligible`
  - `true` เฉพาะ rows ที่นับ OCR accuracy หลักได้
- `example_eligible`
  - `true` ถ้าใช้ใน example memory ได้
- `source_confidence`
  - `trusted`
  - `high`
  - `medium`
  - `low`

### 2. Classification rules

#### `feedback_kpi`
- `case_class='audited'`
- `audited_by_admin=true`
- `accepted_by_user=false`
- `metric_eligible=true`
- `example_eligible=true`
- `source_confidence='trusted'`

#### `telegram_train` confirm
- `case_class='accepted'`
- `accepted_by_user=true`
- `audited_by_admin=false`
- `metric_eligible=false`
- `example_eligible=true`
- `source_confidence='medium'`

#### `telegram_train` correct
- `case_class='accepted'`
- `accepted_by_user=true`
- `audited_by_admin=false`
- `metric_eligible=false`
- `example_eligible=true`
- `source_confidence='medium'`

#### fallback / synthetic / special rows
- `case_class='proxy'`
- `metric_eligible=false`
- `example_eligible=false`
- `source_confidence='low'`

#### manual benchmark rows
- `case_class='manual_seed'`
- `metric_eligible=true`
- `example_eligible=false` by default
- `source_confidence='trusted'`

### 3. Workflow changes

#### 3.1 `ocr-km-logger` (`jmJHPPj0OM5LcZ0n`)

Patch `Code (Compute Diffs)`:
- derive new fields from `source` + `event_type` + payload metadata
- preserve current `ocr_accuracy_pct` behavior if needed for accepted rows
- but set `metric_eligible=false` for any Telegram-driven accepted row

`train_case` target object must include:
```javascript
case_class,
accepted_by_user,
audited_by_admin,
metric_eligible,
example_eligible,
source_confidence
```

#### 3.2 `ocr-training` (`KW0QRXxRh9MjdPaY`)

Patch `Code (Prepare KM Log Payload)`:
- include `event_type: 'confirm' | 'correct'`
- include `accepted_by_user: true`
- include `metric_eligible: false`

#### 3.3 `ocr-feedback-receiver` (`ztJ8oCBHREUPPry6`)

Patch km-log payload:
- include `audited_by_admin: true`
- include `metric_eligible: true`
- include `case_class: 'audited'`

#### 3.4 `ocr-kpi-report` (`yCqvdl3vrHGgiBMt`)

Patch `Code node: Aggregate KPI`:
- dedupe active rows by `request_id`
- audited KPI uses `metric_eligible=true`
- accepted count uses `case_class='accepted'`
- proxy count uses `case_class='proxy'` or `metric_eligible=false && example_eligible=false`

Required output:
```json
{
  "audited_overall_accuracy_pct": 0,
  "audited_case_count": 0,
  "accepted_case_count": 0,
  "proxy_case_count": 0,
  "duplicate_rows_removed": 0
}
```

Telegram text must include:
- `Audited OCR Accuracy`
- `User Accepted Cases`
- `Proxy Cases Excluded`
- `Duplicate Rows Removed`

#### 3.5 `ocr-dashboard` (`FsMOrto8DmG1LYjD`)

Patch HTML builder:
- summary cards:
  - Audited OCR Accuracy
  - Audited Cases
  - User Accepted Cases
  - Proxy/Excluded Cases
- charts only use `metric_eligible=true` when labeled "accuracy"

### 4. Dedupe rules

For analytics/reporting:
1. key = `request_id`
2. fallback key = `case_id`
3. keep latest `created_at`
4. tie-break by `row_number` higher wins

### 5. Backfill plan

Historical rows in `OCR_TRAIN_CASES`:
- populate new columns with one-shot maintenance workflow
- use current `source`, `notes`, and known patterns

Backfill rule examples:
- `source='feedback_kpi'` -> `audited`
- `source='telegram_train'` -> `accepted`
- blank/legacy synthetic rows -> `proxy`

---

## Security Considerations (required)

> 1. มีจุดรับ input ใหม่ไหม? ไม่มี webhook ใหม่ แต่ payload เดิมมี fields เพิ่ม
> 2. มี secret/credential ใหม่ไหม? ไม่มี
> 3. มีข้อมูล sensitive ที่อาจรั่วไหม? มี invoice metadata ใน TRAIN_CASES

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| KPI report ส่ง raw data มากเกินไป | ส่ง aggregate only |
| backfill script แก้ rows ผิดประเภท | dry-run ก่อน apply + verify sample rows |
| accepted rows หลุดไปนับ audited | `metric_eligible` gate เดียวในทุก analytics workflow |

**Required security controls:**
- [x] No raw OCR/corrected JSON in Telegram KPI
- [x] Validate new enum values before write
- [x] Side-system writes `continueOnFail=true`
- [x] Backfill workflow archived/deleted after use

---

## Discussion

Deviation observed during implementation:
- The live `OCR_TRAIN_CASES` sheet did not contain T052A columns in historical rows at rollout time, and n8n manual run endpoint remains unreliable in this environment.
- Safe alternative applied:
  - rollout done through live webhook-driven writes (`ocr-km-log`) to create/verify new columns safely
  - KPI and dashboard include backward-compatible fallback classification from `source` when new columns are blank
  - one-shot maintenance workflow `tmp-t052a-backfill-case-class` (`kAWZ4wdn78vn8EGV`) used to backfill historical rows, then archived and deleted immediately after run
- Result:
  - new rows are classified correctly
  - historical active rows are now fully populated for classification fields
  - scheduled KPI evidence captured via temporary minute-interval trigger and restored to daily `08:00`

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Telegram confirm row | run Telegram confirm flow | `case_class=accepted`, `metric_eligible=false` |
| T2 | Telegram correct row | run Telegram correct flow | `case_class=accepted`, `example_eligible=true` |
| T3 | Admin feedback row | POST feedback | `case_class=audited`, `metric_eligible=true` |
| T4 | KPI run | manual/scheduled run | audited accuracy excludes accepted rows |
| T5 | Dashboard | open dashboard | audited cards/charts exclude accepted rows |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T6 | duplicate request_id rows | only latest row counted |
| T7 | missing new columns in old rows | backfill populates safely |
| T8 | legacy proxy row | not counted in audited accuracy |

---

## Definition of Done

**Implemented:**
- [x] `OCR_TRAIN_CASES` extended with 6 new fields (verified on new rows)
- [x] km-logger writes classification fields
- [x] training flow writes accepted metadata
- [x] feedback flow writes audited metadata
- [x] KPI report split audited/accepted/proxy (logic patched live)
- [x] dashboard split audited/accepted/proxy
- [x] historical rows backfilled

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [x] live workflow fetch confirms new code
- [x] sample TRAIN_CASES rows show expected classification
- [x] KPI split verified from live sheet state using patched classification logic (audited/accepted/proxy)
- [x] dashboard render shows split metrics

**E2E Passed:**
- [x] Exec ID: `157720` — Telegram confirm classified as accepted
- [x] Exec ID: `157717` — Admin feedback classified as audited
- [x] Exec ID: `157982` — Scheduled KPI run after T052A patch (trigger mode) with split metrics emitted

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file created

---

## Closing Template

```
Runtime patched: Patched live workflows via n8n REST API — `jmJHPPj0OM5LcZ0n` (`Code (Compute Diffs)`), `KW0QRXxRh9MjdPaY` (`Code (Prepare KM Log Payload)`), `ztJ8oCBHREUPPry6` (`Code (Prepare KM Log Payload)`), `yCqvdl3vrHGgiBMt` (`Code node: Aggregate KPI`), `FsMOrto8DmG1LYjD` (`Code (Build HTML)`) to implement T052A audited/accepted/proxy classification and source-safe fallback.
Verified from: live workflow re-fetch signature checks passed; `ocr-km-log` probes wrote row `53` (audited) and row `54` (accepted) into `OCR_TRAIN_CASES` with new fields populated; one-shot backfill webhook `/webhook/t052a-backfill-case-class` execution `157980` updated `34` historical active rows; sheet verification via `gg-data?sheet=TRAIN_CASES` now shows `missing_case_class_active=0` and all 6 classification fields fully populated; scheduled KPI execution `157982` (trigger mode) emits split counts (`audited_case_count=12`, `accepted_case_count=25`, `proxy_case_count=0`); dashboard webhook returned `200` and rendered `Audited Accuracy`, `User Accepted Cases`, `Proxy/Excluded`.
Docs synced: T052A task spec updated with DoD status and deviation notes; HANDOFF recently completed section updated with T052A entry; review file created.
Remaining limits: n8n `/rest/workflows/{id}/run` remains unstable in this environment, so scheduled evidence still uses temporary trigger cadence switch + restore pattern.
```
