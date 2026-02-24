# Forward Handoff — 2026-02-24 (session: role-redesign + T024 + feedback-system)

## Where We Are
- Branch: `stable`
- Last commit: `3a3b710 feat(collab): CC↔Codex feedback & knowledge exchange system`
- Phase: Post improve-plan — new features + collab system fully established

---

## What Was Accomplished This Session

- **Role Redesign** (`75fac26`)
  - CODEX.md (root + agents/codex): role → Executor (Async)
  - CLAUDE.md: เพิ่ม Agent Roles section
  - Codex CAN: patch n8n REST API, read/write SQLite, run bash scripts
  - Flow บังคับ: CC plan+spec → Codex execute → CC review+merge

- **T024 — Google Drive Save (fast/standard path)** (`c0e1e0e`)
  - Codex implement: เพิ่ม `Google Drive (Upload - Direct)` + `Code (Merge Drive Result)` nodes
  - Connection: SLA Lane → GDrive → Merge → HTTP Upload File5
  - OCR_RAW4: เพิ่ม `drive_file_id` column
  - Respond to Webhook6: `drive_file_id` อยู่ใน response body แล้ว
  - Filename format: `yyyy-MM_request_id.ext` (CC fix `YYYY`→`yyyy` — ผิด flow แต่ทำไปแล้ว)
  - Verified live: `drive_file_id: 1H6D1exbytd_9rX0bpgUqm8R8zGkvbCgA`

- **CC↔Codex Feedback System** (`3a3b710`)
  - `docs/collab/knowledge/n8n-patterns.md` — 7 patterns seeded
  - `docs/collab/knowledge/lessons-learned.md` — 5 lessons seeded
  - `docs/collab/reviews/T024-review.md` — first code review (score 8/10)
  - `docs/collab/reviews/_TEMPLATE.md` — template สำหรับ review ถัดไป
  - Protocol เพิ่มใน CLAUDE.md + CODEX.md

---

## Current State of Key Files

| File | Status | หมายเหตุ |
|------|--------|---------|
| `docs/collab/reviews/T024-review.md` | ✅ committed | รอ Codex fill `## Codex Response` |
| `docs/collab/knowledge/n8n-patterns.md` | ✅ committed | 7 patterns — Codex เพิ่มได้ |
| `docs/collab/knowledge/lessons-learned.md` | ✅ committed | 5 lessons — Codex เพิ่มได้ |
| `CLAUDE.md` | ✅ committed | มี Feedback Protocol + Agent Roles |
| `CODEX.md` | ✅ committed | มี Feedback Protocol + role ใหม่ |
| `docs/collab/HANDOFF.md` | M (uncommitted) | sync log update เล็กน้อย |
| `code-node-enhanced.js` | M | ไม่เกี่ยวกับงาน session นี้ |
| `workflow3.json`, `workflow_patch.json` | M | ไม่เกี่ยวกับงาน — ไม่ต้อง commit |

---

## What To Do Next (In Order)

### 1. รอ Codex respond T024 review
Codex ต้อง fill `## Codex Response` ใน `docs/collab/reviews/T024-review.md`
และอาจเพิ่ม patterns/lessons ใน knowledge base

### 2. เมื่อ Codex push → CC review + merge
ตรวจ `reviews/T024-review.md` ว่า Codex response ครบหรือไม่
ตรวจ knowledge base ว่า Codex เพิ่มอะไรใหม่

### 3. ตัดสินใจ: CarbonReceipt Integration
API POC มีแล้ว: `POST https://ai-api.manageai.co.th/oneclimat-poc/api/v1/documents/process-batch`
ต้องออกแบบ Adapter Layer ใน n8n รับ format เขา → transform → OCR pipeline เดิม
ยังไม่มี `/ocr-feedback` endpoint ในฝั่ง CarbonReceipt — ต้องหารือกับ admin ก่อน

### 4. Regression Test — Drive fail scenario
T024 ยังขาด test:
- Drive quota หมด → `drive_file_id = 'UPLOAD_FAILED'` แต่ OCR success
- Invalid credential ชั่วคราว → OCR ยัง return response ปกติ

---

## Pending Tasks

| ID | Task | Owner | สถานะ |
|----|------|-------|-------|
| T024-review | Codex respond to code review | Codex | รอ Codex |
| T025 (proposed) | Drive fail regression tests | Codex execute | ยังไม่มี spec |
| — | CarbonReceipt adapter layer | รอหารือ admin | ยังไม่เริ่ม |

---

## Uncommitted Changes (ที่สำคัญ)

| File | ควรทำอะไร |
|------|----------|
| `docs/collab/HANDOFF.md` | commit ได้เลย (sync log เล็กน้อย) |
| `code-node-enhanced.js` | ตรวจก่อน — ไม่แน่ใจว่าแก้อะไร |
| `workflow3.json`, `workflow_patch.json` | ไม่ต้อง commit — ไม่เกี่ยวงาน |

---

## Context That Took Time To Build (Don't Lose)

### Flow บังคับ CC ↔ Codex
```
CC plan+spec → Codex execute → CC review+merge
```
- **CC execute เองได้เฉพาะเมื่อ user สั่งโดยตรงเท่านั้น**
- ถ้า CC พบ bug → เขียน spec → assign Codex → ห้าม patch เอง

### Feedback Protocol (ใหม่ session นี้)
- Pre: Codex comment ใน `## Discussion` ของ spec ถ้าเห็น issue
- Post: CC เขียน review ที่ `docs/collab/reviews/T0xx-review.md` ทุกครั้ง
- Codex ต้อง fill `## Codex Response` + เพิ่ม knowledge base

### T024 Technical Notes
- Workflow `up1n75qEhbsXswii` มี 111 nodes แล้ว (เพิ่มจาก 109)
- `drive_file_id` อยู่ใน: OCR_RAW4 sheet + Respond to Webhook6 response body
- Binary field fast path = `files0`, heavy path = `file`
- filename format = `yyyy-MM_request_id.ext` ใน folder `Upload_Carbonrecipt`

### Luxon Token Bug (เพิ่งเจอ)
- `YYYY` = ISO week-based year (ผิด) → ได้ literal "YYYY"
- `yyyy` = calendar year (ถูก) → ได้ "2026"

### n8n API Key
- `OCR_SHARED_API_KEY=ocm-cabonrecipte!`
- webhook path: `/webhook/ocr-dev`
- PATCH endpoint: `PATCH /rest/workflows/up1n75qEhbsXswii`
- Cookie: `curl -c /tmp/n8n-cookie.txt -X POST /rest/login`

---

## Commands To Run First (Next Session)

```bash
# เข้า session
dev

# ตรวจสถานะ
git log --oneline -5
cat docs/collab/HANDOFF.md | head -40

# ตรวจว่า Codex respond T024 review แล้วหรือยัง
cat docs/collab/reviews/T024-review.md | grep -A 20 "Codex Response"

# ถ้า Codex push มาแล้ว
git fetch origin agents/codex
git log --oneline origin/agents/codex -5
```
