# T052D — Trusted Example Memory and Retrieval Ranking

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง
**Depends on:** T027, T052A, T052B

---

## Overview

ตอนนี้ระบบใช้ `OCR_EXAMPLES` เป็น few-shot memory แล้ว แต่ยังไม่แยกว่า example ไหนเชื่อถือระดับไหน
ผลคือ Telegram accepted examples กับ audited corrected examples อาจถูกใช้ปนกันโดยไม่มี ranking/control ที่ชัด

T052D ทำให้ example memory เป็น trusted system:
- classify examples by trust
- rank retrieval
- prune stale/duplicate examples

---

## Scope

**In scope:**
- `OCR_EXAMPLES` schema extension
- trusted example classes
- retrieval ranking policy
- duplicate/staleness pruning

**Out of scope (explicit):**
- full vector search
- ML embedding retrieval

---

## Technical Spec

### 1. `OCR_EXAMPLES` new fields

Add columns:
```text
example_class | trust_level | source_case_class | canonical_vendor | layout_id | active_for_prompt
```

### 2. Example classes

- `trusted_gold`
- `accepted_example`
- `experimental`

### 3. Promotion rules

Admin audited corrected case:
- `example_class='trusted_gold'`
- `trust_level='high'`

Telegram confirm/correct:
- `example_class='accepted_example'`
- `trust_level='medium'`

Manual/internal test:
- `example_class='experimental'`
- `trust_level='low'`

### 4. Retrieval ranking

Main OCR flow must rank:
1. `trusted_gold`
2. `accepted_example`
3. `experimental`

Within same class:
1. same `canonical_vendor`
2. same `layout_id`
3. same `doc_type`
4. latest `updated_at`

### 5. Prompt cap

Cap examples per request:
- total max 5
- `trusted_gold` preferred

### 6. Pruning rules

Mark stale when:
- not used for 90 days
- layout superseded
- exact duplicate gold_json

### 7. Workflows to patch

- `ocr-examples-api`
- `ocr-training`
- any path that creates/promotes examples
- main OCR read examples path in `up1n75qEhbsXswii`

---

## Security Considerations (required)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| prompt stuffed with too much sensitive data | cap examples + sanitize content |
| low-trust example hurts production OCR | trust-ranked retrieval |

**Required security controls:**
- [x] only active trusted examples go to production prompt
- [x] sanitize example payload before prompt injection

---

## Discussion

No concerns — proceeding.

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | audited case promoted | feedback flow | `trusted_gold` example created |
| T2 | Telegram confirm promoted | training flow | `accepted_example` created |
| T3 | OCR request top vendor | inspect prompt assembly | trusted_gold chosen first |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T4 | duplicate example | deduped/pruned |
| T5 | stale example | marked inactive/review |

---

## Definition of Done

**Implemented:**
- [x] `OCR_EXAMPLES` extended with trust fields
- [x] example promotion logic split by source/trust
- [x] retrieval ranking implemented
- [x] stale/duplicate pruning implemented

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [x] example rows show expected classes
- [x] prompt retrieval uses trusted ranking

**E2E Passed:**
- [x] Exec ID: `157811` — create example rows with `trusted_gold` and `accepted_example`
- [x] Exec ID: `157812` — read examples returns trusted row first

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file created

---

## Closing Template

```
Runtime patched:
- `LzYmwkdRfOxbCrwB`: `Router`, `Build Create Row`, `Build Update Row`, `Format Read Response`
- `KW0QRXxRh9MjdPaY`: `Code node: Build Examples API Command` trust metadata from Telegram training path
- `up1n75qEhbsXswii`: `Code (Build Few-shot Query)`, `Code (Select Few-shot Examples)` ranking + cap 5
- `up1n75qEhbsXswii`: `Code (Build Feedback Diff)` audited correction -> trusted example metadata
Verified from:
- `/webhook/ocr-examples-api` create/read calls (exec `157811`, `157812`) confirm classes and ranking order
- read response shows `trusted_gold` before `accepted_example` for same canonical vendor/layout/doc_type
Docs synced:
- task file updated
- `HANDOFF.md` updated
Remaining limits:
- pruningตอนนี้ทำแบบ runtime filter + dedupe ใน read path (ยังไม่ทำ batch mark-inactive backfill บน sheet)
```
