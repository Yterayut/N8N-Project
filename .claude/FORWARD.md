# Forward Handoff — 2026-03-14

## Where We Are
- Branch: `stable`
- Last commit: `0bdf06e fix(nexgen-example): correct layout_id+doc_type on ex_1773338904205_234d`
- Phase: T054 complete — system stable, no active tasks

## What Was Accomplished This Session

### Session 1 (T054 merge + CC approval)
- `c3772af` — Merged agents/codex → stable (T054 Codex work, 5 workflows patched)
- `3944b7a` — CC merge approval in T054-review.md

### Session 2 (T054 remaining items)
- `1a2a249` — Created `OCR_COVERAGE_REGISTRY` tab in OCM-INFRA spreadsheet (sheetId 1781006429, 12 vendor rows)
- `1a2a249` — Fixed `Code (Document Classifier)` in `up1n75qEhbsXswii`: nexgen filename hint branch now sets `vendorCode='inet'` + `layoutId='inet_nexgen_v1'`
- `1a2a249` — Fixed `HTTP Read OCR_EXAMPLES` missing x-api-key header (was 401 → 0 examples)
- `1a2a249` — Fixed coverage URL double-param bug (`?sheet=` in both URL and queryParameters)
- Nexgen E2E verified: exec `161956` — `few_shot_count=1`, `retrieval_mode=strict`, `coverage_status=learning`, customer/address filled, `decision=auto_pass` ✅

### Session 2 (nexgen example fix)
- `0bdf06e` — Fixed example `ex_1773338904205_234d`: `doc_type: other→nexgen`, `layout_id: ptt_or_fuel_v1→inet_nexgen_v1`
- `0bdf06e` — Patched `ocr-examples-api` (`LzYmwkdRfOxbCrwB`) GSheets Update node: added `layout_id` + `doc_type` to column mapping (was missing → update action silently skipped those fields)
- Production OCR test (exec 161976): 4 line items extracted correctly, total=53,655.15 ✅

## Current State of Key Files
| File | Status | Notes |
|------|--------|-------|
| `docs/collab/HANDOFF.md` | M (auto-sync log entry) | needs commit |
| `docs/collab/tasks/T054-ocr-coverage-pdca-loop-hardening.md` | clean | DoD complete |
| `docs/collab/reviews/T054-review.md` | clean | CC merge approval done |
| `.claude/FORWARD.md` | this file | |

## What To Do Next (In Order)
1. **Yut action (manual):** reconnect POC + PAY Google OAuth in n8n UI — Credentials → Google Sheets account 2 → Reconnect OAuth
2. **Commit HANDOFF.md auto-sync:** `git add docs/collab/HANDOFF.md && git commit -m "chore(sync): auto-sync log entries"` then `./scripts/collab/sync.sh all`
3. **No active tasks** — T030 (Supabase migration) is deferred; check with Yut if there's a new priority task

## Pending Tasks (from HANDOFF.md)
| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T030 | Supabase migration (proposal ready) | — | Deferred |

## Uncommitted Changes
- `docs/collab/HANDOFF.md` — M (auto-sync log entries only, no meaningful content change)

## Context That Took Time To Build (Don't Lose)

### Key Bug Found This Session
- **`Code (Document Classifier)` nexgen hint bug**: When request has no `vendor_tax_id` in body, classifier falls to filename/text hint. Nexgen branch was setting `docType='nexgen'` but NOT `vendorCode` or `layoutId` → two-pass selector had empty `wantedVendor` → 0 examples. Fix: add `vendorCode='inet'` + `layoutId='inet_nexgen_v1'` to nexgen elif branch.
- **`ocr-examples-api` GSheets Update column mapping**: Node only had 7 columns mapped (`active`, `approved_by`, `updated_at`, `gold_json`, `confirmed_count`, `active_for_prompt`, `example_id`) — `doc_type` and `layout_id` NOT mapped → update action returned ok=true but fields silently not written. Fixed by adding `doc_type` + `layout_id` to mapping.

### GSheets API in n8n HTTP Request
- `contentType: "raw"` + `rawContentType: "application/json"` + `body` field (NOT `contentType: "json"` + `jsonBody`) — required for batchUpdate and values PUT
- batchUpdate returns `{"spreadsheetId": ..., "replies": [...]}` on success

### n8n Workflow Cleanup
- Archive before delete: `POST /rest/workflows/{id}/archive` then `DELETE /rest/workflows/{id}`
- Creating workflows requires `"active": false` in the payload

### OCR_COVERAGE_REGISTRY
- Sheet tab created in OCM-INFRA (`12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`), sheetId=1781006429
- 12 rows: ptt_or, shell, caltex, susco, bangchak, pt_max_lpg, siam_gas, scg_prawet (fuel), mea (electricity), ktb_fleet (fleet_card), inet (nexgen), unknown (other)
- All status=learning; thresholds: min_examples=5, min_audited=10, fill_rate=98, accuracy=99

## Commands To Run First
```bash
# Commit pending HANDOFF auto-sync
git add docs/collab/HANDOFF.md
git commit -m "chore(sync): auto-sync log entries 2026-03-14"
./scripts/collab/sync.sh all

# Confirm system health
./scripts/verify_nowThai_sync.sh
```

## System Status Summary
| Component | Status |
|-----------|--------|
| OCR pipeline `up1n75qEhbsXswii` | ✅ Healthy |
| nexgen E2E | ✅ PASSING (exec 161956, 161976) |
| OCR_COVERAGE_REGISTRY | ✅ Live (12 rows) |
| Two-pass few-shot selector | ✅ Active |
| examples-api update action | ✅ Fixed (layout_id + doc_type columns added) |
| POC + PAY Google OAuth | ⚠️ Expired — Yut action needed |

## Last Checkpoint — 02:05 BKK
- ✅ T054 fully complete + nexgen example fixed + production OCR verified (4/4 items ✅)
- 🔄 Session complete — no active work
- ⏭️ Yut reconnect OAuth; commit HANDOFF.md auto-sync; check for new tasks
