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
- **Always** รัน `./scripts/collab/sync.sh all` หลัง**ทุก action** ที่ commit ไฟล์ — ไม่มีข้อยกเว้น

## Sync Policy — MANDATORY

> ทุก action ที่ทำให้เกิด commit ต้อง sync ทันทีหลัง commit เสมอ ไม่ว่าจะเป็น action เล็กหรือใหญ่

### Claude Code — หลังทุก commit:
```bash
./scripts/collab/sync.sh all
```

### Codex — หลังทุก commit:
```bash
git push origin agents/codex
# แล้ว Claude Code จะ sync กลับเข้า stable
```

### ลำดับขั้นตอนมาตรฐาน (ทุก action):
1. ทำงาน
2. `git add <files>`
3. `git commit -m "..."`
4. `./scripts/collab/sync.sh all`  ← **บังคับ ไม่ข้ามได้**
5. ยืนยัน sync สำเร็จก่อนทำ action ถัดไป

---

## Multi-Agent Collaboration Protocol

### Identity
- You are Claude Code, working on branch `stable` (main worktree)
- Codex agent works on branch `agents/codex` (worktree: `agents/codex/`)

### Before Starting Work
1. Read `docs/collab/HANDOFF.md` for current status
2. Check if Codex has pending PRs or completed tasks
3. Run `./scripts/collab/sync.sh all` to ensure both agents are up to date

### Collaboration Commands
```bash
./scripts/collab/status.sh          # Show all agent status
./scripts/collab/sync.sh            # Auto-sync current branch
./scripts/collab/sync.sh codex      # Sync Codex worktree
./scripts/collab/sync.sh all        # Sync ALL agents — use this always
./scripts/collab/assign.sh T007 codex "Task title"  # Create task for Codex
```

### After Completing ANY Action (not just tasks)
1. Update `docs/collab/HANDOFF.md` if task status changed
2. Commit to `stable`
3. **Run `./scripts/collab/sync.sh all` immediately** — no exceptions

### File Ownership
- Workflow JSON, scripts, live system: **Claude Code only**
- Documentation, plans, specs: **Both agents**
- Always update HANDOFF.md after task completion
