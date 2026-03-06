# T052B — Canonical Vendor and Layout Routing

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง
**Depends on:** T047, T051, T052A

---

## Overview

ระบบยังมี vendor/layout ambiguity เช่น `PTT`, `PTT OR`, `OR`, `Succo/Socco`, blank vendor, และ raw tax-id vendors
ซึ่งทำให้:
- example retrieval ไม่ตรงกลุ่ม
- KPI แตก vendor มั่ว
- rule analysis กระจาย
- doc_type/layout fallback ไม่แน่นพอ

เป้าของ T052B คือทำ canonical routing layer กลางที่ทุก workflow ใช้ตรงกัน

---

## Scope

**In scope:**
- canonical vendor model
- vendor alias map
- layout map/fingerprint v1
- patch workflows ให้ใช้ canonical vendor/layout

**Out of scope (explicit):**
- ยังไม่ทำ vision/layout detection ขั้นสูง
- ยังไม่แก้ benchmark scoring
- ยังไม่ทำ validator/re-ask

---

## Technical Spec

### 1. New config sources

ต้องมี logical config tables หรือ equivalent code constants:
- `VENDOR_MAP`
- `VENDOR_ALIAS_MAP`
- `LAYOUT_MAP`

Recommended canonical fields:
```text
vendor_code | vendor_name_canonical | alias | vendor_tax_id | default_doc_type | layout_family | active
```

### 2. Canonical vendor requirements

Top vendors ที่ต้อง cover ในรอบแรก:
- `ptt_or`
- `shell`
- `caltex`
- `susco`
- `bangchak`
- `pt_max_lpg`
- `mea`
- `ktb_fleet`
- `siam_gas`
- `scg_prawet`

### 3. Alias examples

```javascript
{
  "PTT": "ptt_or",
  "PTT OR": "ptt_or",
  "OR": "ptt_or",
  "ปตท": "ptt_or",
  "Succo/Socco": "susco",
  "Susco": "susco",
  "ซัสโก้": "susco"
}
```

### 4. Resolution order

Every workflow using vendor/doc_type/layout must resolve in this order:
1. exact canonical tax-id match
2. alias text match
3. OCR doc_type/layout hint
4. layout fingerprint
5. fallback `unknown`

### 5. Layout fingerprint v1

Create helper function:
```javascript
fingerprintLayout(bill, rawText, metadata) => {
  layout_id,
  layout_confidence,
  matched_signals
}
```

Signals may include:
- anchor labels
- company header patterns
- page count
- multi-bill presence
- table structure hints

### 6. Workflows to patch

#### `up1n75qEhbsXswii` ocr-invoice-processor
- normalize OCR `vendor_name`
- attach `canonical_vendor_code`
- attach `layout_id`

#### `jmJHPPj0OM5LcZ0n` ocr-km-logger
- write canonical vendor/layout into TRAIN_CASES/FIELD_DIFFS

#### `KW0QRXxRh9MjdPaY` ocr-training
- use canonical vendor when building km payload

#### `NkKd02QyzLRcpIJM` ocr-km-suggest
- group by canonical vendor instead of raw vendor string

#### `yCqvdl3vrHGgiBMt` ocr-kpi-report
- report canonical vendors only

### 7. Required field additions

Recommended new columns in `OCR_TRAIN_CASES`:
```text
vendor_code | vendor_name_canonical | layout_id | layout_confidence
```

Recommended new columns in `OCR_TRAIN_FIELD_DIFFS`:
```text
vendor_code | layout_id
```

---

## Security Considerations (required)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| wrong alias mapping rewrites vendor incorrectly | keep mapping versioned + test coverage |
| canonical backfill corrupts historical data | dry-run + row-level sample verification |

**Required security controls:**
- [x] no unsafe overwrite without exact matching rule
- [x] preserve original raw vendor field for audit
- [x] backfill workflow temporary only

---

## Discussion

No concerns — proceeding.

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | PTT row | canonical resolve | vendor_code=`ptt_or` |
| T2 | OR row | canonical resolve | vendor_code=`ptt_or` |
| T3 | Succo/Socco row | canonical resolve | vendor_code=`susco` |
| T4 | KPI run | report canonical vendors | no split PTT/PTT OR/OR |
| T5 | km-suggest | pattern analysis by canonical vendor | grouped correctly |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T6 | unknown tax-id + unknown alias | vendor remains unknown |
| T7 | conflicting alias/tax-id | tax-id match wins |
| T8 | historical blank vendor rows | backfill only when resolvable |

---

## Definition of Done

**Implemented:**
- [x] canonical vendor config created
- [x] alias mapping created
- [x] layout fingerprint v1 implemented
- [x] workflows use canonical vendor/layout
- [x] historical backfill complete

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [x] sample rows resolve to expected canonical vendor
- [x] KPI report no longer splits same vendor across aliases
- [x] km-suggest groups by canonical vendor

**E2E Passed:**
- [x] Exec ID: `157801` — OCR response includes canonical vendor/layout
- [x] Exec ID: `157828` — KPI groups PTT/PTT OR/OR into one vendor (`PTT OR`)

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file created

---

## Closing Template

```
Runtime patched:
- `up1n75qEhbsXswii`: `Code (Normalize + Validate)` canonical vendor+layout routing
- `jmJHPPj0OM5LcZ0n`: `Code (Compute Diffs)` add `vendor_code/layout_id/cluster_key`
- `KW0QRXxRh9MjdPaY`: `Code (Prepare KM Log Payload)` canonical fields passthrough
- `yCqvdl3vrHGgiBMt`: `Code node: Aggregate KPI` canonical vendor aggregation
- `NkKd02QyzLRcpIJM`: `Code (Analyze Patterns)` canonical grouping key
Verified from:
- `/webhook/ocr-dev` live OCR exec `157801` (`PTT-OR.pdf`) returns `vendor_code=ptt_or`, `layout_id=ptt_or_fuel_v1`
- `OCR_TRAIN_CASES` row `55/56` (request `t052_probe_audited_01`, `t052_probe_accept_01`) show `vendor_code`, `vendor_name_canonical`, `layout_id`, `layout_confidence`
- `OCR_TRAIN_FIELD_DIFFS` rows `326/327` include `vendor_code/layout_id/cluster_key`
- `ocr-km-suggest` exec `157791` runData contains `vendor_code/layout_id/cluster_key`
- maintenance backfill webhooks updated historical rows: TRAIN_CASES `updated_count=53`, FIELD_DIFFS `updated_count=324`
- post-backfill check: active TRAIN_CASES missing `vendor_code/layout_id` = `0`, FIELD_DIFFS missing `vendor_code/layout_id/cluster_key` = `0`
Docs synced:
- task file updated
- `HANDOFF.md` updated
Remaining limits:
- row-level vendor canonicalization still depends on available tax-id/vendor text quality for some legacy unknown rows
- KPI workflow (`yCqvdl3vrHGgiBMt`) ไม่มี manual webhook/run endpoint ใช้งานได้ใน env นี้ (verify ใช้ scheduled execution ชั่วคราว minute-interval แล้ว restore กลับ 08:00)
```
