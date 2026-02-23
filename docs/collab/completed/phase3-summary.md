# Phase 3 Summary (Cleanup & Maintainability Fixes) - OCR `test-workflow`

**Date:** 2026-02-23  
**Prepared by:** Codex (`agents/codex`)  
**Source of record:** `docs/collab/HANDOFF.md` (T015, T016, T017, T018, T019 completion notes)  
**Stable commit reference (Claude Code):** `960293a`

## 1) Summary

Claude Code completed the Phase 3 (Cleanup & Maintainability) patch set for OCR `test-workflow` and recorded completion in `HANDOFF.md`:

- **T015:** Config externalization (queue batch size, SLA thresholds, Telegram workflow refs)
- **T016:** Queue worker `file_id` reference fix (`Code  Set Done`)
- **T017:** Re-ask confidence floor logic made conditional + env-configurable
- **T018:** Electricity reference validation widened and made configurable
- **T019:** MIME support improved (TIFF magic bytes + HEIC/HEIF extension)

This document summarizes Phase 3 node-level changes, new environment variables, remaining P3 items, and overall production hardening status after P0+P1+P2+P3.

## 2) What Changed (Node-Level, Per Task)

### T015 - Config Externalization (Maintainability)

#### A. `Code in JavaScript23`
- **Change:** Queue batch size hardcoded `10` -> reads from `OCR_QUEUE_BATCH_SIZE`
- **Impact:** Tune queue worker throughput without editing workflow code

#### B. `Code (SLA Lane + Timeout Budget)`
- **Change:** Hardcoded thresholds `4000kb` / `700kb` -> env-driven:
  - `OCR_SLA_HEAVY_KB`
  - `OCR_SLA_FAST_KB`
- **Impact:** SLA lane tuning becomes operational config instead of code patch

#### C. `Code (Build Telegram Notification OCR)`
- **Change:** Hardcoded workflow name/id (`test-workflow` and fixed id) -> dynamic `$workflow.name` / `$workflow.id`
- **Fallbacks:** `WORKFLOW_NAME`, `WORKFLOW_ID`
- **Impact:** Telegram notifications remain correct after workflow rename/export/import

### T016 - Queue Worker `file_id` Reference Fix

#### `Code  Set Done`
- **Issue (before):** `file_id` could read from wrong item context (e.g. always first item in loop)
- **Change:** Read from `$input.item.json` first (loop-safe), then `.first()` fallback
- **Impact:** Queue completion updates attach to the correct row/file during multi-item processing

### T017 - Re-ask Confidence Logic (Reduce Inflation)

#### `Code (Apply Re-ask Result)`
- **Change:** Confidence boost applies **only when `criticalErrs === 0`**
- **New env control:** `OCR_REASK_CONF_BOOST`
- **Default behavior:** No forced confidence floor (`0` / disabled by default)
- **Impact:** Prevents misleading confidence inflation when re-ask still leaves critical errors unresolved

### T018 - Electricity Reference Validation Flexibility

#### `Code (Normalize + Validate)`
- **Change:** Electricity reference regex widened:
  - from `/^\\d{12}$/`
  - to `/^\\d{10,15}$/`
- **New env override:** `OCR_ELEC_REF_PATTERN`
- **Severity:** Downgraded to `warning`
- **Impact:** Fewer false validation errors across electricity providers with variant reference lengths

### T019 - MIME Detection Extension (TIFF / HEIC / HEIF)

#### `Code in JavaScript22`
- **Change:** Added TIFF detection by magic bytes (little-endian + big-endian)
- **Change:** Added HEIC/HEIF detection by file extension
- **Impact:** Better compatibility with scanned documents and iPhone-origin image files

## 3) New Env Vars (Phase 3)

| Variable | Node | Default | Purpose |
|---|---|---|---|
| `OCR_QUEUE_BATCH_SIZE` | `Code in JavaScript23` | `10` | Queue worker batch size |
| `OCR_SLA_HEAVY_KB` | `Code (SLA Lane + Timeout Budget)` | `4000` | File size threshold (KB) for heavy lane |
| `OCR_SLA_FAST_KB` | `Code (SLA Lane + Timeout Budget)` | `700` | File size threshold (KB) for fast lane |
| `OCR_REASK_CONF_BOOST` | `Code (Apply Re-ask Result)` | `0` (disabled/no floor) | Minimum confidence after successful re-ask when all critical errors resolved |
| `OCR_ELEC_REF_PATTERN` | `Code (Normalize + Validate)` | `/^\\d{10,15}$/` | Override regex for electricity reference validation |
| `WORKFLOW_NAME` | `Code (Build Telegram Notification OCR)` | `ocr-invoice-processor` | Fallback workflow name if `$workflow.name` unavailable |
| `WORKFLOW_ID` | `Code (Build Telegram Notification OCR)` | `''` | Fallback workflow ID if `$workflow.id` unavailable |

## 4) Remaining Items (P3)

From `docs/improve-by-claude-23-02-2026.md`, only these Phase 3 items remain:

1. **`nowThai()` helper consolidation**
- Multiple code nodes still duplicate shared helper logic
- Refactor target: reduce copy/paste and future drift

2. **Workflow rename**
- Current production workflow still named `test-workflow`
- Recommended target name remains something production-meaningful (e.g. `ocr-invoice-processor`)

## 5) Overall Production Readiness Status (P0 + P1 + P2 + P3 Combined)

### Status by Phase
- **Phase 0 (Audit):** ✅ Completed (T001)
- **Phase 1 (P0/P1 Stabilization):** ✅ Completed (T003, T004, T005 + T006 docs)
- **Phase 2 (Scale & Safety):** ✅ Completed (T007, T008, T009, T011, T012, T013 + T014 docs)
- **Phase 3 (Cleanup & Maintainability):** ✅ Completed (T015, T016, T017, T018, T019 + T020 docs) — with two deferred cleanup items listed above

### What is production-strong now
- P0 crash class fixed (`round3`)
- Re-ask path revalidated and more resilient (retry + continue path + confidence inflation control)
- Queue worker correctness improved (`status=error`, loop-safe `file_id`)
- File count + file size controls added
- Client error responses sanitized
- Pricing and thresholds externalized to env vars
- MIME detection broadened (TIFF/HEIC/HEIF)
- Legacy disabled node clutter reduced

### What still limits long-term scale / maintainability
- Google Sheets architecture bottleneck (rate-limit and `Get All row_key` scale cost)
- Shared helper duplication across code nodes
- Workflow naming/production identity cleanup
- Phase 4 architecture upgrades (DB migration, shared queue/main pipeline, observability)

### Recommended next step (beyond T020)
- Move to **Phase 4 planning/execution prep** while opportunistically closing the 2 remaining P3 cleanup items if low-risk.

## 6) Notes

- This summary is based on the documented task completions in `HANDOFF.md` and the provided Phase 3 change list; Codex did not modify workflow JSON or run live n8n tests.
- Regression coverage for Phase 3 changes is added in **Section 7** of `docs/collab/tasks/regression-test-matrix.md` (T020).
