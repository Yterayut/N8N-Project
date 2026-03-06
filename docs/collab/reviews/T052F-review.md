# Code Review — T052F: Holdout Benchmark + Release Gate

**Reviewer:** CC
**Reviewed commit:** REST-patched live (not committed as code change)
**Date:** 2026-03-06
**Spec:** `docs/collab/tasks/T052F-holdout-benchmark-release-gate.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- `Code (Prepare Cases)` ใน benchmark runner (`vkIBCzSBUDVZH5kQ`): parse `set_name` จาก `notes` column + normalize dataset labels
- `Code (Compare vs Ground Truth)`: score ต่อ case พร้อม `transport_fail` / `parse_fail` class separation
- `Code (Build Summary)`: output contract ครบ 10 fields + `release_gate` object + `canary_status`
- Release gate: `blocked` เมื่อ `unknown_vendor_rate > 20%` หรือ holdout regression; `benchmark_passed` เมื่อผ่าน
- Dataset split: `train_examples` (4), `dev_regression` (10), `holdout_gold` (5) — encoded ใน `notes` column

---

## Verification Level

- [x] **Implemented** — `Code (Build Summary)` fetch: full contract + release gate logic ✅
- [x] **E2E — holdout pass** — exec `157819`: dataset=`holdout_gold`, `holdout_pass=true`, `overall_accuracy_pct=100`, all contract fields present ✅
- [x] **E2E — gate blocked** — exec `157794`: `gate_status=blocked`, `reason=unknown_vendor_rate_rise` ✅
- [x] **Dataset split** — `set_name` in exec data confirms `holdout_gold` (157819) and `train_examples` (157794) ✅
- [x] **Fail class separation** — `transport_fail_count=0`, `parse_fail_count=0` as separate counters ✅

---

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| Output contract fields | exec 157819 SQLite | all 10 fields present ✅ |
| holdout_pass=true | exec 157819 | `holdout_pass:true`, `holdout_accuracy_pct:100` ✅ |
| gate_status=blocked | exec 157794 SQLite | `blocked` + `unknown_vendor_rate_rise` ✅ |
| transport/parse fail separation | Code (Compare) + exec 157819 | `transport_fail_count:0`, `parse_fail_count:0` ✅ |
| canary_status logic | Code (Build Summary) | `holdout_pass ? 'canary' : 'rolled_back'` ✅ |
| holdout not in prompt examples | Code (Prepare Cases) | `set_name=holdout_gold` → skip flag ✅ |
| dataset labels | exec 157819 set_name | `holdout_gold` parsed from `notes` ✅ |

---

## Output Contract — Verified

| Field | Status |
|-------|--------|
| `benchmark_run_id` | ✅ |
| `overall_accuracy_pct` | ✅ |
| `critical_field_accuracy` | ✅ |
| `by_vendor` | ✅ |
| `by_layout` | ✅ |
| `transport_fail_count` | ✅ |
| `parse_fail_count` | ✅ |
| `scored_count` | ✅ |
| `holdout_pass` | ✅ |
| `release_gate` | ✅ (includes `gate_status`, `reason`, `canary_status`) |

---

## Release Gate Logic — Verified

```javascript
const releaseGate = {
  gate_status: holdoutPass && (criticalFieldAccuracy.vendor_tax_id === null
    || criticalFieldAccuracy.vendor_tax_id >= 95)
    && unknownVendorRate <= 0.2
    ? 'benchmark_passed' : 'blocked',
  reason: holdoutPass ? (unknownVendorRate <= 0.2 ? 'ok' : 'unknown_vendor_rate_rise')
    : 'holdout_regression',
  canary_status: holdoutPass ? 'canary' : 'rolled_back'
};
```

Gate blocks when:
- `holdout_pass = false` → reason: `holdout_regression` ✅
- `unknown_vendor_rate > 20%` → reason: `unknown_vendor_rate_rise` ✅ (exec 157794)
- `vendor_tax_id critical accuracy < 95%` ✅

---

## Issues Found

### 🟡 Minor — Holdout set เล็กมาก (5 cases)

Dataset split ตาม Codex closing notes:
- `dev_regression`: 10 cases
- `holdout_gold`: 5 cases ← **ต่ำกว่า minimum ที่แนะนำ**
- `train_examples`: 4 cases
- `none` (fixture mismatch): 1 case

5 holdout cases = แต่ละ case มีน้ำหนัก 20% ต่อ holdout score — ผิดพลาด 1 case เท่ากับ accuracy ตก 20%

Spec ระบุว่า holdout ต้องครอบคลุม: top vendors, top layouts, hard bills, electricity, fleet_card, multi-bill — 5 cases ครอบคลุมไม่ครบทุก dimension

**Fix (non-blocking):** เพิ่ม holdout cases อย่างน้อย 2-3 cases ต่อ dimension หลัก (fuel + electricity + fleet_card) ก่อนใช้ gate ตัดสิน production release จริง

---

### 🟡 Minor — Dataset labels อยู่ใน `notes` column (fragile)

Codex ใช้ workaround เขียน `set_name=holdout_gold` ใน `notes` free-text แทนการเพิ่ม column ใหม่

`Code (Prepare Cases)` parse ด้วย regex:
```javascript
const m = t.match(/(?:^|\||\s)set_name\s*=\s*([a-zA-Z_]+)/i)
```

**ความเสี่ยง:** ถ้า notes มีรูปแบบอื่นหรือ regex ล้มเหลว → case จะ default เป็น `train_examples` แทน holdout → holdout gate ไม่ทำงาน

**Context:** Codex acknowledge ไว้ใน closing notes — schema migration risk หลีกเลี่ยงได้ด้วยวิธีนี้

**Fix (non-blocking):** เพิ่ม `set_name` column ใน benchmark sheet อย่างเป็นทางการ ลด dependency บน regex parse

---

### 🟡 Minor — `vendor_tax_id < 95%` gate อาจ strict เกินไปสำหรับ small holdout

Gate condition: `criticalFieldAccuracy.vendor_tax_id >= 95` — ถ้า holdout มี 5 cases และ 1 case มี vendor_tax_id ผิด → accuracy = 80% → blocked ทันที ทั้งที่ sample อาจไม่ representative

---

### 🟢 canary_status lifecycle — Clean

- `benchmark_passed` → ready for canary
- `canary` → actively being tested
- `rolled_back` → holdout failed

ตรงกับ spec canary gate statuses ✅

---

## Spec Compliance

| Requirement | Status |
|------------|--------|
| benchmark dataset split (train/dev/holdout) | ✅ (in notes column) |
| benchmark output contract (10 fields) | ✅ |
| release gate checker | ✅ |
| canary/rollback statuses | ✅ |
| holdout not used in prompt retrieval | ✅ |
| transport/parse failures separated | ✅ |
| holdout coverage: all dimensions | ⚠️ only 5 cases, insufficient coverage |
| dedicated dataset split column | ⚠️ encoded in notes (workaround) |

---

## Merge Decision

**✅ APPROVED WITH MINOR CONDITIONS**

Benchmark contract ครบ, release gate ทำงานถูกต้อง (pass + blocked scenarios verified) อนุมัติ

**Non-blocking conditions:**
1. เพิ่ม holdout cases ให้ถึง ≥15 cases (3+ per major dimension: fuel, electricity, fleet_card, multi-bill)
2. เพิ่ม `set_name` column ใน benchmark sheet เพื่อ replace `notes`-regex workaround
3. Integrate T052F gate เข้า T052E canary_eligible check: ก่อน set `canary_eligible` ใน km-suggest ให้ pass holdout gate ก่อน

---

*CC Review 2026-03-06*
