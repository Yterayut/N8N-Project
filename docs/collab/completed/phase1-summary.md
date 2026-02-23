# Phase 1 Summary (P0/P1 Fixes) - OCR `test-workflow`

**Date:** 2026-02-23  
**Prepared by:** Codex (`agents/codex`)  
**Source of record:** `docs/collab/HANDOFF.md` (T003, T004, T005 completion notes)

## 1) Summary

Claude Code completed the P0/P1 patch set for `test-workflow` (OCR) and recorded completion in `HANDOFF.md`:
- **T003:** Fix round3 + allHeaders + MIME + URL + file limit (commit `c556967`)
- **T004:** Fix re-ask normalize bypass
- **T005:** Fix queue worker retry status

This document summarizes what changed, where it changed (node-level), what was verified, and what remains for Phase 2.

## 2) What Changed (Node-Level Summary)

### T003 - Core Stability / Validation Path (P0 + P1 bundle)

#### A. `Code (Normalize + Validate)` — `round3` fix (P0)
- **Issue:** `round3` undefined caused `ReferenceError` on fleet_card quantity derivation
- **Change:** Added/ensured `round3()` helper exists
- **Impact:** Fleet-card edge cases no longer crash validator path

#### B. `Code in JavaScript5` — `allHeaders` propagation
- **Issue:** `caller_ip` logging always `unknown` because `allHeaders` was not carried forward
- **Change:** Store normalized headers into `item.json.allHeaders`
- **Impact:** Downstream nodes can read `x-forwarded-for` for observability

#### C. `Code in JavaScript22` — MIME sniffing memory optimization
- **Issue:** Decoded entire base64 file to inspect only header bytes
- **Change:** Decode only base64 prefix (magic-byte check)
- **Impact:** Reduced memory spikes on larger uploads

#### D. `Code (Split Files)` — file count guard
- **Issue:** Queue path could fan out too many files in one request (Google Drive/Sheets rate-limit risk)
- **Change:** Added max-file guard (e.g. >20 files rejected)
- **Impact:** Safer queue intake under burst uploads

#### E. Queue path classifier (queue request build path)
- **Issue:** Queue path lacked document classification; prompt quality lagged main path
- **Change:** Added document classifier in queue path
- **Impact:** Queue OCR quality closer to `/ocr-dev` main path

#### F. HTTP URL cleanup (Gemini nodes)
- **Issue:** Trailing `\\n\\n` in some URL fields could cause HTTP 400
- **Change:** Removed trailing newline artifacts
- **Impact:** Prevents avoidable malformed request failures

### T004 - Re-ask Normalize/Validate Loop (P1)

#### `Code (Apply Re-ask Result)` + downstream flow
- **Issue:** Re-ask result was merged into `raw_json` without re-running normalize/validate
- **Change:** Re-ask output is routed back through normalization/validation before final decision
- **Impact:** Prevents malformed/partial re-ask JSON from bypassing field validation

### T005 - Queue Worker Retry Status (P1)

#### `Code Set Done` (queue worker completion path)
- **Issue:** Failed queue items were marked `done`, causing silent job loss
- **Change:** Failure path writes `status=error` instead of `done`
- **Impact:** Failed jobs remain visible/retryable for scheduler/recovery logic

## 3) Test Results (from HANDOFF task notes)

`HANDOFF.md` confirms completion of T003/T004/T005. Recorded evidence in task board notes:

- **T003:** “6 nodes patched, commit `c556967`”
- **T004:** “validation added before accepting re-ask”
- **T005:** “Set Done now writes 'error' on fail”

### Practical Interpretation
- P0 crash (`round3`) addressed
- Re-ask path no longer bypasses validation
- Queue failures no longer disappear as false success

## 4) Documentation Updated in T006

As part of T006, the following documentation was updated to reflect the P0/P1 fixes:
- `docs/test-workflow-documentation.md`
- `docs/improve-by-claude-23-02-2026.md`
- `improved-by-codex.md`

## 5) Remaining Items for Phase 2 (Next Priority)

From `docs/improve-by-claude-23-02-2026.md` and `improved-by-codex.md`, recommended next items are:

1. **File size validation at webhook layer**
- Reject oversized files early (target deterministic `413/422`)

2. **Sanitize Gemini error messages before returning to client**
- Prevent raw provider/internal details leakage in `OCR_FAILED`

3. **Few-shot truncation safe boundary**
- Avoid cutting examples mid-JSON (`slice(0, 6000)` risk)

4. **Google Sheets bottleneck mitigation (short-term)**
- Reduce `Get All row_key` cost
- Add reconciliation/repair strategy if response returned before sheet save

5. **HTTP timeout/retry coverage completion**
- Especially re-ask and queue HTTP nodes where coverage may still be inconsistent

## 6) Recommended Phase 2 Execution Order

1. `Webhook file size validation`
2. `Gemini error sanitization`
3. `Few-shot safe truncation`
4. `Google Sheets mitigation / reconciliation`
5. `HTTP retry+timeout completion`

## 7) Notes

- This summary intentionally reflects **documented task outcomes** from `HANDOFF.md` rather than direct live workflow inspection (Codex role limitation).
- Claude Code remains the execution authority for workflow JSON/live n8n changes.
