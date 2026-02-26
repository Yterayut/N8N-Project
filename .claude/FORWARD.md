# Forward Handoff — 2026-02-26

## Where We Are
- Branch: `stable`
- Last commit: `29d09ea feat(gg): notify CC เมื่อ GG เสร็จงาน`
- Phase: T036 System Health Report + T029D Ground Truth prep

## What Was Accomplished This Session

- **T035 merged** (9/10) — `bills=[]` bug แก้แล้ว, `OCR_RUNTIME_RULES_ENABLED=true`
- **T036 spec + assign Codex** — 3 workflows: daily health 07:30, on-demand `/health`, error spike monitor
- **T036 Codex เสร็จ** — 3 workflows สร้างแล้ว — **รอ CC review + merge**
- **codex-exec.sh แก้ 2 bugs** — pipefail exit + nested tmux Codex CLI refuse (`|| true` + `unset TMUX`)
- **GG notify เพิ่มแล้ว** — `gg-groundtruth.sh`, `gg-spec-draft.sh`, `gg-groundtruth-batch.sh` (ใหม่)
- **GG ground truth batch 21/21** — ทุก PDF ใน `file/` extract แล้ว → `docs/gg/proposals/2026-02-26-groundtruth-*.json`
- **Flow การส่งงาน Codex** — ค้นพบ + แก้ + บันทึกใน MEMORY

## Current State of Key Files

| ไฟล์ | สถานะ |
|------|-------|
| `docs/collab/HANDOFF.md` | **M uncommitted** — ต้อง commit |
| `docs/collab/tasks/T036-system-health-report.md` | spec พร้อม ✅ |
| `docs/collab/reviews/T036-review.md` | ยังไม่มี — CC ต้องเขียน |
| `docs/gg/proposals/2026-02-26-groundtruth-*.json` | 21 files รอ CC spot-check |
| `scripts/collab/codex-exec.sh` | แก้แล้ว committed ✅ |
| `scripts/gg/gg-groundtruth-batch.sh` | ใหม่ committed ✅ |

## What To Do Next (In Order)

1. **Commit HANDOFF.md** ที่ยังค้าง:
   ```bash
   git add docs/collab/HANDOFF.md && git commit -m "chore: T036 done pending review, T029D ground truth ready"
   ```
2. **Review T036** — ตรวจ 3 workflows + เขียน `docs/collab/reviews/T036-review.md` + merge agents/codex
3. **Smoke test T036** — trigger manual → ยืนยัน Telegram 07:30 + `/health` + error alert ทำงาน
4. **Spot-check GG ground truth** — เปิด 3-5 ไฟล์ `2026-02-26-groundtruth-*.json` เทียบ PDF จริงใน `file/`
5. **Implement T029D** — populate OCR_BENCHMARK_FUEL sheet แล้ว assign Codex

## Pending Tasks

| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T036 | System Health Report | CC review | Codex เสร็จแล้ว รอ merge |
| T029D | Benchmark Runner | Codex | CC spot-check ground truth ก่อน |
| T030 | Supabase migration | — | deferred |

## Uncommitted Changes
- `docs/collab/HANDOFF.md` — M (อัปเดต T036 + T029D status)

## Context That Took Time To Build

### วิธีส่งงาน Codex ที่ถูกต้อง (confirmed 2026-02-26)
```bash
# 1. เช็ค pane ต้องเป็น bash (ไม่ใช่ node)
tmux list-panes -t codex -F "#{pane_current_command}"

# 2. ส่ง full path เสมอ — ห้าม pipe (Codex ต้องการ TTY)
tmux send-keys -t codex \
  "/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/scripts/collab/codex-exec.sh implement T0xx" \
  Enter

# 3. ยืนยัน Codex start
sleep 8 && ps aux | grep "node.*codex" | grep -v grep | grep -v vscode
```

### Bugs ที่แก้ใน codex-exec.sh
1. `grep | grep` ไม่มี match → `set -e` + `pipefail` exit → แก้: `|| true`
2. `$TMUX` set → Codex CLI refuse start → แก้: `unset TMUX` ก่อนรัน

### T036 Workflow Names (Codex สร้างแล้ว)
- `system-daily-health-report` — cron 00:30 UTC = 07:30 BKK
- `system-health-ondemand` — Telegram Trigger `/health`
- `system-error-monitor` — cron */30, alert ≥5 errors/1h, cooldown 2h

### GG Batch Ground Truth (ครั้งหน้า)
```bash
./scripts/gg/gg-groundtruth-batch.sh   # batch ทุกไฟล์ใน file/
```
เมื่อเสร็จ → Telegram แจ้งยุทอัตโนมัติ

## Commands To Run First
```bash
# 1. Commit HANDOFF.md ที่ค้าง
git add docs/collab/HANDOFF.md
git commit -m "chore: update HANDOFF — T036 done pending review, T029D ground truth ready"

# 2. ดู T036 workflows ที่ Codex สร้าง
curl -s http://localhost:5678/rest/workflows -b cookie.txt | python3 -c \
  "import json,sys; d=json.load(sys.stdin); [print(w['id'], w['name'], w['active']) for w in d['data'] if 'system' in w['name']]"

# 3. ดู Codex commit T036
git -C agents/codex log --oneline -5

# 4. Review + merge T036
# เขียน docs/collab/reviews/T036-review.md แล้ว:
git merge agents/codex --no-edit && ./scripts/collab/sync.sh all
```

## Last Checkpoint — 12:50
- ✅ T036 merged, GG ground truth 21/21 fixed (caltex re-run, shell tax_id แก้), T029D spec เสร็จ + assign Codex
- 🔄 Codex กำลัง implement T029D (`tmux session codex`) — รอ review
- ⏭️ รอ Codex T029D เสร็จ → review + merge | Codex ยังไม่ respond T036 review
