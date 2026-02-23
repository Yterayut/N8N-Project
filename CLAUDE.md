- to memorize

## Golden Rules

Rules ที่ห้ามละเมิด — ทุก session ทุก agent:

- **Never** `git push --force` บน `stable` หรือ `main`
- **Never** `rm -rf` โดยไม่ backup ก่อน
- **Never** commit ไฟล์ `.env`, API keys, credentials ใดๆ
- **Never** patch live n8n โดยไม่อ่าน `docs/collab/HANDOFF.md` ก่อน
- **Never** แก้ workflow JSON ด้วย sed/direct file edit — ใช้ n8n REST API เสมอ
- **Never** merge PR โดยไม่มี human approval
- **Always** รัน `./scripts/verify_nowThai_sync.sh` หลัง patch Code nodes
- **Always** อัปเดต `HANDOFF.md` หลัง task เสร็จ
- **Always** preserve workflow history — ห้ามลบ `workflow_history` records

## Multi-Agent Collaboration Protocol

### Identity
- You are Claude Code, working on branch `stable` (main worktree)
- Codex agent works on branch `agents/codex` (worktree: `agents/codex/`)

### Before Starting Work
1. Read `docs/collab/HANDOFF.md` for current status
2. Check if Codex has pending PRs or completed tasks
3. Sync Codex worktree if needed: `./scripts/collab/sync.sh codex`

### Collaboration Commands
```bash
./scripts/collab/status.sh          # Show all agent status
./scripts/collab/sync.sh            # Auto-sync current branch
./scripts/collab/sync.sh codex      # Sync Codex worktree
./scripts/collab/sync.sh all        # Sync all agents
./scripts/collab/assign.sh T007 codex "Task title"  # Create task for Codex
```

### After Completing a Task
1. Update `docs/collab/HANDOFF.md` (move task to Completed)
2. Commit and push to `stable`
3. Run `./scripts/collab/sync.sh codex` so Codex gets latest

### File Ownership
- Workflow JSON, scripts, live system: **Claude Code only**
- Documentation, plans, specs: **Both agents**
- Always update HANDOFF.md after task completion
