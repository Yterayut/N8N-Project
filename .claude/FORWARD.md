# Forward Handoff — 2026-02-25 (session: T026-merge + T027-learning-loop)

## Where We Are
- Branch: `stable`
- Last commit: `113ff77 feat(collab): T027 spec — OCR learning loop (Path 1 + Path 2)`
- Phase: Learning Loop design — T027 assigned to Codex, rอ implement

---

## What Was Accomplished This Session

- **T026 merge + review** (`5c8ef9a`, `59c6574`)
  - Codex ทำ `ocr-feedback-receiver` + `ocr-kpi-report` workflows สำเร็จ
  - CC review score 8.5/10 — verified live endpoint
  - Endpoint จริง: `/webhook/ocr-feedback-kpi` (ไม่ใช่ `/ocr-feedback` — collision)
  - Admin CarbonReceipt รับทราบ endpoint แล้ว (ส่ง LINE แล้ว)

- **Cleanup** (this session)
  - ตรวจ `Webhook_OCR_Feedback` ใน main workflow = forward to `OCR_FEEDBACK_API_URL` (ยังไม่ set)
  - Tmp workflows ลบไปแล้ว (`HxquPx1lKdWReSFY`, `siAYUa8Vawvj3CDJ`)

- **GLM-4 หารือ** — ตัดสินใจไม่เพิ่มเป็น agent ตอนนี้ (complexity > benefit)

- **T027 spec** (`113ff77`)
  - ออกแบบ OCR Learning Loop ทั้ง 2 เส้น
  - Path 1: auto-learn จาก admin feedback (accuracy < 75% → pending → Telegram approve)
  - Path 2: manual training ผ่าน Telegram bot
  - 3 workflows ใหม่: `ocr-examples-api`, `ocr-learning-path1`, `ocr-training`
  - Assigned to Codex

- **Session retrospective** (`21312ba`) — บันทึกไว้ที่ `docs/collab/retrospectives/2026-02-25-ocr-feedback-kpi.md`

---

## Current State of Key Files

| File | Status | หมายเหตุ |
|------|--------|---------|
| `docs/collab/tasks/T027-ocr-learning-loop.md` | ✅ committed | spec ครบ รอ Codex |
| `docs/collab/HANDOFF.md` | M (uncommitted) | มี sync log update เล็กน้อย |
| `docs/collab/reviews/T026-review.md` | ✅ committed | score 8.5/10 |
| `code-node-enhanced.js` | M | ไม่เกี่ยวกับงาน session นี้ |
| `workflow3.json`, `workflow_patch.json` | M | ไม่เกี่ยวงาน — ไม่ต้อง commit |

---

## What To Do Next (In Order)

### 1. รอ Codex implement T027
Codex ต้องทำ:
1. สร้าง `OCR_EXAMPLES` sheet + seed data
2. สร้าง `ocr-examples-api` workflow
3. เพิ่ม `OCR_FEEDBACK_API_URL` ใน `.env`
4. สร้าง `ocr-learning-path1` workflow
5. Patch `ocr-feedback-receiver` เพิ่ม trigger Path 1
6. สร้าง `ocr-training` (Telegram) workflow
7. รัน test 1-7

### 2. เมื่อ Codex push → CC review + merge
- ตรวจ test 1-7 ผ่านครบ
- เขียน `docs/collab/reviews/T027-review.md`
- Merge → sync all

### 3. Bootstrap OCR_EXAMPLES ด้วย examples จริง
หลัง T027 เสร็จ — ใช้ Path 2 (Telegram) เพิ่ม examples สำหรับ vendor ที่ใช้บ่อย:
- PTT/OR fuel
- Bangchak fuel
- MEA electricity
- อย่างน้อย vendor ละ 2-3 examples

### 4. Monitor KPI หลังเปิดใช้งาน
- ดู accuracy % ใน Telegram report (daily 08:00)
- ถ้า accuracy ขึ้น → loop ทำงานถูก

---

## Pending Tasks (from HANDOFF.md)

| ID | Task | Owner | สถานะ |
|----|------|-------|-------|
| T027 | OCR Learning Loop (Path 1 + Path 2) | Codex | Assigned 2026-02-25 |
| T026-review | Codex fill `## Codex Response` ใน T026-review.md | Codex | ยังไม่ fill |
| T025 | Drive fail regression tests | - | ยังไม่มี spec |

---

## Uncommitted Changes (ที่สำคัญ)

| File | ควรทำอะไร |
|------|----------|
| `docs/collab/HANDOFF.md` | commit ได้เลย (sync log เล็กน้อย) |
| `code-node-enhanced.js` | ตรวจก่อน — ไม่แน่ใจว่าแก้อะไร |
| `workflow3.json`, `workflow_patch.json` | ไม่ต้อง commit |

---

## Context That Took Time To Build (Don't Lose)

### T027 Architecture Key Points
- `OCR_FEEDBACK_API_URL` = internal URL `http://127.0.0.1:5678/webhook/ocr-examples-api`
- OCR workflow มี `HTTP Read OCR_EXAMPLES` + `HTTP Save Example` รอใช้อยู่แล้ว — แค่ต้องมี URL
- `Code (Select Few-shot Examples)` มี try/catch → fallback empty ถ้า API down
- Webhook_OCR_Feedback (main workflow) = forward to `OCR_FEEDBACK_API_URL` แยกจาก T026

### Path 1 Auto-promote Logic
- accuracy < 75% → add pending (active=false)
- same vendor+doc_type correct ≥ 3 ครั้ง → auto-activate (ไม่รอ approve)
- User approve ผ่าน Telegram: `approve ex_xxx` หรือ `reject ex_xxx`

### Path 2 Telegram Training
- ส่งไฟล์บิลมาที่ bot → OCR runs → ตอบ "ถูก" หรือ "แก้ total=1350.00"
- Security: validate chat_id = `TELEGRAM_OCR_CHAT_ID` เท่านั้น
- State เก็บใน workflow static data: `pending_train: { request_id, ocr_result }`

### tmux Navigation (อย่าลืม)
- อยู่ใน tmux แล้วสลับ session → `tmux switch-client -t codex` (ไม่ใช่ attach)
- เปิด SSH ใหม่ → `codex` หรือ `dev` → เข้า session ได้เลย

### Webhook Path Collision Issue (เรียนรู้จาก T026)
- ก่อนสร้าง webhook ใหม่ ต้องตรวจว่า path ชนกับ main workflow ไหม
- ตรวจด้วย: query `workflow_history` แล้วหา nodes ที่ type=webhook และ path ตรงกัน

### HANDOFF.md Merge Conflict (recurring)
- agents/codex มัก conflict ที่ Sync Log section
- Fix: `git -C agents/codex checkout --theirs docs/collab/HANDOFF.md` แล้ว commit

---

## Commands To Run First (Next Session)

```bash
# เข้า session
dev

# ตรวจสถานะ
git log --oneline -5
cat docs/collab/HANDOFF.md | head -50

# ตรวจว่า Codex implement T027 แล้วหรือยัง
git fetch origin agents/codex
git log --oneline origin/agents/codex -5

# ถ้า Codex push มาแล้ว
git diff stable...origin/agents/codex --name-only
```
