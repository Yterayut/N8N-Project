# HANDOFF - Claude Code + Codex Collaboration

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 0 - Setup Complete, Ready to Start |
| **Active Agent** | Claude Code (stable branch) |
| **Codex Status** | Working on T002 (agents/codex branch) |
| **Last Sync** | 2026-02-23 |
| **Base Commit** | 385ceb2 |

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
| ID | Task | Owner | Priority | Started |
|----|------|-------|----------|---------|
| T002 | Create regression test matrix spec | Codex | P1 | 2026-02-23 |

### Pending
| ID | Task | Owner | Priority | Depends On |
|----|------|-------|----------|------------|
| T001 | Phase 0 audit: verify improve.md vs live workflow | Claude Code | P0 | - |
| T003 | Fix round3 undefined | Claude Code | P0 | T001 |
| T004 | Fix re-ask normalize loop | Claude Code | P1 | T001 |
| T005 | Fix queue worker retry status | Claude Code | P1 | T001 |
| T006 | Update documentation after P0/P1 fixes | Codex | P2 | T003,T004,T005 |

### Completed
_(none)_

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
| 2026-02-23 10:40 | sync | codex | auto-sync |
| 2026-02-23 10:18 | sync | codex | auto-sync |
|------|-----------|-----|-------|
| 2026-02-23 | Initial | Claude Code | Created collaboration setup |
