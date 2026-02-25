# Forward Handoff — 2026-02-25

## Where We Are
- Branch: `stable`
- Last commit: `be10ee3` chore: sync log
- Phase: T029 OCR Closed Learning Loop — T029A done, T029B spec ready, Codex implementing

## What Was Accomplished This Session

- ✅ Items 1-5 collaboration hardening (bc89595): review template, codex-exec.sh pre-submit checklist + verify mode, HANDOFF slimmed, spec template, completed-tasks.md archive
- ✅ T029A reviewed — reviews/T029A-review.md score 7/10, APPROVED; ocr-km-logger jmJHPPj0OM5LcZ0n, E2E exec 151644
- ✅ T029A Codex response + LESSON-009 (2-tier logging verification)
- ✅ T029B spec written + all 8 Codex Discussion bugs fixed (timezone, sheet creation, source=manual filter, P1/P3 separation, RULE_CHANGELOG deferred, dedup inside Analyze, timestamps, continueOnFail)
- 🔄 T029B implement: Codex running in tmux codex session — NOT YET CONFIRMED COMPLETE

## What To Do Next (In Order)

1. Check T029B result:
   cat /tmp/t029b-implement.log | tail -50
   tmux capture-pane -t codex -p | tail -30
   curl ... workflows | grep suggest

2. If T029B done → check git -C agents/codex status → CC commits → write T029B review

3. If T029B timed out again → re-run: tmux send-keys -t codex "./scripts/collab/codex-exec.sh implement T029B 2>&1 | tee /tmp/t029b-implement.log" Enter

4. Commit uncommitted HANDOFF.md: git add docs/collab/HANDOFF.md && git commit -m "chore: sync" && ./scripts/collab/sync.sh all

5. OCR_EXAMPLES duplicate ex_seed_001 — still pending cleanup

## Pending Tasks

| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T029B | KM Suggestion — ocr-km-suggest workflow | Codex | in progress |
| T029D | Benchmark Runner | Codex | T029A + ground truth data |
| T029C | Runtime Rules (highest risk) | Codex | T029B + T029D |

## Critical Context

### HANDOFF.md conflict loop — fix pattern:
git -C agents/codex checkout --ours docs/collab/HANDOFF.md
git -C agents/codex add docs/collab/HANDOFF.md && git -C agents/codex commit -m "chore: take stable HANDOFF" && ./scripts/collab/sync.sh all

### Codex session limits:
- codex-exec.sh via Bash tool: ~200 lines → often times out before commit
- Better: tmux send-keys -t codex "codex-exec.sh implement T0xx 2>&1 | tee /tmp/log" Enter
- After any Codex session: git -C agents/codex status --short → CC commits any file changes

### T029B key: n8n UTC → cron 0 23 * * * (06:00 Bangkok). source=manual excluded by default.

### n8n exec data: SQLite execution_data.data is reference-packed JSON array — parse with json.loads()
