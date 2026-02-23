# Phase 2 Summary (Scale & Safety Fixes) - OCR `test-workflow`

**Date:** 2026-02-23  
**Prepared by:** Codex (`agents/codex`)  
**Source of record:** `docs/collab/HANDOFF.md` (T007, T008, T009, T011, T012, T013 completion notes)  
**Stable commit reference (Claude Code):** `2821577`

## 1) Summary

Claude Code completed the Phase 2 (Scale & Safety) patch set for OCR `test-workflow` and recorded completion in `HANDOFF.md`:

- **T007:** File size guard (main path + queue path)
- **T008:** Sanitize Gemini error before returning to client
- **T009:** Few-shot truncation at example boundary
- **T011:** Re-ask HTTP retry + `continueRegularOutput`
- **T012:** Pricing THB constants moved to env vars (with fallback)
- **T013:** Remove 24 disabled legacy nodes + dangling connections

This document summarizes node-level changes, newly introduced environment variables, remaining test coverage gaps, and what remains for Phase 3.

## 2) What Changed (Node-Level, Per Task)

### T007 - File Size Guard (Scale / Safety)

#### A. `Code in JavaScript22` (main `/ocr-dev` path)
- **Change:** Added file size validation using `OCR_MAX_FILE_BYTES` (default 20MB)
- **Behavior:** Throws early when uploaded file exceeds limit
- **Impact:** Prevents oversized payloads from consuming OCR/Gemini resources unnecessarily

#### B. `Code (Split Files)` (queue path)
- **Change:** Added per-file size guard in queue fan-out path (same max file limit policy)
- **Behavior:** Oversized files are rejected before queue upload/processing
- **Impact:** Main path and queue path now enforce consistent file-size safety limits

### T008 - Error Response Sanitization

#### `Respond to Webhook (error)`
- **Change:** Replaced raw Gemini/API error echo with safe generic message
- **Behavior:** Client receives sanitized text (no raw provider payload leakage)
- **Impact:** Prevents leaking Gemini internal error structure, URLs, or provider diagnostics to clients

### T009 - Few-shot Truncation Safety

#### `Code (Select Few-shot Examples)`
- **Change:** Truncation now cuts at **example boundary** rather than raw `.slice(0, 6000)`
- **Behavior:** Keeps only complete examples that fit the size budget
- **Impact:** Prevents malformed prompt JSON/examples caused by mid-example truncation

### T011 - Re-ask HTTP Resilience

#### `HTTP GenerateContent (Re-ask)`
- **Change:** Added:
  - `retryOnFail=true`
  - `maxTries=2`
  - `waitBetweenTries=5000ms`
  - `onError=continueRegularOutput`
- **Behavior:** Re-ask HTTP failures no longer hard-crash the workflow path
- **Impact:** Better resilience when Gemini transiently fails during re-ask stage

### T012 - Pricing Constants via Environment Variables

#### `Code in JavaScript9`
- **Change:** Token pricing now reads from env:
  - `OCR_PRICE_THB_PER_1K_INPUT`
  - `OCR_PRICE_THB_PER_1K_OUTPUT`
- **Fallback:** `0.0105` / `0.0875` (THB per 1K tokens)
- **Impact:** Pricing updates no longer require editing workflow code

### T013 - Legacy Cleanup

#### Global workflow cleanup (legacy `Webhook_OCR_Test9` chain)
- **Change:** Removed 24 disabled legacy nodes plus dangling connections
- **Impact:** Lower maintenance complexity, cleaner workflow graph, reduced confusion during debugging/review

## 3) New Env Vars (Introduced in Phase 2)

| Variable | Purpose | Default |
|---|---|---|
| `OCR_MAX_FILE_BYTES` | Max file size in bytes for OCR uploads (main + queue path) | `20971520` (20MB) |
| `OCR_PRICE_THB_PER_1K_INPUT` | THB cost per 1K input tokens | `0.0105` |
| `OCR_PRICE_THB_PER_1K_OUTPUT` | THB cost per 1K output tokens | `0.0875` |

### Operational Notes
- If env vars are missing, workflow should continue using defaults (T012 fallback behavior).
- File-size validation test cases must cover both `exactly limit` and `over limit`.

## 4) Test Coverage Gaps (Phase 2 scenarios not fully represented before T014 update)

Prior to T014, the regression matrix covered broad scenarios but **did not explicitly test** several Phase 2 changes. Gaps identified:

1. **File size guards**
- Main path reject >20MB
- Main path accept exactly 20MB
- Queue path reject >20MB

2. **Sanitized error responses**
- Ensure client sees only generic message (no raw Gemini error body)

3. **Few-shot truncation safety**
- Validate truncation preserves whole examples rather than cutting mid-example

4. **Re-ask retry/continue behavior**
- Simulate re-ask HTTP failure and confirm workflow continues without crash

5. **Pricing via env vars**
- Verify env-configured pricing is applied instead of hardcoded constants

These are added in **Section 6** of `docs/collab/tasks/regression-test-matrix.md` as part of T014.

## 5) Remaining Items for Phase 3 (from `docs/improve-by-claude-23-02-2026.md`)

Phase 3 (Cleanup / Maintainability) items still open:

1. Hardcoded vendor tax IDs -> move to config/env
2. Hardcoded workflow name/ID in Telegram -> use dynamic workflow metadata
3. Queue batch size hardcoded (`Code in JavaScript23`) -> env var
4. SLA lane thresholds hardcoded (`Code (SLA Lane + Timeout Budget)`) -> env var
5. Electricity ref validation too rigid (`/^\d{12}$/`) -> widen template compatibility
6. MIME support extension for TIFF/HEIC
7. Re-ask confidence floor (`Math.max(conf, 0.88)`) may inflate confidence
8. Queue worker `file_id` node reference correctness (`Code Set Done`)
9. Shared helper extraction (reduce `nowThai()` / utility copy-paste)

## 6) Recommended Phase 3 Execution Order

Recommended order emphasizes low-risk maintainability wins first, then behavior-sensitive changes:

1. **Config/env externalization (safe, high maintainability gain)**
   - Queue batch size
   - SLA thresholds
   - Telegram workflow metadata (dynamic refs)

2. **Queue worker correctness review**
   - `file_id` node reference in `Code Set Done`
   - Add regression test for queue completion metadata integrity

3. **Confidence semantics cleanup**
   - Re-ask confidence floor behavior (`0.88`) review/tuning
   - Add regression criteria to avoid confidence inflation

4. **Validation flexibility improvements**
   - Electricity reference regex widening
   - Template-aware compatibility checks

5. **MIME support extension**
   - Add TIFF/HEIC support if in scope
   - Include fixtures before enabling in production

6. **Helper refactor / code hygiene**
   - Consolidate repeated helper logic only after behavior-sensitive changes are stable

## 7) Notes

- This summary reflects **documented Phase 2 completions** from `HANDOFF.md` and the provided task list, not direct live n8n execution by Codex.
- Workflow JSON/runtime behavior remains under Claude Code execution authority; Codex documents and expands regression coverage.
