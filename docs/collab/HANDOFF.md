# HANDOFF - Claude Code + Codex Collaboration

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | Phase 0 - Setup Complete, Ready to Start |
| **Active Agent** | Claude Code (stable branch) |
| **Codex Status** | Idle (agents/codex branch) |
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
