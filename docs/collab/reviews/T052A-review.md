# Code Review — T052A: Metric Integrity Split

**Reviewer:** CC
**Reviewed commit:** REST-patched live (not committed as code change)
**Date:** 2026-03-06
**Spec:** `docs/collab/tasks/T052A-metric-integrity-split.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- เพิ่ม 6 columns ใน `OCR_TRAIN_CASES`: `case_class`, `accepted_by_user`, `audited_by_admin`, `metric_eligible`, `example_eligible`, `source_confidence`
- Patch 5 workflows ให้ write + read classification fields ใหม่
- Backfill 39 active historical rows ด้วย one-shot maintenance workflow (exec 157980)
- KPI report และ Dashboard แสดง audited / accepted / proxy แยกกันชัดเจน

---

## Verification Level

- [x] **Implemented** — ตรวจจาก live workflow fetch ครบ 5 workflows
- [x] **Verified** — TRAIN_CASES sheet มี 6 columns ครบ, active rows blank=0/39
- [x] **E2E Passed** — Exec `157982` KPI: `audited_case_count=12`, `accepted_case_count=25`, `audited_overall_accuracy_pct=89` ✅

---

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| TRAIN_CASES schema | `gg-data?sheet=TRAIN_CASES` | 6 new cols present, blank=0/39 ✅ |
| km-logger fields | workflow re-fetch `jmJHPPj0OM5LcZ0n` | Code (Compute Diffs) has all 6 fields ✅ |
| ocr-feedback-receiver | workflow re-fetch `ztJ8oCBHREUPPry6` | `case_class='audited'`, `audited_by_admin=true` ✅ |
| KPI split | exec `157982` SQLite readback | `audited=12`, `accepted=25`, `proxy=0`, overall=89% ✅ |
| Dashboard split | workflow re-fetch `FsMOrto8DmG1LYjD` | `metric_eligible`, `Audited`, `accepted`, `proxy` all in Build HTML ✅ |
| Backfill | exec `157980`, `gg-data?sheet=TRAIN_CASES` | 34 rows updated, `missing_case_class_active=0` ✅ |

---

## Issues Found

### 🟡 Minor — ocr-training ไม่ set `case_class` explicitly

`Code (Prepare KM Log Payload)` ใน ocr-training (`KW0QRXxRh9MjdPaY`) ส่ง:
- `metric_eligible: false` ✅
- `example_eligible: true` ✅
- **`case_class`: ❌ ไม่มี**

km-logger จะ fallback classify จาก `source='telegram_train'` → `case_class='accepted'` แต่เป็น implicit logic ไม่ใช่ explicit write ซึ่งเสี่ยง regression ถ้า km-logger fallback เปลี่ยนในอนาคต

**Fix:** เพิ่ม `case_class: 'accepted'` ใน ocr-training — non-blocking ทำในรอบถัดไป

---

### 🟢 Accuracy drop คือของจริง ไม่ใช่ bug

KPI เปลี่ยน 97% → 89% เพราะ:
- เดิม 97% = รวม telegram_train confirms (accepted rows ที่ได้ 100% proxy score)
- ปัจจุบัน 89% = เฉพาะ `feedback_kpi` audited cases (12 rows จริงจาก admin)

**89% คือ baseline ที่แท้จริง** — สะท้อน OCR accuracy ที่ admin ตรวจสอบแล้ว ไม่ใช่ regression

---

### 🟢 Bonus — T052B columns merge ใน TRAIN_CASES

Codex เพิ่ม `vendor_code`, `vendor_name_canonical`, `layout_id`, `layout_confidence`, `_meta` ไปพร้อมกัน — schema additive ไม่กระทบ existing logic ยอมรับได้

---

## Spec Compliance

| Requirement | Status |
|------------|--------|
| 6 new columns in TRAIN_CASES | ✅ |
| km-logger writes all classification fields | ✅ |
| ocr-training writes `case_class` | ⚠️ missing |
| ocr-feedback-receiver writes `audited` + `metric_eligible=true` | ✅ |
| KPI report: audited/accepted/proxy split | ✅ |
| Dashboard: split metrics | ✅ |
| Historical backfill complete | ✅ |
| Dedupe by request_id | ✅ |
| Temporary workflow deleted after use | ✅ |
| verify_nowThai_sync.sh | ✅ |

---

## Merge Decision

**✅ APPROVED WITH MINOR CONDITIONS**

Core metric integrity achieved — KPI แสดงความจริงแล้ว อนุมัติ

**Non-blocking conditions (fix in next window):**
1. Add `case_class: 'accepted'` ใน ocr-training `Code (Prepare KM Log Payload)`
2. Monitor `audited_case_count` — ควรเพิ่มขึ้นเมื่อ admin feedback มาเพิ่ม

---

*CC Review 2026-03-06*
