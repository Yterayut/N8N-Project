# T052C — Critical Field Validation and Targeted Repair

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex
**Priority:** Critical
**Risk:** สูง
**Depends on:** T047, T052B

---

## Overview

การดัน OCR เข้าใกล้ 100% จะตันถ้ายังใช้ extraction pass เดียวแล้วเชื่อผลทันที
T052C เพิ่ม validation + repair loop สำหรับ 4 critical fields:
- `vendor_tax_id`
- `invoice_number`
- `invoice_date_th`
- `total`

เป้าคือให้ OCR ตัดสินได้ว่า field ไหน "เชื่อได้" และ field ไหนต้องซ่อมหรือส่ง review

---

## Scope

**In scope:**
- canonical validators
- field confidence + validation result
- targeted repair pass
- decision gate `auto_pass|needs_review`
- validation trace persistence

**Out of scope (explicit):**
- full UI review redesign
- OCR provider fine-tune
- full line-item accuracy

---

## Technical Spec

### 1. Validation module

Implement shared validation logic for:

#### `vendor_tax_id`
- 13 digits only
- normalized leading zero handling
- reject buyer tax id if known
- optionally checksum if available

#### `invoice_number`
- non-empty
- max length
- vendor/layout-specific regex rules if available
- anchor confidence available

#### `invoice_date_th`
- parseable date
- valid Buddhist/Gregorian transform if used
- not wildly future-dated

#### `total`
- parseable decimal
- > 0
- within plausible range

### 2. Cross-field consistency

Checks:
- `subtotal + vat ~= total`
- `quantity * unit_price ~= amount`
- vendor tax id consistent with canonical vendor

### 3. Targeted repair flow

When critical validation fails:
- build targeted prompt for failed field(s) only
- reuse OCR raw context or bill JSON context
- run one repair pass
- merge repaired fields back

Do not run infinite loops.
Max attempts:
- initial extraction = 1
- targeted repair = 1

### 4. Decision gate

Rules:
- `auto_pass` only if all critical validations pass
- `needs_review` if any critical fail

### 5. Response contract

`/ocr-dev` response must include:
```json
{
  "decision": "auto_pass",
  "field_confidence": {},
  "field_validation": {},
  "used_reask": true,
  "validation_trace": []
}
```

### 6. Persistence

Store validation trace in execution payload and/or downstream persistence:
- request_id
- failed fields
- repair attempted
- final decision

### 7. Workflows to patch

Primary:
- `up1n75qEhbsXswii`

Potential nodes:
- `Code (Parse Result)`
- `Code (Normalize + Validate)`
- any existing re-ask path
- response builder nodes

---

## Security Considerations (required)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| repair prompt leaks sensitive content | send minimal necessary context only |
| invalid repair overwrites good value | keep trace of original + repaired values |
| added API latency too high | single repair pass only + timeout budget |

**Required security controls:**
- [x] sanitize repair prompt context
- [x] bounded retries
- [x] validation errors do not expose internal trace to unauthorized callers

---

## Discussion

Primary tradeoff:
- better quality vs extra latency

Implementation bias:
- validate critical fields only first
- one repair pass only

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | valid fuel bill | OCR request | decision=`auto_pass` |
| T2 | invalid invoice number first pass | OCR request | repair pass corrects field |
| T3 | invalid total first pass | OCR request | repair or `needs_review` |
| T4 | vendor tax id invalid | OCR request | not auto-pass |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T5 | repair timeout | fallback `needs_review` |
| T6 | cross-field inconsistency persists | `needs_review` |
| T7 | unknown layout | `needs_review` |

---

## Definition of Done

**Implemented:**
- [x] validator library for 4 critical fields
- [x] cross-field checks implemented
- [x] targeted repair pass implemented
- [x] decision gate implemented
- [x] response includes validation metadata

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [x] OCR execution shows validation trace
- [x] crafted invalid cases no longer auto-pass
- [x] valid cases still auto-pass

**E2E Passed:**
- [x] Exec ID: `157807` — invalid critical field (`invoice_date_th`) goes `needs_review` with `field_validation`
- [x] Exec ID: `157801` — valid critical set goes `auto_pass`

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file created

---

## Closing Template

```
Runtime patched:
- `up1n75qEhbsXswii`: `Code (Normalize + Validate)`, `Code (Build Re-ask Request)`, `Code (Apply Re-ask Result)`, `Code (Finalize Decision)`, `Respond to Webhook6`
Verified from:
- `/webhook/ocr-dev` exec `157801` (`PTT-OR.pdf`) => `decision=auto_pass`, `field_validation` all pass
- `/webhook/ocr-dev` exec `157807` (`shell.pdf`) => `decision=needs_review`, `used_reask=true`, critical fail persists
- response now includes `field_validation`, `field_confidence`, `validation_trace`, `used_reask`
Docs synced:
- task file updated
- `HANDOFF.md` updated
Remaining limits:
- targeted repair currently single-pass parse merge; full post-repair re-validation loop ยังไม่เพิ่ม (safe fallback = `needs_review`)
```
