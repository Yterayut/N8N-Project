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
| **Phase** | T029 OCR Closed Learning Loop (4 sub-phases) |
| **Active Agent** | Claude Code (stable) |
| **Codex Status** | T031 complete (runtime-rules flag=true smoke + restore); found `bills=[]` vs `bills_count` gap in rules-apply node output; T029 learning loop complete (T029D deferred) |
| **Last Sync** | 2026-02-25 20:18 |
| **Completed tasks archive** | `docs/collab/completed-tasks.md` (T001–T028) |

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

### In Progress (CC)
_(none)_

### In Progress (Codex)
_(none)_

### Pending
| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T029D | Benchmark Runner (DEFERRED) | Codex | Ground truth test documents in GDrive (not available) |
| T030 | Supabase migration (proposal ready) | — | Codex proposal in T029-architecture.md Discussion |

### Recently Completed
| ID | Task | Owner | Date | Score |
|----|------|-------|------|-------|
| T031 | Runtime Rules flag=true E2E Smoke Test | Codex | 2026-02-25 | flag=true branch verified (`151793`), restore verified (`151800`); rule apply blocked by runtime `bills=[]` in `Code (Apply Runtime Rules)` |
| T029C | Runtime Rules (Dynamic Rules Integration) | Codex | 2026-02-25 | **8/10 APPROVED**; +3 nodes main OCR; `ocr-rules-reader` active; exec 151755 flag=false ✅; review: `docs/collab/reviews/T029C-review.md` |
| T029B | KM Suggestion — LESSONS + CHANGELOG | Codex | 2026-02-25 | Implemented; workflow `NkKd02QyzLRcpIJM` active; webhook 401/200 verified; E2E exec `151678` |
| T029A | OCR KM Logger (TRAIN_CASES + FIELD_DIFFS) | Codex | 2026-02-25 | 7/10 — reviewed, APPROVED; workflow `jmJHPPj0OM5LcZ0n` active |
| T028 | ocr-training Path 2 confirm/correct | Codex+CC | 2026-02-25 | 7.5/10 — T5e E2E PASSED exec 151539 |
| T027 | OCR Learning Loop Path1+Path2 | Codex | 2026-02-25 | 7.5/10 |
| T026 | OCR Feedback + KPI | Codex | 2026-02-24 | 9/10 |

_ดู T001–T028 ทั้งหมดได้ที่ `docs/collab/completed-tasks.md`_

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
| 2026-02-25 19:51 | sync | all | auto-sync |
| 2026-02-25 19:51 | sync | all | auto-sync |
| 2026-02-25 19:42 | sync | all | auto-sync |
| 2026-02-25 15:46 | sync | all | auto-sync |
| 2026-02-25 15:46 | sync | all | auto-sync |
| 2026-02-25 15:46 | sync | all | auto-sync |
| 2026-02-25 15:45 | sync | all | auto-sync |
| 2026-02-25 15:44 | sync | all | auto-sync |
| 2026-02-25 15:37 | sync | all | auto-sync |
| 2026-02-25 15:27 | sync | all | auto-sync |
| 2026-02-25 15:26 | sync | all | auto-sync |
| 2026-02-25 15:00 | sync | all | auto-sync |
| 2026-02-25 15:00 | sync | all | auto-sync |
| 2026-02-25 14:56 | sync | all | auto-sync |
| 2026-02-25 14:56 | sync | all | auto-sync |
| 2026-02-25 14:53 | sync | all | auto-sync |
| 2026-02-25 14:53 | sync | all | auto-sync |
| 2026-02-25 14:43 | sync | all | auto-sync |
| 2026-02-25 14:43 | sync | all | auto-sync |
| 2026-02-25 14:14 | sync | all | auto-sync |
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
