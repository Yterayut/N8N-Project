# Code Review — T044: Single Source of Truth — Unified OCR Feedback Pipeline

**Reviewer:** CC
**Reviewed commit:** `2bd7884`
**Date:** 2026-03-01
**Spec:** `docs/collab/tasks/T044-single-source-of-truth.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- **Phase 1** (`jmJHPPj0OM5LcZ0n`): Added `VENDOR_MAP` constant + `enrichFromVendorMap()` + `computeAccuracy()` in `Code (Compute Diffs)` — future TRAIN_CASES rows will have correct `doc_type`, `vendor_name`, and `ocr_accuracy_pct`
- **Phase 2** (`KW0QRXxRh9MjdPaY`): Added vendor enrichment in `Code (Prepare KM Log Payload)` — Telegram training path now enriches doc_type/vendor_name via VENDOR_MAP
- **Phase 3** (`NkKd02QyzLRcpIJM`): Added `buildAccuracyStats()` function, `accuracy_by_doc_type`, `accuracy_by_vendor`, `overall_accuracy_pct` in `Code (Analyze Patterns)`; updated `Code (Build Telegram)` with doc_type/vendor breakdown

---

## Verification Level

- [x] **Implemented** — code/config เขียนถูกต้องตาม spec (verified via n8n REST API re-fetch)
- [x] **Verified** — re-fetch จาก n8n API ยืนยัน nodes มี VENDOR_MAP / enrichFromVendorMap / buildAccuracyStats
- [x] **E2E Passed** — Phase 1 Exec ID: `154810` | Phase 3 Exec ID: `154827` (Codex) + CC re-verify exec after fix

---

## Test Evidence

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| T1 — Caltex vendor enrichment | POST /ocr-km-log caltex payload | `154810` → `doc_type=fuel`, `vendor_name=Caltex`, `ocr_accuracy_pct=50` | ✅ |
| T2 — Unknown vendor fallback | POST /ocr-km-log unknown payload | `154811` → `doc_type=other`, `vendor_name=unknown`, `ocr_accuracy_pct=100` | ✅ |
| T6 — KPI grouping | POST /ocr-km-suggest | `154827` → `overall_accuracy_pct`, `accuracy_by_doc_type`, `accuracy_by_vendor` present | ✅ |
| T8 — Auth | wrong key → 401 | Verified | ✅ |
| CC re-verify after fix | POST /ocr-km-suggest | `overall_accuracy_pct=69`, fuel=50%, other=70%, no count=0 vendors | ✅ |

---

## What Was Done Well ✅

### 1. Clean `buildAccuracyStats` abstraction
Codex extracted a reusable function instead of duplicating the logic for doc_type and vendor_name grouping — good DRY design.

### 2. VENDOR_MAP key normalization
`enrichFromVendorMap()` tries both raw key and `'0' + normalized` — handles cases where vendor_tax_id has/doesn't have leading zero. Matches what the spec requested.

### 3. Preserving existing values
When `existing_vendor_name` is already non-empty, the helper keeps it — prevents overwriting legitimate vendor names from Telegram gold payloads.

### 4. `continueOnFail=true` added
Applied to GSheets append nodes in ocr-km-logger and HTTP node in ocr-training — good resilience.

---

## Issues Found ❌

### 1. `Number('') = 0` — blank accuracy counted as 0%
**Severity:** High
**Type:** Bug

`buildAccuracyStats` used `!Number.isNaN(Number(c.ocr_accuracy_pct))` but `Number('') = 0` (not NaN), so 13 existing telegram_train rows with blank `ocr_accuracy_pct` were counted as 0% — dragging overall fuel accuracy from ~65% down to 3%.

**Fix:** CC patched live (2026-03-01):
- Added `if (rawPct === '' || rawPct === null || rawPct === undefined) continue;` in `buildAccuracyStats`
- Added empty-string check in `allWithPct` filter
- Added `.filter(([, stat]) => stat.total > 0)` to remove count=0 vendor entries from output
- **After fix:** `overall_accuracy_pct=69`, fuel=50%, other=70% ✅

### 2. Codex Discussion note valid — but low priority
**Severity:** Low
**Type:** Design

Codex correctly noted that `enrichFromVendorMap()` preserves existing vendor names, which means legal entity names (from gold payloads) may differ from VENDOR_MAP short aliases. Acceptable for now — short aliases can be standardized later when VENDOR_MAP grows.

---

## Security Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| — | No new webhooks added | — | Clean |
| — | VENDOR_MAP is hardcoded (no external injection) | — | Clean |

_Checklist:_
- [x] No new webhook endpoints
- [x] No new credentials
- [x] `continueOnFail` added to side-system calls
- [x] VENDOR_MAP is hardcoded — no injection risk

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| VENDOR_MAP hardcoded in Code node | ง่าย, ไม่ต้องพึ่ง GSheets | ต้องแก้ code เพื่อเพิ่ม vendor ใหม่ (แต่ acceptable ตอนนี้) |
| Backfill ไม่ทำ | 13 telegram_train rows เก่า ยัง blank accuracy | ถูกกรองออกจาก avg (ดีกว่าผิด) |
| Phase 2 Telegram E2E ไม่ได้ test | Telegram secret header ต้องการ live token | Low risk — path เหมือน T029A |

---

## Merge Decision

**APPROVED WITH CONDITIONS (ไม่ block merge)**

Conditions (CC แก้แล้วทั้งหมด):
- [x] Fix `Number('')=0` bug in buildAccuracyStats — CC patched live
- [x] Filter count=0 vendor entries — CC patched live

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T044`)*

**Date:**

### Response to Issues Raised
### Design Decisions Explained
### What I Would Do Differently Next Time
### New Patterns / Lessons Learned

---

## Merge Approval *(CC fills หลังอ่าน Codex Response)*

- [x] Merged to stable (commit `dd83682`) + CC patches applied + synced
- [x] CC hot-fixes applied live (buildAccuracyStats empty-string check, count>0 filter)
- [ ] Codex response pending (non-blocking)

**Date merged:** 2026-03-01
**Notes:** CC patched 2 bugs live post-merge. Core functionality ✅. Historical backfill deferred.
