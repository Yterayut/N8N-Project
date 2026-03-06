# Code Review — T052E: Admin Feedback Rule Learning Pipeline

**Reviewer:** CC
**Reviewed commit:** REST-patched live (not committed as code change)
**Date:** 2026-03-06
**Spec:** `docs/collab/tasks/T052E-admin-feedback-rule-learning.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- `Code (Analyze Patterns)` ใน ocr-km-suggest (`NkKd02QyzLRcpIJM`): diff taxonomy normalization + cluster key + threshold statuses + deduplication
- `Code (Compute Diffs)` ใน ocr-km-logger (`jmJHPPj0OM5LcZ0n`): เขียน `cluster_key`, `vendor_code`, `layout_id` ลง FIELD_DIFFS
- Threshold: `≥3 → suggestion`, `≥5 → draft_rule_candidate`, `≥10 → canary_eligible`
- Rule type map: `missing → anchor_preference`, `wrong_value → normalize`
- Deduplication: `existingKeys` (check ก่อน) + `seenNewKeys` (prevent dup ใน same run)
- No auto-activate: status stays at suggestion/draft — ต้องมี human review

---

## Verification Level

- [x] **Implemented** — Code (Analyze Patterns) fetch: taxonomy, cluster_key, thresholds, dedup ✅
- [x] **Verified** — exec `157791`: `suggestion` x1, `draft_rule_candidate` x1, `canary_eligible` x1, `cluster_key` x72, `support_count` x72 ✅
- [x] **Verified** — exec `157984`: same 3 statuses confirmed ✅
- [x] **Anti-noise gate** — `if (g.count >= 3) pushRuleSuggestion(g)` → by construction ไม่มี lesson ที่ support_count < 3 ✅
- [x] **FIELD_DIFFS** — `vendor_code` + `layout_id` + `cluster_key` blank=0/326 (verified in T052B review) ✅

---

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| Cluster key format | Code (Analyze Patterns) fetch | `vendor_code\|layout_id\|field_name\|diff_type` ✅ |
| Threshold: ≥3 → suggestion | code inspection | `if (g.count >= 3) pushRuleSuggestion(g)` ✅ |
| Threshold: ≥5 → draft_rule_candidate | code inspection | `if (count >= 5) status='draft_rule_candidate'` ✅ |
| Threshold: ≥10 → canary_eligible | code inspection | `if (count >= 10) status='canary_eligible'` ✅ |
| suggestion generated | exec 157791 SQLite | `suggestion` found ✅ |
| draft_rule_candidate generated | exec 157791 SQLite | `draft_rule_candidate` found ✅ |
| canary_eligible generated | exec 157791 SQLite | `canary_eligible: currency→THB, 21x` ✅ |
| Anti-noise (no singleton lessons) | code construction | `≥3` gate prevents sub-threshold entries ✅ |
| FIELD_DIFFS cluster fields | gg-data sheet check | vendor_code/layout_id/cluster_key blank=0/326 ✅ |
| Deduplication | existingKeys Set | existing lessons not recreated ✅ |
| No auto-activate | code inspection | status always suggestion/draft — human review required ✅ |

---

## Taxonomy Normalization — Verified

6 diff types confirmed present in normalization function:

| Type | Rule type mapped |
|------|-----------------|
| `missing` | `anchor_preference` |
| `wrong_value` | `normalize` |
| `format_error` | (present in taxonomy) |
| `cross_field_inconsistent` | (present in taxonomy) |
| `vendor_misclassification` | `vendor_override` |
| `layout_misclassification` | `layout_route` |

---

## Issues Found

### 🟡 Minor — canary_eligible ไม่มี benchmark pass check

Spec: "10 occurrences **+ benchmark pass** → canary eligible"

Code:
```javascript
if (g.count >= 10) status = 'canary_eligible';
else if (g.count >= 5) status = 'draft_rule_candidate';
```

Status `canary_eligible` ถูก assign จาก count ≥ 10 เท่านั้น — ไม่มี benchmark gate

**Context:** T052F จะทำ holdout benchmark gate — เป็น planned dependency ไม่ใช่ oversight

**Fix (non-blocking):** เมื่อ T052F deploy แล้ว ให้เพิ่ม condition `&& benchmarkPassed` ก่อน set `canary_eligible`

---

### 🟡 Minor — OCR_KM_LESSONS ไม่ accessible ผ่าน gg-data-gateway

gg-data-gateway Switch node รองรับเฉพาะ 6 sheets: `TRAIN_CASES`, `FIELD_DIFFS`, `OCR_KM_RUNTIME_RULES`, `OCR_FEEDBACK`, `OCR_EXAMPLES`, `VENDOR_MAP`

KM_LESSONS ไม่อยู่ใน Switch → CC ไม่สามารถ verify lesson rows โดยตรงผ่าน gateway ได้ ต้องใช้ SQLite exec data

**Impact:** Auditing / monitoring เพิ่มเติม — ควรเพิ่ม `OCR_KM_LESSONS` เข้า gg-data-gateway ใน future

---

### 🟢 Pattern discovery ทำงานดี

exec 157791 (`new_lessons` confirmed): พบ patterns ที่มี support ≥ 10 (`currency → THB` ปรากฏ 21x → `canary_eligible`) — แสดงว่า clustering + threshold ทำงานถูกต้องใน production data จริง

---

## Spec Compliance

| Requirement | Status |
|------------|--------|
| diff taxonomy normalization (6 types) | ✅ |
| cluster key: vendor_code + layout_id + field_name + diff_type | ✅ |
| threshold ≥3 → suggestion | ✅ |
| threshold ≥5 → draft_rule_candidate | ✅ |
| threshold ≥10 + benchmark → canary_eligible | ⚠️ count only, no benchmark (T052F pending) |
| lesson/rule candidate persistence | ✅ |
| no auto-activate production rule | ✅ |
| repeated patterns create suggestion rows | ✅ (exec 157791, 157984) |
| noisy singletons do not create suggestions | ✅ (≥3 gate by construction) |
| FIELD_DIFFS cluster fields | ✅ (blank=0/326) |

---

## Merge Decision

**✅ APPROVED**

Pipeline ทำงานถูกต้อง — diff taxonomy, clustering, thresholds, dedup, anti-noise ครบ อนุมัติ

**Non-blocking conditions:**
1. เพิ่ม `OCR_KM_LESSONS` เข้า gg-data-gateway Switch สำหรับ monitoring
2. หลัง T052F deploy: เพิ่ม benchmark gate condition ก่อน `canary_eligible` status

---

*CC Review 2026-03-06*
