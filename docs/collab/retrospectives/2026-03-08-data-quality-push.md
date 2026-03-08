# Session Retrospective — 2026-03-08 (data-quality-push)

## 1. Git Summary

Commits made this session (on branch `stable`):

| Hash | Message | What It Did |
|------|---------|------------|
| `c490e6a` | feat(T053): accuracy push — TRAIN_CASES 99% → 100% | Excluded 2 synthetic/probe rows; deactivated 4 bad PTT OR OCR_EXAMPLES |
| `b030e74` | fix(examples-api): add active_for_prompt to reject schema + audit TRAIN_CASE | Fixed reject bug; audited tc_1772897090067_kdtmr2 → audited |

---

## 2. Tasks Completed

### T053 — OCR Accuracy Push (99% → 100%)
- **Problem:** TRAIN_CASES showing 99% overall (35 scored); 2 PTT OR cases at 75%/90%
- **Root cause:** Both failures were synthetic/probe test data — not real OCR errors
  - `tc_1772007451073_yn04ia`: T029A rerun seed; fake `vendor_tax_id=107537000000`
  - `tc_1772761059238_r7ouku`: T052A maintenance probe (`t052_probe_diff_01`)
- **Files changed:** GSheets `OCR_TRAIN_CASES` (via temp workflow Q7saNQOYHm1gtDG8)
- **OCR_EXAMPLES cleanup:** 4 bad PTT OR rows deactivated
  - Rows 34, 45: duplicate `invoice_number=100628`
  - Rows 65, 66: synthetic T052A test data (ZZ01/ZZ02)
- **Outcome:** TRAIN_CASES 100% (33 scored); OCR_EXAMPLES 26 active

### fix-examples-api-reject
- **Problem:** `ocr-examples-api` reject action: `active=False` set, but `active_for_prompt` stayed `True`
- **Root cause:** GSheets Update schema in workflow `LzYmwkdRfOxbCrwB` was missing `active_for_prompt` column
- **Fix:** Added `active_for_prompt` to both schema list and value mapping via REST PATCH
- **Outcome:** Reject now correctly deactivates example from all paths

### Admin Feedback Investigation (ex_1772897085810_594c)
- **Problem:** 2 pending examples from SCG Prawet 50% feedback; one had wrong gold_json (OCR output instead of correction)
- **Action:** Rejected `ex_1772897085810_594c` via `ocr-examples-api`; manually fixed `active_for_prompt=False` via temp workflow
- **Outcome:** Bad example purged; `ex_1772897085795_9dc2` not found in sheet (append may have failed — deferred)

### TRAIN_CASE Audit (tc_1772897090067_kdtmr2)
- **Problem:** Status was `pending_review` after admin feedback
- **Action:** Updated `status=audited` via temp workflow B9f8TBNV0EWrhgBd
- **Outcome:** Training data correctly archived

### GG Curation Report Review (2026-02-25)
- **Action:** Read `docs/gg/reports/2026-02-25-curation.md`; checked all 4 recommendations
- **Outcome:** All already implemented; `tc_1772008956515_cov52h` confirmed excluded

---

## 3. Decisions Made

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| Exclude synthetic/probe rows from TRAIN_CASES instead of fixing | Not real OCR failures — would distort accuracy metric | Ignoring them (keeps 99% but misleading) |
| Reject example with wrong gold_json immediately | Bad examples actively teach Gemini wrong answers | Updating gold_json manually (harder, riskier) |
| Deactivate 4 PTT OR examples (not delete) | Preserve history; easy to reactivate if needed | Delete permanently |
| Fix `active_for_prompt` bug via REST PATCH | Consistent with Golden Rules (no direct DB writes) | SQLite direct update |

---

## 4. Issues Found / Deferred

| Issue | Severity | Why Deferred | Next Action |
|-------|----------|--------------|-------------|
| `ex_1772897085795_9dc2` not in OCR_EXAMPLES sheet | Medium | Append from learning loop may have failed silently | Check `ocr-km-logger` append logic; look for missing example |
| `layout_id=ptt_or_fuel_v1` for SCG Prawet bills | Low | No accuracy impact (minor misclassification) | Add SCG Prawet layout detection later |
| OCR_EXAMPLES count now 26/65 active (was 30/30) | Low | New examples not being approved quickly enough | Review approval pipeline; set target active count |

---

## 5. What Went Well / What Was Hard

**Went well:**
- Root cause of 99% accuracy identified quickly (synthetic probe rows, not real bugs)
- Temp workflow pattern now stable and reliable after previous sessions' lessons
- OCR smoke test: all 5 checks PASS on first run
- Real SCG Prawet test (3 bills, 100%) confirmed system works correctly

**Was hard:**
- n8n temp workflow webhook URL still tricky: `{WF_ID}/webhook/{path}` format found in DB but not obvious
- Wrong spreadsheet ID initially (used old ID, not OCM-INFRA) — wasted one temp workflow run
- `active_for_prompt` reject bug was subtle: no error thrown, just silently missed the column

---

## 6. Memory Update

Updated MEMORY.md with:
- n8n temp workflow webhook URL pattern
- GSheets `mode: "name"` requirement
- Synthetic probe detection signals
- OCR_EXAMPLES reject bug fix status
- VENDOR_MAP entry for SCG Prawet

---

## 7. One-Line Session Summary

Pushed OCR accuracy to 100% by identifying and excluding 2 synthetic probe rows, fixed the examples-api reject schema bug, and audited a real SCG Prawet admin feedback case.

---
