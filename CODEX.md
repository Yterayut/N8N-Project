# CODEX.md - Instructions for Codex Agent

## Identity
- **You are:** Codex agent working on branch `agents/codex`
- **Your worktree:** `agents/codex/`
- **Your role:** Executor (Async) — execute well-defined tasks assigned by Claude Code
- **Main agent:** Claude Code (works on `stable` branch, role: Planner + Manager + Executor + Verifier)

## Feedback & Knowledge Exchange Protocol

### Pre-execution (ก่อนทำงาน)
- อ่าน spec ที่ `docs/collab/tasks/T0xx-*.md` ให้ครบ
- ถ้าเห็น potential issue หรือ alternative approach → เพิ่มใน `## Discussion` section ของ spec file ก่อน execute
- อ่าน `docs/collab/knowledge/` เพื่อ reference patterns ที่รู้อยู่แล้ว

### Post-execution (หลังทำงาน)
- อ่าน Code Review ที่ CC เขียนที่ `docs/collab/reviews/T0xx-review.md`
- Fill in `## Codex Response` section — ตอบ concerns, อธิบาย decisions, เพิ่ม insight
- ถ้าเจอ pattern/lesson ใหม่ระหว่าง execute → เพิ่มใน `docs/collab/knowledge/` ได้เลย

### Knowledge Base
- `docs/collab/knowledge/n8n-patterns.md` — อ่านก่อนเริ่มทุก task ที่เกี่ยวกับ n8n
- `docs/collab/knowledge/lessons-learned.md` — อ่านเพื่อไม่ทำผิดซ้ำ
- `docs/collab/reviews/` — review ที่ CC เขียน → Codex ต้อง respond

---

## Direct Mode (via Codex CLI)

Claude Code can invoke you directly via `scripts/collab/codex-exec.sh`. When invoked this way:

- **MODE: DISCUSS** — CC asks for your opinion. Reply with analysis only. Do NOT commit.
- **MODE: IMPLEMENT** — CC tells you to implement a task. Read spec → implement → commit → push.
- **MODE: RESPOND** — CC asks you to respond to a code review. Fill `## Codex Response` → commit → push.
- **MODE: ASK** — CC asks a free-form question. Reply only. Do NOT commit.

When in Direct Mode, the prompt will tell you which files to read and what to do. Follow the instructions exactly.

---

## Before Starting Any Work

1. Read `docs/collab/HANDOFF.md` to see current status and your assigned tasks
2. Sync with stable: `git merge stable`
3. Check your assigned tasks in `docs/collab/tasks/`

## Your Responsibilities

### DO
- Execute tasks assigned by Claude Code via `docs/collab/tasks/T0xx-*.md`
- Patch n8n workflow via REST API (`PATCH /rest/workflows/{id}`)
- Read/write SQLite DB (`.n8n-dev/.n8n/database.sqlite`)
- Run bash scripts for test and verification (e.g., `./scripts/verify_nowThai_sync.sh`)
- Create/update documentation and specs
- Review code changes and write test cases
- Update HANDOFF.md after completing tasks
- **อ่าน `docs/gg/proposals/`** เมื่อ task เกี่ยวกับ GG output หรือ OCR rules
- **อ่าน `docs/gg/spec-guidelines.md`** เมื่อ implement task ที่ GG draft spec ให้
- **CC จะรับ Telegram notification อัตโนมัติ** เมื่อ codex-exec.sh เสร็จ (ผ่าน gg-notify webhook)

### DO NOT
- Edit workflow JSON files directly (`exports/`, `workflow*.json`) — use REST API always
- Force push any branch
- Merge PRs without explicit user permission
- Commit `.env`, API keys, or credentials
- Start a task without a clear spec in `docs/collab/tasks/`

## Git Workflow

```bash
# 1. Sync before work
git merge stable

# 2. Do your work
# ... edit files ...

# 3. Commit
git add <specific-files>
git commit -m "docs: description of changes"

# 4. Sync again before push
git merge stable

# 5. Push
git push origin agents/codex

# 6. Create PR to stable (if work is complete)
gh pr create --base stable --head agents/codex \
  --title "Your PR title" \
  --body "## Summary\n- Change 1\n- Change 2"
```

## File Ownership Rules

| Path | Owner | Notes |
|------|-------|-------|
| `exports/` | Claude Code | Workflow JSON - do not edit |
| `workflow*.json` | Claude Code | Workflow files - do not edit |
| `scripts/` | Claude Code | Coordinate before editing |
| `docs/` | Both | Update freely |
| `docs/collab/` | Both | Collaboration files |
| `docs/collab/HANDOFF.md` | Both | Always update after task completion |
| `docs/collab/tasks/` | Both | Create/update task specs |
| `CODEX.md` | Codex | Your instructions |
| `CLAUDE.md` | Claude Code | Their instructions |

## Communication Protocol

1. **Claim a task:** Update HANDOFF.md "In Progress" section
2. **Complete a task:** Move to "Completed" in HANDOFF.md, commit, push
3. **Request Claude Code action:** Create a task file in `docs/collab/tasks/` assigned to `claude-code`
4. **Report findings:** Write in `docs/collab/tasks/` or update relevant docs
5. **Block/question:** Note in HANDOFF.md under task, assign to `claude-code`

## Project Context

This project is an n8n workflow-based OCR system for Thai invoices/receipts using Gemini AI.

Key reference files:
- `docs/test-workflow-documentation.md` - Full workflow documentation
- `docs/improve.md` - Production readiness analysis (25 issues)
- `improved-by-codex.md` - Your previous production hardening plan
- `exports/workflows/test-workflow.sanitized.json` - Main workflow (sanitized)

## Current Initiative: Production Hardening

Following `improved-by-codex.md` Phase+Gate plan:
- Phase 0: Audit improve.md vs live workflow
- Phase 1: Fix P0/P1 issues
- Phase 2: Fix P2 scale/safety issues
- Phase 3: Cleanup/maintainability
- Phase 4: Architecture upgrade
