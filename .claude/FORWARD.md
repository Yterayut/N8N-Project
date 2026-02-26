# Forward Handoff — 2026-02-26

## Where We Are
- Branch: `stable`
- Last commit: `33f471a` docs(retro): session retrospective 2026-02-26-3agent-gap-closing
- Phase: **3-Agent Gap Closing COMPLETE** — T033/T032/T029C merged, T034 done, 8 gap changes in

## What Was Accomplished This Session

- ✅ Merged Codex T033+T032+T029C from `agents/codex` → `stable` (`c95080b`)
- ✅ Live tests passed: T033 webhooks (gg-data-gateway + gg-notify-gateway), T032 timing-safe auth, T029C response
- ✅ GG Spec Feedback Loop installed — `docs/gg/feedback/T034-feedback.md` + `docs/gg/spec-guidelines.md` (10 rules)
- ✅ T034 spec rewritten by CC (6 issues found in GG draft — internal reasoning, wrong auth, missing webhookId, wrong CLI flags, DoD format, missing Risk)
- ✅ T034 (GG Health Monitor) assigned + completed by Codex — `gg-health-monitor` workflow `BlCrCNITw9ThtfOx` active
- ✅ `scripts/gg/gg-health.sh` created by Codex — checks CLI, API (timeout 20s), scripts, storage, data gateway
- ✅ `codex-exec.sh` REPO_ROOT bug fixed (2 attempts) — now uses `git rev-parse --git-common-dir` for worktree-aware detection
- ✅ 8 gap-closing changes committed (`b45c256`):
  1. `codex_notify()` in codex-exec.sh — Telegram after implement/verify/respond
  2. Dependency check in codex-exec.sh — warn if prerequisite not complete
  3. GG proposals/reports awareness in codex-exec.sh preamble
  4. Approval Status template in `common.sh` `save_proposal()`
  5. `gg-spec-draft.sh` loads n8n-patterns + lessons-learned + CC feedback
  6. Merge Approval section in `_TEMPLATE.md`
  7. CODEX.md updated — GG awareness + notification note
  8. `spec-guidelines.md` — n8n patterns reference
- ✅ Session retrospective saved — `docs/collab/retrospectives/2026-02-26-3agent-gap-closing.md`

## Current State of Live System

| Workflow | ID | Status |
|----------|----|--------|
| ocr-invoice-processor | `up1n75qEhbsXswii` | Active, 114 nodes |
| gg-data-gateway | `XtaSg9pLDuPERtI8` | Active — GET /webhook/gg-data |
| gg-notify-gateway | `YZTJwkh25isaLKHo` | Active — POST /webhook/gg-notify |
| gg-health-monitor | `BlCrCNITw9ThtfOx` | Active — GET /webhook/gg-health |
| ocr-rules-reader | `dFzVzAFjdRJHbQqe` | Active — flag=false (safe) |
| ocr-km-logger | `jmJHPPj0OM5LcZ0n` | Active |
| ocr-km-suggest | `NkKd02QyzLRcpIJM` | Active — daily 06:00 BKK |
| ocr-feedback-receiver | `ztJ8oCBHREUPPry6` | Active |

## What To Do Next (In Order)

1. **Commit HANDOFF.md** — `git add docs/collab/HANDOFF.md && git commit -m "chore: sync handoff" && ./scripts/collab/sync.sh all`
2. **Write T034 Code Review** — `docs/collab/reviews/T034-review.md` จาก `_TEMPLATE.md` — Codex ต้องการ review เพื่อ fill Codex Response
3. **Test Codex notification** — `./scripts/collab/codex-exec.sh ask "ping"` → ดู Telegram ว่ามี notification
4. **Review GG curation report** — `docs/gg/reports/2026-02-25-curation.md` — 1 case recommended FLAG/REMOVE รอ CC decision
5. **Test gg-spec-draft.sh round 2** — `./scripts/gg/gg-spec-draft.sh "test requirement"` → verify guidelines inject ทำงาน
6. **bills=[] investigation** — ก่อน enable `OCR_RUNTIME_RULES_ENABLED=true` ต้องสืบสวน data lineage issue

## Pending Tasks (from HANDOFF.md)

| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T034 review | CC write Code Review for T034 | CC | T034 done ✅ |
| T029D | Benchmark Runner (DEFERRED) | Codex | Ground truth test docs in GDrive |
| T030 | Supabase migration (proposal ready) | — | CC decision on scope |

## Uncommitted Changes

- `M docs/collab/HANDOFF.md` — needs commit + sync

## Context That Took Time To Build (Don't Lose)

### GG Spec Feedback Loop (NEW this session)
- GG ยังไม่สมบูรณ์ — T034 draft มี 6 issues (internal reasoning ใน output, wrong auth, missing webhookId, wrong flags, DoD format, missing Risk)
- **2-layer feedback**: per-spec `docs/gg/feedback/T0xx-feedback.md` + living `docs/gg/spec-guidelines.md` (10 rules)
- `gg-spec-draft.sh` now injects: spec-guidelines + n8n-patterns + lessons-learned + all feedback files
- **Next GG spec test**: รัน `gg-spec-draft.sh "test"` → ดูว่า output เริ่มด้วย `# T0xx` ทันที ไม่มี preamble

### codex-exec.sh REPO_ROOT Detection
- Fix: `git rev-parse --git-common-dir` → absolute path สำหรับ worktree, `.git` สำหรับ main repo
- Pattern: `case "$_GIT_COMMON" in /*) REPO_ROOT="$(dirname "$_GIT_COMMON")" ;; *) REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)" ;; esac`
- เหตุผล: ถ้ารันจาก worktree `agents/codex/` → git-common-dir = `/path/to/main-repo/.git` → dirname = main repo ✅

### Codex Notification (NEW this session)
- `codex_notify()` ใน codex-exec.sh — POST ไป `/webhook/gg-notify` พร้อม role=Codex
- รัน auto หลัง implement/verify/respond modes
- **ยังไม่ได้ test จริง** — ต้องทดสอบว่า Telegram รับได้

### CODEX.md Gitignore Pattern
- `agents/` directory ถูก gitignore ใน stable — commit CODEX.md ต้องทำใน worktree แล้ว merge:
  ```bash
  git -C agents/codex add CODEX.md && git -C agents/codex commit -m "..."
  git merge agents/codex --no-edit && ./scripts/collab/sync.sh all
  ```

### Codex Push Failure (ongoing)
- `git push origin agents/codex` failed — no GitHub credentials in shell
- Workaround: CC merge manually `git -C agents/codex ...` + sync
- Fix needed: GITHUB_TOKEN in .env + token-based remote URL

### GG Curation Report Pending
- `docs/gg/reports/2026-02-25-curation.md` — generated during T033 verification
- 1 case recommended FLAG/REMOVE — CC ยังไม่ได้ review

## Commands To Run First

```bash
# 1. Commit uncommitted HANDOFF.md
git add docs/collab/HANDOFF.md && git commit -m "chore: sync handoff 2026-02-26" && ./scripts/collab/sync.sh all

# 2. Write T034 review (new file from template)
cat docs/collab/reviews/_TEMPLATE.md  # read template first

# 3. Test Codex notification
./scripts/collab/codex-exec.sh ask "ping" 2>&1 | tail -5
# Then check Telegram

# 4. Review GG curation report
cat docs/gg/reports/2026-02-25-curation.md
```

## Last Checkpoint — 08:50
- ✅ T034 review CLOSED (Codex responded, LESSON-011 added, Merge Approval done)
- ✅ GG/Codex "Don't Trust, Verify Only" policy — LESSON-010, spec-guidelines, MEMORY updated
- ✅ bills=[] root cause found + T035 spec เขียนแล้ว — assigned Codex
- ⏭️ รอ Codex implement T035 → CC verify → enable OCR_RUNTIME_RULES_ENABLED=true
