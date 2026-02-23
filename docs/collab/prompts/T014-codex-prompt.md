# Codex Task: T014 — Phase 2 Documentation + Regression Matrix Update

## Context
Claude Code has completed all Phase 2 (Scale & Safety) patches for `test-workflow` (OCR).
All patches are committed to `stable` branch (commit `2821577`) and synced to your worktree.

## Your Task
Create `docs/collab/completed/phase2-summary.md` documenting Phase 2 changes, AND update the regression test matrix.

---

## Phase 2 Changes Summary (for your reference)

| Task | Node | Change |
|------|------|--------|
| T007 | `Code in JavaScript22` | File size guard: throws if file > `OCR_MAX_FILE_BYTES` (default 20MB) |
| T007 | `Code (Split Files)` | File size guard per-file in queue path (max 20MB) |
| T008 | `Respond to Webhook (error)` | Error message sanitized — never exposes raw Gemini API error text |
| T009 | `Code (Select Few-shot Examples)` | Truncation now cuts at example boundary, not raw `.slice(0,6000)` |
| T011 | `HTTP GenerateContent (Re-ask)` | Added `retryOnFail=true`, `maxTries=2`, `waitBetweenTries=5000ms`, `onError=continueRegularOutput` |
| T012 | `Code in JavaScript9` | Pricing constants now read from `$env.OCR_PRICE_THB_PER_1K_INPUT` / `OCR_PRICE_THB_PER_1K_OUTPUT` (fallback: 0.0105/0.0875) |
| T013 | (global) | Removed 24 disabled legacy nodes (Webhook_OCR_Test9 chain) + dangling connections |

## New Env Vars Introduced
- `OCR_MAX_FILE_BYTES` — max file size in bytes (default: 20971520 = 20MB)
- `OCR_PRICE_THB_PER_1K_INPUT` — input token price THB/1K (default: 0.0105)
- `OCR_PRICE_THB_PER_1K_OUTPUT` — output token price THB/1K (default: 0.0875)

---

## Deliverable 1: `docs/collab/completed/phase2-summary.md`

Follow the same structure as `docs/collab/completed/phase1-summary.md`:
1. Summary (tasks completed, commit reference)
2. What Changed (node-level, per task)
3. New Env Vars section
4. Test coverage gaps (what Phase 2 scenarios are NOT yet in regression matrix)
5. Remaining items for Phase 3 (from `docs/improve-by-claude-23-02-2026.md` P3 section)
6. Recommended Phase 3 execution order

## Deliverable 2: Update `docs/collab/tasks/regression-test-matrix.md`

Add a **Section 6: Phase 2 Scenarios** with test cases for:
- T007: File > 20MB rejected with clear error message
- T007: File exactly at 20MB accepted
- T007: Queue path also rejects oversized files
- T008: Error response contains only "Failed to process the document. Please try again." — no Gemini error details
- T009: Few-shot text with 3 examples totalling > 6000 chars → safely truncated (first N complete examples that fit)
- T011: Re-ask HTTP failure → workflow continues (no crash), returns OCR result without re-ask
- T012: When env vars set, pricing uses env var values not hardcoded

## Deliverable 3: Update `docs/collab/HANDOFF.md`
- Move T014 from Pending → Completed
- Update "Last Sync" timestamp
- Add sync log entry

## Rules
- Work on branch `agents/codex`
- Do NOT modify workflow JSON files
- Commit your changes with message: `docs(ocr): phase2 summary + regression matrix update (T014)`
- After committing, update HANDOFF.md as instructed
