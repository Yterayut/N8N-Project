- to memorize

## Feedback & Knowledge Exchange Protocol

### Flow ต่อทุก task
1. **Pre-execution:** Codex อ่าน spec → comment ใน `## Discussion` section ถ้าเห็น issue
2. **Post-execution:** CC เขียน Code Review ที่ `docs/collab/reviews/T0xx-review.md` ก่อน merge เสมอ
3. **Knowledge:** Extract insight → `docs/collab/knowledge/` (ทั้งคู่เพิ่มได้)

### CC Responsibilities
- เขียน Code Review ทุกครั้งที่ Codex push — ใช้ template ที่ `docs/collab/reviews/_TEMPLATE.md`
- ถ้าเจอ pattern/gotcha ใหม่ → เพิ่มใน `docs/collab/knowledge/n8n-patterns.md`
- ถ้าเจอ lesson learned → เพิ่มใน `docs/collab/knowledge/lessons-learned.md`

### Knowledge Base
- `docs/collab/knowledge/n8n-patterns.md` — n8n-specific patterns & gotchas
- `docs/collab/knowledge/lessons-learned.md` — สิ่งที่เรียนรู้จากความผิดพลาด
- `docs/collab/reviews/` — Code reviews per task

---

## Agent Roles

- **Claude Code** = Planner + Manager + Executor (complex tasks) + Verifier (review Codex output)
- **Codex** = Executor (Async) — receives well-defined specs, executes assigned tasks
- Before assigning a task to Codex, must have a clear spec at `docs/collab/tasks/T0xx-*.md`
- Codex CAN: patch n8n via REST API, read/write SQLite, run bash scripts
- Communication: via `docs/collab/tasks/` + `docs/collab/HANDOFF.md`

---

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

### Direct Communication with Codex (via Codex CLI)

CC สามารถสั่ง Codex โดยตรงผ่าน `scripts/collab/codex-exec.sh`:

```bash
# ถาม Codex ให้ review spec ก่อน implement
./scripts/collab/codex-exec.sh discuss T028 "มีความเห็นยังไงกับ spec นี้?"

# สั่ง implement เลย (Codex จะ commit + push เอง)
./scripts/collab/codex-exec.sh implement T028

# ขอให้ Codex respond to review
./scripts/collab/codex-exec.sh respond T028

# ถามคำถามทั่วไป
./scripts/collab/codex-exec.sh ask "ตอนนี้ OCR_EXAMPLES มีกี่ row?"
```

**Flow แนะนำ (CC orchestrates):**
1. CC เขียน spec → commit → auto-sync
2. CC เรียก `codex-exec.sh discuss` → อ่านความเห็น Codex
3. CC ปรับ spec ถ้าจำเป็น → commit
4. CC เรียก `codex-exec.sh implement` → Codex ทำงาน + commit + push
5. CC review → merge → sync
6. CC เรียก `codex-exec.sh respond` → Codex ตอบ review

### After Completing ANY Action (not just tasks)
1. Update `docs/collab/HANDOFF.md` if task status changed
2. Commit to `stable`
3. **Run `./scripts/collab/sync.sh all` immediately** — no exceptions

### File Ownership
- Workflow JSON, scripts, live system: **Claude Code only**
- Documentation, plans, specs: **Both agents**
- Always update HANDOFF.md after task completion
