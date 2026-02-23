# Forward Handoff — 2026-02-24 (ก่อนนอน)

## Where We Are
- Branch: `stable`
- Last commit: `707d676` docs(retro): session retrospective 2026-02-24-collab-tooling-sync-policy
- Phase: **Collab Tooling Complete** — OCR improve plan 100% done, ถัดไปคือ /ocr-feedback + CarbonReceipt integration

---

## What Was Accomplished This Session

- `27ac3ad` — สร้าง `/recap` + `/fyi` skills + Golden Rules 9 ข้อใน CLAUDE.md
- `2a17bd7` — แจ้ง Codex ผ่าน HANDOFF.md + sync
- `c78b584` — เพิ่ม Sync Policy: ทุก commit ต้อง sync ทันที
- `306926c → ef944bd` — ติดตั้ง `.git/hooks/post-commit` auto-sync ทุก commit (แก้ root cause: unset GIT env vars)
- `707d676` — บันทึก retrospective session นี้
- ติดตั้ง **tmux** config + `~/dev.sh` + alias `dev` ใน `.bashrc`
- รับ context `/ocr-feedback` + CarbonReceipt API (Postman collection) — วิเคราะห์ gap แล้ว ยังไม่ได้ implement

---

## Current State of Key Files

| ไฟล์ | สถานะ | หมายเหตุ |
|------|-------|---------|
| `.git/hooks/post-commit` | ✅ ติดตั้งแล้ว | auto-sync ทุก commit |
| `.claude/commands/recap.md` | ✅ ใหม่ | fresh-start orientation |
| `.claude/commands/fyi.md` | ✅ ใหม่ | quick memory log |
| `CLAUDE.md` | ✅ อัปเดต | Golden Rules + Sync Policy |
| `docs/collab/HANDOFF.md` | ✅ อัปเดต | Codex aware of all new policies |
| `~/.tmux.conf` | ✅ ใหม่ | mouse on, history 50k |
| `~/dev.sh` | ✅ ใหม่ | attach/create tmux session "dev" |
| `~/.bashrc` | ✅ อัปเดต | alias `dev` |

---

## What To Do Next (In Order)

1. **ออกแบบ `/ocr-feedback` endpoint ใน n8n** — ตาม contract ที่ Codex ออกแบบไว้ (payload, idempotency, 202 response, background queue)
2. **ตกลง Response format ของ `/ocr-dev`** กับ CarbonReceipt — เขาส่ง `{filename, content_type, file_base64}` มา เราจะตอบ JSON หน้าตาไหน?
3. **สร้าง Webhook Adapter ใน n8n** — รับ format CarbonReceipt (`/api/v1/documents/process-batch`) แล้ว transform เข้า OCR pipeline เดิม
4. **ถาม CarbonReceipt admin** เรื่อง: response format ที่คาดหวัง, `/ocr-feedback` endpoint ชื่ออะไรฝั่งเขา, Bearer token rotation policy
5. **เทรน OCR ด้วยบิลจริง** — user จะ upload บิลเข้าระบบ แล้วส่ง output ที่ผิดมาให้แก้

---

## Pending Tasks (จาก HANDOFF.md)

_(none formal)_ — ทำงานต่อจาก context นี้ได้เลย

---

## CarbonReceipt API Context (สำคัญ — อย่าลืม)

**API ที่ได้จาก admin:**
```
POST https://ai-api.manageai.co.th/oneclimat-poc/api/v1/documents/process-batch
Authorization: Bearer MAI-xxxx
Body: { filename, content_type, file_base64 }
```

**Gap ที่พบ:**
- URL path ต่างกัน (เขาใช้ `/api/v1/documents/process-batch`, เราใช้ `/webhook/ocr-dev`)
- Auth ต่างกัน (เขาใช้ Bearer token, เราใช้ Basic/API key)
- `/ocr-feedback` ยังไม่มีใน Postman ของเขา — ต้องออกแบบร่วมกัน
- ยังไม่รู้ response format ที่เขาคาดหวัง

**แนวทางที่แนะนำ:** Adapter Layer ใน n8n — รับ format เขา → transform → pipeline เดิม

---

## Uncommitted Changes

| ไฟล์ | สถานะ |
|------|-------|
| `code-node-enhanced.js` | M — modified แต่ไม่เกี่ยวกับงาน session นี้ |
| `docs/collab/HANDOFF.md` | M — sync log auto-append จาก sync.sh |
| `memory.md` | M — ไม่ใช่ MEMORY.md หลัก ไม่ต้อง commit |
| `workflow3.json`, `workflow_patch.json` | M — ไม่เกี่ยวกับงาน session นี้ |

ไม่มีอะไรต้อง commit เพิ่ม

---

## Context That Took Time To Build (Don't Lose)

1. **git post-commit hook + unset GIT env vars** — git inject `GIT_DIR`/`GIT_INDEX_FILE` เข้า hook environment ทำให้ `git -C agents/codex` งง ต้อง `unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_PREFIX` ต้นไฟล์ hook ก่อนทุกครั้ง
2. **tmux session "dev" รันอยู่แล้ว** — พรุ่งนี้ SSH มาแล้ว `dev` ได้เลย หรือ `tmux attach -t dev`
3. **CarbonReceipt API ยัง POC** — path มี "poc" อยู่ (`/oneclimat-poc/`) — production URL น่าจะต่างออกไป ต้องถามก่อน implement
4. **Codex aware ทุกอย่าง** — HANDOFF.md + CLAUDE.md sync แล้ว Codex เห็น Golden Rules, Sync Policy, skills ทั้งหมด

---

## Commands To Run First (session ถัดไป)

```bash
# 1. กลับเข้า tmux session
dev                          # หรือ tmux attach -t dev

# 2. ไปที่ project
cd ~/Project-Yterayut/N8N-AUTO-RESPONSE

# 3. ดูสถานะ
git log --oneline -5
./scripts/collab/status.sh

# 4. ถ้าได้ข้อมูลเพิ่มจาก CarbonReceipt admin แล้ว
# → เริ่มออกแบบ adapter layer + /ocr-feedback endpoint ใน n8n
```
