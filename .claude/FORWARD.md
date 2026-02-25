# Forward Handoff — 2026-02-25 (session: T5e+codex-exec+respond-all)

## Where We Are
- Branch: `stable`
- Last commit (stable): `5546362 response(T028): Codex feedback on review`
- Last commit (agents/codex): `0e2e64c feat(T027): finalize handoff — all workflows verified`
- Phase: OCR Learning Loop complete, codex-exec.sh flow operational

## What Was Accomplished This Session

- **T5e Real Telegram E2E PASSED** (exec 151539) — 3 bugs fixed in ocr-training workflow:
  1. IF node typeVersion/conditions mismatch → fixed to v2.3+v3 format
  2. Binary lost after Code node → fixed `$('Telegram Trigger').first()`
  3. Fan-out direct Normalize→Telegram fires before OCR → connection removed
- **OCR preview format updated** — full bill fields (Customer Name, Address, line items)
- **Telegram footer fix** — `additionalFields.appendAttribution: false`
- **codex-exec.sh fixed** — from `-s danger-full-access` → full path + correct flags
- **Codex review responses done** — T024, T026, T027, T028 all filled via codex-exec.sh
- **T027 verified complete** — Codex confirmed all 4 workflows active + .env vars set
- **PATTERN-008,009,010 + LESSON-006** added to knowledge base

## Pending: Merge agents/codex → stable (4 commits)

agents/codex has 4 commits NOT yet in stable:
- `481a361` response(T024)
- `2b26756` response(T026)
- `7b103be` response(T027)
- `0e2e64c` feat(T027) finalize

## What To Do Next (In Order)

1. **Commit pending stable changes + merge agents/codex**
```bash
git add scripts/collab/codex-exec.sh docs/collab/HANDOFF.md
git commit -m "chore: fix codex-exec.sh + HANDOFF update"
git merge agents/codex --no-edit
# If conflict on HANDOFF.md:
# git checkout --ours docs/collab/HANDOFF.md && git add docs/collab/HANDOFF.md && git commit
./scripts/collab/sync.sh all
```

2. **Test Telegram footer** — ส่งบิลใหม่แล้วดูว่า footer หายแล้วหรือยัง

3. **ถ้ามี task ใหม่** — ใช้ flow:
```bash
./scripts/collab/codex-exec.sh implement T029
# หลัง Codex เสร็จ:
git -C agents/codex add <files> && git -C agents/codex commit -m "feat(T029): ..."
git merge agents/codex --no-edit && ./scripts/collab/sync.sh all
```

## Context That Took Time To Build

### codex-exec.sh — Codex sandbox blocks git commit
Codex v0.104.0 ไม่สามารถ `git commit` ใน worktree ได้:
`fatal: Unable to create .git/worktrees/codex/index.lock: Permission denied`
→ CC ต้อง commit เสมอหลัง Codex run:
```bash
git -C agents/codex add <files>
git -C agents/codex commit -m "..."
git merge agents/codex --no-edit
./scripts/collab/sync.sh all
```

### codex-exec.sh Correct Usage (v0.104.0)
```bash
./scripts/collab/codex-exec.sh discuss T029 "คำถาม"
./scripts/collab/codex-exec.sh implement T029
./scripts/collab/codex-exec.sh respond T029
```
Binary: `/home/oneclimate-uat/.nvm/versions/node/v20.19.0/bin/codex`
Flags: `exec -c 'sandbox_permissions=["disk-full-read-access","network=true"]'`

### ocr-training Workflow Current State (KW0QRXxRh9MjdPaY)
- IF node: typeVersion 2.3 + v3 conditions (options.version:3, singleValue:true)
- Normalize Binary: `$('Telegram Trigger').first()` — ไม่ใช้ $input
- Telegram (Training Reply): `additionalFields.appendAttribution: false`
- No direct Normalize→Telegram connection

### Telegram appendAttribution
ต้องอยู่ใน `additionalFields` ไม่ใช่ root level — ดู GenericFunctions.js:25

## Commands To Run First
```bash
# Resume from merge pending state
git add scripts/collab/codex-exec.sh docs/collab/HANDOFF.md
git commit -m "chore: fix codex-exec.sh flags + HANDOFF"
git merge agents/codex --no-edit
./scripts/collab/sync.sh all
git log --oneline -8
```
