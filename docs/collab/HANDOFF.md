# HANDOFF - Claude Code + Codex Collaboration

## Message for Codex — อ่านก่อนเริ่มงาน

### Feedback Loop เริ่มแล้ว — อ่านด้วย

ติดตั้ง **CC ↔ Codex Feedback System** แล้ว:

| ไฟล์ | หน้าที่ |
|------|--------|
| `docs/collab/reviews/*.md` | Code review records และ Codex response notes |
| `docs/collab/reviews/_TEMPLATE.md` | Template สำหรับ review ถัดไป |
| `docs/collab/knowledge/n8n-patterns.md` | n8n patterns seed จาก CC — Codex เพิ่มได้ |
| `docs/collab/knowledge/lessons-learned.md` | Lessons seed จาก CC — Codex เพิ่มได้ |

### Role ของเราเปลี่ยนแล้ว — สำคัญมาก

ตั้งแต่ session นี้เป็นต้นไป role ใหม่คือ:

- **Claude Code** = Planner + Manager + Verifier — วางแผน เขียน spec ตัดสินใจ review output
- **Codex** = **Executor (Async)** — รับ spec ที่ชัดแล้ว execute งาน

**Flow บังคับ ห้ามเบี่ยง:**
```
Claude วางแผน + เขียน spec + ตัดสินใจ
        ↓
Claude assign → Codex อ่าน spec → execute
        ↓
Codex commit → push agents/codex
        ↓
Claude review → merge → sync all
```

**Codex ทำได้แล้ว (ยืนยันโดย user):**
- Patch n8n workflow ผ่าน REST API (`PATCH /rest/workflows/{id}`)
- Read/write SQLite DB (`.n8n-dev/.n8n/database.sqlite`)
- Run bash scripts (test, verify)
- ห้ามแก้ workflow JSON โดยตรง — ใช้ REST API เท่านั้น

**ก่อน start งาน:** ต้องมี spec ที่ `docs/collab/tasks/T0xx-*.md` ก่อนเสมอ — ถ้าไม่มีหรือ spec ไม่ชัด ให้ comment กลับมาใน task file แทนที่จะเดาเอง

### งานที่ assigned ตอนนี้: _(none)_

---

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | improve-by-claude-23-02-2026.md — ALL ITEMS COMPLETE (except 1 deferred) |
| **Active Agent** | Claude Code (stable branch) |
| **Codex Status** | Idle (T028 completed; no task assigned) |
| **Last Sync** | 2026-02-25 (T028 merged + T5e real Telegram test PASSED — ocr-training workflow bugs fixed) |
| **Base Commit** | 5546362 |

---

## Agent Roles

### Claude Code (main agent)
- **Branch:** `stable`
- **Worktree:** `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE`
- **Role:** Planner + Manager + Executor (complex tasks) + Verifier (review Codex output)
- **Can:** Access live n8n, run tests, patch workflow via REST API, deploy, git operations
- **Cannot:** Work async/background

### Codex (agent/codex)
- **Branch:** `agents/codex`
- **Worktree:** `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/agents/codex`
- **Role:** Executor (Async) — execute well-defined tasks assigned by Claude Code
- **Can:** Patch n8n via REST API, read/write SQLite DB, run bash scripts, read/write files, create PRs
- **Must have:** Clear spec at `docs/collab/tasks/T0xx-*.md` before starting any task

---

## Task Board

### In Progress
_(none)_

### In Progress (Codex)
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
| T023 | Fix Telegram OCR Notify + workflowName + .env | Claude Code | 2026-02-24 | Telegram node→$('Code (Build Telegram Notification OCR)').first().json.telegram_text; workflowName→$workflow.name; TELEGRAM_OCR_CHAT_ID=1776637578 in .env; footer handled by Telegram node (typeVersion 1.2) auto-appends |
| T026 | OCR Feedback Receiver + KPI System | Codex | 2026-02-24 | Implemented `ocr-feedback-receiver` + `ocr-kpi-report`; webhook path `ocr-feedback-kpi` (collision avoidance); created `OCR_FEEDBACK` tab; Tests 1-5 passed |
| T024 | Google Drive save — fast/standard path | Codex | 2026-02-24 | Patched via n8n REST API: added Drive direct upload + merge node, rewired fast path, propagated `drive_file_id`, verified live response + GDrive upload node output |
| T027 | OCR Learning Loop (Path 1 + Path 2) | Codex | 2026-02-25 | Created `ocr-examples-api`, `ocr-learning-path1`, `ocr-training`; patched T026 trigger + compat proxy; few-shot active; Path 2 final Telegram T5e verified via T028 follow-up |
| T028 | ocr-training Path 2 confirm/correct + pending_train | Codex+CC | 2026-02-25 | Codex implemented; CC reviewed (8.5/10); 3 bugs fixed by CC: (1) IF node typeVersion+conditions mismatch → fixed to v2.3+v3 format, (2) Normalize Binary used $input instead of $('Telegram Trigger') → lost binary, (3) removed direct fan-out Normalize→Telegram. T5e real Telegram test PASSED (exec 151539): OCR preview sent correctly |

---

## Decisions 2026-02-24 (Skills & Rules Update)

### Golden Rules (เพิ่มใน CLAUDE.md)
Codex ต้องรู้และปฏิบัติตาม — ห้ามละเมิด:

- **Never** `git push --force` บน `stable` หรือ `main`
- **Never** `rm -rf` โดยไม่ backup ก่อน
- **Never** commit `.env`, API keys, credentials
- **Never** patch live n8n โดยไม่อ่าน `HANDOFF.md` ก่อน
- **Never** แก้ workflow JSON ด้วย sed/direct file edit (ใช้ n8n REST API เสมอ)
- **Never** merge PR โดยไม่มี human approval
- **Always** รัน `./scripts/verify_nowThai_sync.sh` หลัง patch Code nodes
- **Always** อัปเดต `HANDOFF.md` หลัง task เสร็จ
- **Always** preserve workflow history — ห้ามลบ `workflow_history` records

### Slash Skills (เพิ่ม `.claude/commands/`)
Commands ใหม่ที่ใช้ได้ทั้ง Claude Code และ Codex:

| Skill | ไฟล์ | ทำอะไร |
|-------|------|--------|
| `/recap` | `.claude/commands/recap.md` | Fresh-start orientation — โหลด FORWARD + HANDOFF + MEMORY แล้วสรุป |
| `/fyi <info>` | `.claude/commands/fyi.md` | Log ข้อมูลลง MEMORY.md แบบ one-liner ไม่มีพิธี |
| `/rrr` | `.claude/commands/rrr.md` | Session retrospective |
| `/forward` | `.claude/commands/forward.md` | Handoff สำหรับ session ถัดไป |

**Codex: ใช้ `/recap` ทุกครั้งที่เริ่ม session ใหม่**

---

## Decisions 2026-02-24 (Dev Environment — Codex อ่านด้วย)

### tmux sessions พร้อมใช้งานแล้วบน server

Server มี 2 tmux sessions รันอยู่ตลอด:

| session | path | branch | เปิดด้วย |
|---------|------|--------|---------|
| `dev` | `N8N-AUTO-RESPONSE/` | `stable` | พิมพ์ `dev` หลัง SSH |
| `codex` | `N8N-AUTO-RESPONSE/agents/codex/` | `agents/codex` | พิมพ์ `codex` หลัง SSH |

**Codex: เมื่อ SSH เข้า server แล้ว พิมพ์ `codex` เพื่อเข้า session ของคุณได้เลย**

VPN หลุด / disconnect → ไม่เป็นไร → SSH ใหม่ → `codex` → กลับมาตรงที่ค้าง

### ข้อมูลเพิ่มเติม
- Codex (OpenAI GPT) ทำงานบน `agents/codex` branch — ยืนยันแล้ว
- Claude Code ทำงานบน `stable` branch
- ทั้งสอง communicate ผ่าน git files เท่านั้น (HANDOFF.md, FORWARD.md, MEMORY.md)
- post-commit hook auto-sync ทุก commit — ไม่ต้อง sync เอง

---

## Decisions 2026-02-24 (Sync Policy — MANDATORY)

### กฎใหม่: ทุก action ต้อง sync ทันที — ไม่มีข้อยกเว้น

นับจากนี้เป็นต้นไป ทั้ง Claude Code และ Codex ต้องทำตามลำดับนี้หลัง**ทุก commit**:

```
1. git add <files>
2. git commit -m "..."
3. ./scripts/collab/sync.sh all   ← บังคับ ทุก action ไม่ยกเว้น
```

**Claude Code:** sync ด้วย `./scripts/collab/sync.sh all` ทันทีหลัง commit
**Codex:** push `agents/codex` แล้ว Claude Code จะ sync กลับเข้า stable

ไม่มีการ "sync ทีหลัง" หรือ "sync ตอนจบ session" อีกต่อไป
ทุก commit = sync ทันที

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
- **Every commit by either agent → `./scripts/collab/sync.sh all` immediately**

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
| 2026-02-25 14:14 | sync | all | auto-sync |
| 2026-02-25 11:57 | sync | all | auto-sync |
| 2026-02-25 10:57 | sync | all | auto-sync |
| 2026-02-25 09:30 | sync | all | auto-sync |
| 2026-02-25 09:10 | sync | all | auto-sync |
| 2026-02-25 09:09 | sync | all | auto-sync |
| 2026-02-25 09:00 | sync | all | auto-sync |
| 2026-02-25 08:26 | sync | codex | auto-sync |
| 2026-02-25 07:45 | sync | all | auto-sync |
| 2026-02-25 07:45 | sync | all | auto-sync |
| 2026-02-25 06:50 | sync | all | auto-sync |
| 2026-02-25 06:36 | sync | all | auto-sync |
| 2026-02-25 06:34 | sync | all | auto-sync |
| 2026-02-24 17:45 | sync | codex | T026 implemented + tested (Tests 1-5) via n8n REST; OCR_FEEDBACK sheet created; webhook path adjusted to `ocr-feedback-kpi` due collision |
| 2026-02-24 16:17 | sync | all | auto-sync |
| 2026-02-24 14:37 | sync | all | auto-sync |
| 2026-02-24 14:29 | sync | all | auto-sync |
| 2026-02-24 13:33 | sync | all | auto-sync |
| 2026-02-24 13:24 | sync | all | auto-sync |
| 2026-02-24 13:20 | sync | codex | T024 executed via n8n REST API; verified `drive_file_id` in OCR response + Google Drive upload node output; docs/HANDOFF updated |
| 2026-02-24 12:52 | sync | all | auto-sync |
| 2026-02-24 12:50 | sync | all | auto-sync |
| 2026-02-24 12:36 | sync | all | auto-sync |
| 2026-02-24 12:20 | sync | all | auto-sync |
| 2026-02-24 11:21 | sync | all | auto-sync |
| 2026-02-24 11:21 | sync | all | auto-sync |
| 2026-02-24 11:05 | sync | all | auto-sync |
| 2026-02-24 11:05 | sync | all | auto-sync |
| 2026-02-24 09:25 | sync | all | auto-sync |
| 2026-02-24 09:25 | sync | all | auto-sync |
| 2026-02-24 09:24 | sync | all | auto-sync |
| 2026-02-24 09:24 | sync | all | auto-sync |
| 2026-02-24 09:08 | sync | all | auto-sync |
| 2026-02-24 09:08 | sync | all | auto-sync |
| 2026-02-24 09:07 | sync | all | auto-sync |
| 2026-02-24 09:07 | sync | all | auto-sync |
| 2026-02-24 | fix | claude | T023: Telegram notify fixed — telegram_text + $workflow.name + footer |
| 2026-02-24 05:06 | sync | all | auto-sync |
| 2026-02-24 05:05 | sync | all | auto-sync |
| 2026-02-24 04:57 | sync | all | auto-sync |
| 2026-02-24 04:36 | sync | all | auto-sync |
| 2026-02-24 04:10 | sync | all | auto-sync |
| 2026-02-24 04:08 | sync | all | auto-sync |
| 2026-02-24 04:06 | sync | all | auto-sync |
| 2026-02-24 04:02 | sync | all | auto-sync |
| 2026-02-24 04:00 | sync | codex | auto-sync |
| 2026-02-24 03:34 | sync | codex | auto-sync |
| 2026-02-24 | sync | claude | NEW POLICY: sync-every-action mandatory; Codex: read "Decisions 2026-02-24 (Sync Policy)" |
| 2026-02-24 | sync | claude | Golden Rules + /recap + /fyi skills added; Codex: read "Decisions 2026-02-24 (Skills & Rules Update)" |
| 2026-02-24 | sync | claude | T021+T022 complete; improve plan 100% done (1 deferred); please read Decisions 2026-02-24 |
| 2026-02-23 19:05 | sync | codex | T020 docs updates after Phase 3 completions |
| 2026-02-23 18:10 | sync | codex | T014 docs updates after Phase 2 completions |
| 2026-02-23 10:40 | sync | codex | auto-sync |
| 2026-02-23 10:18 | sync | codex | auto-sync |
|------|-----------|-----|-------|
| 2026-02-23 | Initial | Claude Code | Created collaboration setup |
