# Forward Handoff — 2026-02-26

## Where We Are
- Branch: `stable`
- Last commit: `ab19016` chore: HANDOFF sync — all tasks complete
- Phase: **Sprint สมบูรณ์** — T036/T037/T038/T039 ทำเสร็จหมด

## What Was Accomplished This Session

- **T038 ✅ APPROVED 9/10** — Benchmark tax_invoice accuracy: 75.52% → **97.92%** (เป้า 95%)
  - `normalizeInvoiceNum()` fix invoice I→1 confusion, exec `153152`
- **T039 ✅ APPROVED 9/10** — Active Learning Loop ปิด loop แล้ว
  - OCR_FEEDBACK → TRAIN_CASES bridge verified (6 feedback_kpi rows live)
  - FIELD_DIFFS 54 rows, auto-pattern ≥3 → OCR_KM_LESSONS (status=suggestion)
  - exec `153089/153093/153112`
- **T036 respond ✅** — Codex fill `## Codex Response` + LESSON-015 added
  - Merge Approval completed — T036 fully closed
- **T037 ✅ APPROVED 9/10** — validation_trace เพิ่มใน main OCR workflow
  - caller เห็น trace ทุก rule pass/fail, exec `153324`/`153395`
- **CODEX.md rule enforced** — "ไม่มี Discussion = ต้อง implement 100%"
- **Auto-pipeline** — watcher script monitor Codex + auto-assign next task
- **Feedback loop verified** — ทั้ง 2 ช่องทาง (admin feedback + Telegram train) ครบ loop แล้ว
  - TRAIN_CASES: 12 rows (4 manual + 6 feedback_kpi + 2 telegram_train)
  - T029B รัน 06:00 BKK ทุกวัน → pattern → OCR_KM_LESSONS → OCR_RUNTIME_RULES (flag=ON)

## Current State of Key Files

| ไฟล์ | สถานะ |
|------|-------|
| `docs/collab/HANDOFF.md` | ✅ synced — board cleared |
| `docs/collab/reviews/T036-review.md` | ✅ Merge Approval filled |
| `docs/collab/reviews/T037-review.md` | ✅ APPROVED 9/10 |
| `docs/collab/reviews/T038-review.md` | ✅ APPROVED 9/10 |
| `docs/collab/reviews/T039-review.md` | ✅ APPROVED 9/10, Codex respond pending |
| `docs/collab/tasks/T039-active-learning-loop.md` | ✅ closed |
| `agents/codex/CODEX.md` | ✅ เพิ่ม 100% spec compliance rule |

## What To Do Next (In Order)

1. **T039 respond** — `codex-exec.sh respond T039` (Codex ตอบ review T039 — minor, ไม่ urgent)
2. **T037 respond** — `codex-exec.sh respond T037` (เช่นกัน — minor)
3. **Review OCR_KM_LESSONS** — ดู entries ที่ status=`suggestion` → approve/reject → enable เป็น runtime rule
4. **T040 (ถ้าต้องการ)** — OCR prompt improvement จาก lessons ที่ accumulate แล้ว
5. **ติดตาม GG prompt-engineer proposals** — cron ทุกวัน 09:00 → `docs/gg/proposals/`

## Pending Tasks (from HANDOFF.md)

| ID | Task | Owner | หมายเหตุ |
|----|------|-------|---------|
| T030 | Supabase migration | — | Deferred ไม่มีกำหนด |

## Uncommitted Changes

ไม่มี — clean working tree

## Context That Took Time To Build (Don't Lose)

### Training Loop Status (verified 2026-02-26)
- ทั้ง 2 ช่องทาง (admin feedback + ยุท Telegram) ครบ loop แล้ว — ไม่ต้องแก้เพิ่ม
- TRAIN_CASES เป็น single source of truth — แยกด้วย `source` column (feedback_kpi / telegram_train / manual)
- T029B รัน 06:00 BKK (`0 23 * * *` UTC) — corrections วันนี้จะวิเคราะห์พรุ่งนี้
- Manual trigger: `curl -X POST /webhook/ocr-km-suggest -H "x-api-key: $OCR_SHARED_API_KEY"`

### Benchmark Status
- `ocr-benchmark-runner` (`vkIBCzSBUDVZH5kQ`) — `/webhook/ocr-benchmark`
- Overall avg: 92.19%, tax_invoice: **97.92%** (exec `153152`)
- bm_ritta01 → skip (fixture_doc_type_mismatch) — ไม่ใช่ bug

### Codex Git Sandbox Issue (recurring)
- Codex CLI sandbox block git commit → CC ต้อง commit ให้เสมอ:
  ```bash
  git -C agents/codex add <files> && git -C agents/codex commit -m "..." && git merge agents/codex --no-edit && ./scripts/collab/sync.sh all
  ```
- Monitor script: `nohup bash /tmp/monitor-codex.sh > /tmp/monitor-codex.log 2>&1 &`

### Auto-Pipeline Pattern (ใช้งานได้)
```bash
# watcher ที่ detect Codex commit แล้ว auto-merge + assign next task
nohup bash /tmp/watch-next.sh > /tmp/watch.log 2>&1 &
```
แต่ monitor ต้องคำนึงว่า Codex sandbox block git → CC ยังต้อง commit ให้

### GG Roles ที่ยังไม่ได้ใช้จริง
- G (Prompt Engineer) — cron รันทุกวัน proposals อยู่ที่ `docs/gg/proposals/` รอ review
- J (OCR Validator) — ยังไม่เคย invoke
- I (Spec Drafter) — ยังไม่เคยใช้ (CC เขียนเอง)

### วิธีส่งงาน Codex (confirmed working)
```bash
# ตรวจ pane ต้องเป็น bash
tmux list-panes -t codex -F "#{pane_current_command}"
# ส่ง command
tmux send-keys -t codex "/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/scripts/collab/codex-exec.sh implement T0xx" Enter
# รอ 20 วิ แล้วตรวจ
sleep 20 && ps aux | grep "node.*codex" | grep -v grep | grep -v vscode | wc -l
```
ห้าม pipe `&&` ต่อใน same tmux send-keys — buffer concatenation bug

## Commands To Run First

```bash
# 1. Recap สถานะ
git log --oneline -5

# 2. ดู OCR_KM_LESSONS ที่สร้างอัตโนมัติ
source .env
curl -s "http://localhost:5678/webhook/gg-data?sheet=OCR_KM_RUNTIME_RULES" \
  -H "x-api-key: $OCR_SHARED_API_KEY" | python3 -c "import json,sys; rows=json.load(sys.stdin); [print(r.get('rule_id','?'), r.get('status','?'), str(r.get('description','?'))[:60]) for r in rows[-5:]]"

# 3. ดู GG prompt proposals ล่าสุด
ls -lt docs/gg/proposals/ | head -10

# 4. ถ้าจะ assign งาน Codex ต่อ
./scripts/collab/codex-exec.sh respond T039
```

## Last Checkpoint — 20:52
- ✅ T036/T037/T038/T039 done, reviewed, merged — board clean
- ✅ Feedback loop ทั้ง 2 ช่องทางครบ, CODEX.md rule enforced
- ⏭️ Session ถัดไป: review OCR_KM_LESSONS + T039/T037 respond (minor) + วางแผน T040 ถ้าต้องการ
