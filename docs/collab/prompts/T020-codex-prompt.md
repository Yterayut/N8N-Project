# Codex Task: T020 — Phase 3 Documentation + Regression Matrix Update

## Context
Claude Code has completed all Phase 3 (Cleanup & Maintainability) patches.
All changes committed to `stable` branch (commit `960293a`) and synced to your worktree.

## Phase 3 Changes Summary

| Task | Node | Change |
|------|------|--------|
| T015 | `Code in JavaScript23` | Queue batch size hardcoded 10 → `OCR_QUEUE_BATCH_SIZE` env var |
| T015 | `Code (SLA Lane + Timeout Budget)` | Thresholds 4000/700 → `OCR_SLA_HEAVY_KB` / `OCR_SLA_FAST_KB` |
| T015 | `Code (Build Telegram Notification OCR)` | `'test-workflow'` / hardcoded ID → `$workflow.name` / `$workflow.id` |
| T016 | `Code  Set Done` | file_id reads from `$input.item.json` first (loop-safe), then `.first()` fallback |
| T017 | `Code (Apply Re-ask Result)` | Confidence boost only when `criticalErrs===0`; configurable via `OCR_REASK_CONF_BOOST` (default: no floor) |
| T018 | `Code (Normalize + Validate)` | Electricity ref regex `/^\d{12}$/` → `/^\d{10,15}$/`; overridable via `OCR_ELEC_REF_PATTERN`; severity downgraded to `warning` |
| T019 | `Code in JavaScript22` | Added TIFF (little/big-endian magic bytes) + HEIC/HEIF extension detection |

## New Env Vars (Phase 3)

| Variable | Node | Default | Purpose |
|---|---|---|---|
| `OCR_QUEUE_BATCH_SIZE` | Code in JavaScript23 | `10` | Queue worker batch size |
| `OCR_SLA_HEAVY_KB` | Code (SLA Lane) | `4000` | File size threshold (KB) for heavy SLA lane |
| `OCR_SLA_FAST_KB` | Code (SLA Lane) | `700` | File size threshold (KB) for fast SLA lane |
| `OCR_REASK_CONF_BOOST` | Code (Apply Re-ask Result) | `0` (no floor) | Min confidence after successful re-ask |
| `OCR_ELEC_REF_PATTERN` | Code (Normalize + Validate) | `/^\d{10,15}$/` | Regex pattern for electricity reference validation |
| `WORKFLOW_NAME` | Code (Build Telegram) | `'ocr-invoice-processor'` | Fallback if `$workflow.name` unavailable |
| `WORKFLOW_ID` | Code (Build Telegram) | `''` | Fallback if `$workflow.id` unavailable |

## Deliverable 1: `docs/collab/completed/phase3-summary.md`

Follow the structure of `phase1-summary.md` / `phase2-summary.md`:
1. Summary (tasks, commit ref)
2. What Changed (node-level, per task)
3. New Env Vars table
4. Remaining items (only `nowThai()` consolidation and workflow rename remain from P3)
5. Overall Production Readiness status (P0+P1+P2+P3 combined view)

## Deliverable 2: Update `docs/collab/tasks/regression-test-matrix.md`

Add **Section 7: Phase 3 Scenarios**:
- T015: Queue batch respects `OCR_QUEUE_BATCH_SIZE` — set env=3, send 10 items, verify only 3 processed
- T015: SLA lanes switch correctly with env-configured thresholds
- T015: Telegram message shows correct dynamic workflow name (not `'test-workflow'`)
- T016: Queue completion sets correct `file_id` when processing 2nd item in loop (not always item 1)
- T017: Re-ask confidence NOT inflated when re-ask result still has critical errors
- T017: Re-ask confidence boosted to `OCR_REASK_CONF_BOOST` value when all errors resolved
- T018: Electricity ref with 10 digits accepted (was rejected before); 16 digits rejected
- T018: Custom `OCR_ELEC_REF_PATTERN` overrides default validation
- T019: TIFF file correctly identified as `image/tiff` via magic bytes
- T019: HEIC file correctly identified as `image/heic` via extension

## Deliverable 3: Update `docs/collab/HANDOFF.md`
- Move T020 from Pending → Completed
- Update Phase to: `Phase 3 - Cleanup & Maintainability (COMPLETE)`
- Update Last Sync timestamp
- Add sync log entry

## Rules
- Work on branch `agents/codex`
- Do NOT modify workflow JSON or scripts
- Commit: `docs(ocr): phase3 summary + regression matrix update (T020)`
