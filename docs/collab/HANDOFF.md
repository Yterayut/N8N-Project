# HANDOFF - Claude Code + Codex Collaboration

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | improve-by-claude-23-02-2026.md — ALL ITEMS COMPLETE (except 1 deferred) |
| **Active Agent** | Claude Code (stable branch) |
| **Codex Status** | Idle — please read "Decisions 2026-02-24" below |
| **Last Sync** | 2026-02-24 |
| **Base Commit** | 960293a |

---

## Agent Roles

### Claude Code (main agent)
- **Branch:** `stable`
- **Worktree:** `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE`
- **Role:** Executor - patch code, test, deploy, review
- **Can:** Access live n8n, run tests, edit workflow JSON, deploy, git operations
- **Cannot:** Work async/background

### Codex (agent/codex)
- **Branch:** `agents/codex`
- **Worktree:** `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/agents/codex`
- **Role:** Planner - create plans, write docs, review, QA, boilerplate
- **Can:** Read/write files, create PRs, work async
- **Cannot:** Access live n8n, run against production, test live system

---

## Task Board

### In Progress
_(none)_

### Pending
_(none)_

### Completed
| ID | Task | Owner | Completed | Notes |
|----|------|-------|-----------|-------|
| T001 | Audit improve.md vs live workflow | Claude Code | 2026-02-23 | All 8 P0/P1 issues confirmed OPEN |
| T002 | Regression test matrix | Codex | 2026-02-23 | 18 scenarios, 5 sections, merged to stable |
| T003 | Fix round3 + allHeaders + MIME + URL + file limit | Claude Code | 2026-02-23 | 6 nodes patched, commit c556967 |
| T004 | Fix re-ask normalize bypass | Claude Code | 2026-02-23 | validation added before accepting re-ask |
| T005 | Fix queue worker retry status | Claude Code | 2026-02-23 | Set Done now writes 'error' on fail |
| T006 | Update documentation after P0/P1 fixes | Codex | 2026-02-23 | Updated workflow docs + improve docs + phase1 summary |
| T007 | File size guard (main + queue path) | Claude Code | 2026-02-23 | MAX_FILE_BYTES=20MB in JS22 + Code(Split Files) |
| T008 | Sanitize Gemini error → client | Claude Code | 2026-02-23 | Respond to Webhook (error) uses literal safe message |
| T009 | Few-shot truncation at example boundary | Claude Code | 2026-02-23 | Loop-based cut instead of char-slice mid-JSON |
| T011 | HTTP Re-ask: retry + continueRegularOutput | Claude Code | 2026-02-23 | retryOnFail=true, maxTries=2, onError=continueRegularOutput |
| T012 | THB pricing → env vars with fallback | Claude Code | 2026-02-23 | OCR_PRICE_THB_PER_1K_INPUT/OUTPUT, fallback to 0.0105/0.0875 |
| T013 | Remove 24 disabled legacy nodes | Claude Code | 2026-02-23 | 24 nodes + dangling connections removed |
| T014 | Phase 2 docs: spec + regression matrix update | Codex | 2026-02-23 | Added `phase2-summary.md`, updated regression matrix (Section 6), updated plan docs |
| T015 | Config externalization: queue batch, SLA thresholds, Telegram refs | Claude Code | 2026-02-23 | OCR_QUEUE_BATCH_SIZE, OCR_SLA_HEAVY/FAST_KB, $workflow.name/id |
| T016 | Queue worker file_id reference fix (Code Set Done) | Claude Code | 2026-02-23 | Use $input.item.json.file_id first; .first() fallbacks |
| T017 | Re-ask confidence floor conditional + OCR_REASK_CONF_BOOST env | Claude Code | 2026-02-23 | Only boost if criticalErrs===0; default no-floor unless env set |
| T018 | Electricity ref regex widen to /^\d{10,15}$/ + OCR_ELEC_REF_PATTERN | Claude Code | 2026-02-23 | severity downgraded to warning; pattern overridable |
| T019 | MIME: add TIFF (LE/BE) + HEIC extension detection | Claude Code | 2026-02-23 | sniffMimeFromBase64 + ext handler for heic/heif/tif/tiff |
| T020 | Phase 3 docs + regression matrix update | Codex | 2026-02-23 | Added `phase3-summary.md`, regression matrix Section 7, updated HANDOFF phase status |
| T021 | Rename workflow test-workflow → ocr-invoice-processor | Claude Code | 2026-02-24 | Renamed via n8n REST API + updated 3 JSON export files |
| T022 | nowThai() consolidation — standardize 5 nodes | Claude Code | 2026-02-24 | Canonical `[SHARED]` block in JS9, JS17, JS24, JS26, Parse Result; verify script: `scripts/verify_nowThai_sync.sh` |

---

## Decisions 2026-02-24

### improve-by-claude-23-02-2026.md — สรุปสถานะล่าสุด

**COMPLETE ทั้งหมดแล้ว ยกเว้น 1 item ที่ defer:**

| Priority | รายการ | สถานะ |
|----------|--------|-------|
| P0 (1 item) | round3 fix | ✅ Done |
| P1 (7 items) | re-ask, allHeaders, MIME, file limit, queue classifier, retry, URL | ✅ Done |
| P2 (6/7 items) | pricing env, file size guard, sanitize error, remove disabled nodes, few-shot, HTTP re-ask | ✅ Done |
| P2 | Google Sheets → DB migration | ⏸ **DEFERRED** — ใช้ Google Sheets ต่อไปก่อน ยังไม่ทำตอนนี้ |
| P3 (9 items) | queue batch env, SLA env, Telegram dynamic, file_id fix, reask conf, elec regex, TIFF/HEIC, workflow rename, nowThai consolidation | ✅ Done |

### Workflow Rename
- `test-workflow` (ID: `up1n75qEhbsXswii`) → **`ocr-invoice-processor`**
- มีผลทั้งใน n8n live และ JSON exports

### nowThai() Policy
- ทุก Code node ที่ใช้ nowThai() ต้องมี `// [SHARED]` canonical block เหมือนกัน
- ห้ามแก้เฉพาะ node เดียว — ต้องอัปเดตพร้อมกันทุก node ที่ระบุใน comment
- ตรวจสอบได้ด้วย: `./scripts/verify_nowThai_sync.sh`

---

## Agreements

### Git Protocol
- Claude Code works on `stable` branch
- Codex works on `agents/codex` branch
- Codex syncs FROM stable: `git merge stable`
- Codex submits work via PR to `stable`
- Never force push on `stable`

### File Ownership
- Workflow JSON (`exports/`, `workflow*.json`): **Claude Code only**
- Documentation (`docs/`): **Both** (coordinate via tasks)
- Scripts (`scripts/`): **Claude Code** primarily
- Plans/specs (`docs/collab/tasks/`): **Both** can create
- HANDOFF.md: **Both** update after each task

### Communication Protocol
1. Before starting work: read `docs/collab/HANDOFF.md`
2. Claim task: update HANDOFF.md "In Progress" section
3. After completing task: move to "Completed", update status
4. If blocked: note in HANDOFF.md, assign to other agent
5. After sync: note "Last Sync" timestamp

### Quality Gates
- Every patch must have a smoke test result noted
- Codex review required for architecture changes
- Claude Code review required for all code changes
- No deploy without regression check

---

## Sync Log

| Date | Direction | By | Notes |
| 2026-02-24 | sync | claude | T021+T022 complete; improve plan 100% done (1 deferred); please read Decisions 2026-02-24 |
| 2026-02-23 19:05 | sync | codex | T020 docs updates after Phase 3 completions |
| 2026-02-23 18:10 | sync | codex | T014 docs updates after Phase 2 completions |
| 2026-02-23 10:40 | sync | codex | auto-sync |
| 2026-02-23 10:18 | sync | codex | auto-sync |
|------|-----------|-----|-------|
| 2026-02-23 | Initial | Claude Code | Created collaboration setup |
