# T052E — Admin Feedback to Rule Learning Pipeline

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง
**Depends on:** T039, T052A, T052B

---

## Overview

Admin feedback ถูกเก็บแล้ว แต่ยังต้องทำให้กลายเป็น deterministic improvement อย่างเป็นระบบ
T052E ทำ pipeline จาก correction -> diff cluster -> suggestion -> draft rule

---

## Scope

**In scope:**
- diff taxonomy normalization
- clustering by canonical vendor/layout/field
- suggestion thresholds
- draft rule generation

**Out of scope (explicit):**
- auto-activate production rule without review

---

## Technical Spec

### 1. Diff taxonomy standard

Normalize FIELD_DIFFS `diff_type` to:
- `missing`
- `wrong_value`
- `format_error`
- `cross_field_inconsistent`
- `vendor_misclassification`
- `layout_misclassification`

### 2. Cluster key

```text
vendor_code + layout_id + field_name + diff_type
```

### 3. Thresholds

- 3 occurrences -> create `suggestion`
- 5 occurrences -> create `draft_rule_candidate`
- 10 occurrences + benchmark pass -> canary eligible

### 4. Rule objects

Support rule types:
- `normalize`
- `post_validate`
- `anchor_preference`
- `vendor_override`
- `layout_route`
- `reject_pattern`

### 5. Target stores

May reuse `OCR_KM_LESSONS` or create structured store with:
```text
rule_id | rule_type | vendor_code | layout_id | field_name | pattern_json | replacement_json | support_count | status
```

### 6. Workflow changes

- patch `ocr-km-suggest`
- optionally patch lesson/report workflow

---

## Security Considerations (required)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| false pattern creates bad rule suggestion | minimum threshold + review gate |
| sensitive values copied into lessons | sample values truncated/redacted |

**Required security controls:**
- [x] no auto-enable of active rule
- [x] redact long sample values in notifications

---

## Discussion

No concerns — proceeding.

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | 3 same field diffs | seed/test | suggestion created |
| T2 | 5 same diffs | seed/test | draft candidate created |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T3 | mixed vendor aliases | clustered under same canonical vendor |
| T4 | single noisy diff | no suggestion |

---

## Definition of Done

**Implemented:**
- [x] normalized diff taxonomy
- [x] clustering by canonical vendor/layout/field
- [x] suggestion thresholds implemented
- [x] lesson/rule candidate persistence implemented

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [x] repeated patterns create expected suggestion rows
- [x] noisy singletons do not create suggestions

**E2E Passed:**
- [x] Exec ID: `157791` — repeated correction patterns produce `suggestion` / `draft_rule_candidate` / `canary_eligible`
- [x] Exec ID: `157984` — generated lessons have `min_support_count=3` and `lessons_with_support_lt3=0`

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file created

---

## Closing Template

```
Runtime patched:
- `NkKd02QyzLRcpIJM`: `Code (Analyze Patterns)` diff taxonomy normalize + cluster key (`vendor_code|layout_id|field_name|diff_type`) + threshold statuses
- `jmJHPPj0OM5LcZ0n`: `Code (Compute Diffs)` writes canonical cluster fields to FIELD_DIFFS
Verified from:
- `/webhook/ocr-km-suggest` exec `157791` success (`new_lessons=36`)
- execution_data grep confirms generated statuses include `suggestion`, `draft_rule_candidate`, `canary_eligible`
- execution_data contains `cluster_key`, `vendor_code`, `layout_id` fields
- `/webhook/ocr-km-suggest` exec `157984` confirms anti-noise gate: `generated_lessons=36`, `min_support_count=3`, `lessons_with_support_lt3=0`
Docs synced:
- task file updated
- `HANDOFF.md` updated
- review file created
Remaining limits:
- singleton suppression relies on support-threshold gate (`>=3`) and does not yet include a separate synthetic noise fixture harness
```
