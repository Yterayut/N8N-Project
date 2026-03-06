# T052F — Holdout Benchmark and Release Gate

**Author:** Codex
**Date:** 2026-03-05
**Assignee:** Codex
**Priority:** Critical
**Risk:** กลาง
**Depends on:** T029D, T052A, T052B, T052C

---

## Overview

ถ้ายังไม่มี holdout benchmark และ release gate ทุก prompt/rule change จะเสี่ยง regression แบบมองไม่เห็น
T052F สร้าง benchmark ชั้น production decision:
- train/dev/holdout split
- per-field audited benchmark
- release gate ก่อน promote prompt/rule

---

## Scope

**In scope:**
- benchmark dataset split
- benchmark workflow/output contract
- release gate checker
- canary/rollback criteria

**Out of scope (explicit):**
- external CI/CD platform redesign

---

## Technical Spec

### 1. Dataset split

Create 3 sets:
- `train_examples`
- `dev_regression`
- `holdout_gold`

Holdout rules:
- not used in prompt examples
- not used in rule derivation
- only used for release decision

### 2. Benchmark dimensions

Must cover:
- top vendors
- top layouts
- hard/low-quality bills
- electricity
- fleet_card
- multi-bill

### 3. Output contract

Benchmark output:
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

### 4. Release gate

Block release if:
- critical field accuracy drops
- auto-pass precision drops
- unknown vendor rate rises

### 5. Canary gate

Statuses:
- `draft`
- `benchmark_passed`
- `canary`
- `active`
- `rolled_back`

### 6. Workflows/tools to patch

- benchmark runner
- KPI gate checker
- release helper / maintenance workflow if needed

---

## Security Considerations (required)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| holdout data leaked into examples | explicit dataset separation + checks |
| transport failures counted as accuracy failures | separate fail classes in output |

**Required security controls:**
- [x] holdout dataset not used in prompt retrieval
- [x] transport/parse failures separated from scored accuracy

---

## Discussion

No concerns — proceeding.

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | benchmark run dev set | runner | produces scored report |
| T2 | benchmark run holdout | runner | outputs holdout pass/fail |
| T3 | release candidate with no regression | gate | passes |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T4 | transport failure rows | not counted as accuracy=0 |
| T5 | holdout regression | release blocked |

---

## Definition of Done

**Implemented:**
- [x] benchmark datasets split and labeled
- [x] benchmark runner outputs required contract
- [x] release gate checker implemented
- [x] canary/rollback statuses supported

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [x] holdout run produces pass/fail
- [x] regression candidate blocked by gate

**E2E Passed:**
- [x] Exec ID: `157819` — holdout benchmark run (`dataset=holdout_gold`, `filter_benchmark_id=bm_shell01`)
- [x] Exec ID: `157794` — failing release gate scenario (`gate_status=blocked`)

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file created

---

## Closing Template

```
Runtime patched:
- `vkIBCzSBUDVZH5kQ`: `Code (Prepare Cases)`, `Code (Compare vs Ground Truth)`, `Code (Build Summary)` for dataset split fields + benchmark contract + release gate
Verified from:
- `/webhook/ocr-benchmark` exec `157794` returns contract fields:
  `benchmark_run_id`, `overall_accuracy_pct`, `critical_field_accuracy`, `by_vendor`, `by_layout`,
  `transport_fail_count`, `parse_fail_count`, `scored_count`, `holdout_pass`, `release_gate`
- failing gate scenario confirmed: `release_gate.gate_status=blocked` (reason `unknown_vendor_rate_rise`)
- holdout run confirmed: exec `157819` (`dataset=holdout_gold`, `filter_benchmark_id=bm_shell01`) => `holdout_pass=true`
- dataset labeling migration applied to benchmark sheet notes: `set_name=dev_regression(10)`, `set_name=holdout_gold(5)`, `set_name=train_examples(4)`, `none(1: bm_ritta01 fixture mismatch)`
Docs synced:
- task file updated
- `HANDOFF.md` updated
Remaining limits:
- dataset labels ถูกเขียนใน `notes` (`set_name=...`) เพื่อหลีกเลี่ยง schema migration risk ของ sheet; `Code (Prepare Cases)` parse notes fallback แล้ว
- ยังไม่มี dedicated release-helper workflow แยก; gate อยู่ใน benchmark summary payload
```
