# Forward Handoff — 2026-02-24 (session end / ก่อนนอน)

## Where We Are
- Branch: `stable`
- Last commit: `db1ce7e` docs(retro): session retrospective 2026-02-24-tmux-carbonreceipt-context
- Phase: **Dev Environment Complete + CarbonReceipt API analyzed — รอ implement**

---

## What Was Accomplished This Session (ทั้ง session วันนี้)

### Collab Tooling (commits 27ac3ad → ef944bd)
- ✅ `/recap` + `/fyi` skills สร้างแล้ว
- ✅ Golden Rules 9 ข้อ เพิ่มใน CLAUDE.md
- ✅ Sync Policy — ทุก commit ต้อง sync ทันที
- ✅ `.git/hooks/post-commit` auto-sync ทุก commit (แก้ root cause: unset GIT env vars)

### Dev Environment / tmux (ไม่มี commit แยก — ทำใน session)
- ✅ `~/.tmux.conf` — mouse on, history 50k
- ✅ `~/dev.sh` + alias `dev` → tmux session "dev" (stable branch)
- ✅ `~/codex.sh` + alias `codex` → tmux session "codex" (agents/codex branch)
- ✅ ทดสอบผ่านทั้ง 2 sessions — pwd + git branch ถูกต้อง

### CarbonReceipt API
- ✅ วิเคราะห์ Postman collection ที่ admin ส่งมา
- ✅ Gap analysis เสร็จ (URL, auth, response format, ไม่มี /ocr-feedback)
- ⏳ ยังไม่ implement — รอข้อมูลเพิ่ม

### Architecture Clarification
- ✅ ยืนยัน: Codex = OpenAI GPT (ไม่ใช่ Claude) ทำงานบน agents/codex branch จริงๆ

---

## Current State of Key Files

| ไฟล์ | สถานะ | หมายเหตุ |
|------|-------|---------|
| `.git/hooks/post-commit` | ✅ active | auto-sync ทุก commit |
| `~/.tmux.conf` | ✅ active | mouse on, history 50k |
| `~/dev.sh` + `~/codex.sh` | ✅ active | tmux session scripts |
| `~/.bashrc` | ✅ active | alias dev + codex |
| `.claude/commands/` | ✅ active | recap, fyi, rrr, forward |
| `CLAUDE.md` | ✅ active | Golden Rules + Sync Policy |
| `docs/collab/HANDOFF.md` | ✅ synced | Codex รับข้อมูลแล้ว |

---

## What To Do Next (In Order)

1. **ถาม CarbonReceipt admin 4 ข้อ** (ก่อน implement ทุกอย่าง):
   - Response JSON format ที่คาดหวังจาก `/ocr-dev` หน้าตาแบบไหน?
   - `/ocr-feedback` ฝั่งเขาจะ call endpoint ชื่ออะไร? หรือเขารอเราออกแบบ?
   - Bearer token rotation ทำยังไง? มีระบบออก token หรือ static?
   - `process-batch` = ส่งหลายไฟล์พร้อมกันได้ไหม หรือชื่อแค่ batch?

2. **สร้าง Webhook Adapter ใน n8n** — รับ format CarbonReceipt → transform → OCR pipeline เดิม:
   ```
   POST /webhook/carbonreceipt-ocr  (path ใหม่)
   รับ: { filename, content_type, file_base64 }
   transform → เรียก OCR pipeline เดิม
   ตอบ: JSON format ที่ตกลงกัน
   ```

3. **สร้าง `/ocr-feedback` endpoint ใน n8n** — ตาม contract ที่ Codex ออกแบบไว้:
   - รับ `ocr_json_before` + `admin_json_after`
   - ตอบ `202 Accepted`
   - เก็บลง queue สำหรับ background learning

4. **เทรน OCR ด้วยบิลจริง** — user จะ upload บิล แล้วส่ง output ที่ผิดมาแก้

---

## Pending Tasks (จาก HANDOFF.md)
_(none formal)_

---

## Uncommitted Changes

| ไฟล์ | สถานะ | ทำไม |
|------|-------|------|
| `code-node-enhanced.js` | M | ไม่เกี่ยวกับงาน session นี้ |
| `docs/collab/HANDOFF.md` | M | sync log auto-append (ปกติ) |
| `memory.md` | M | ไม่ใช่ MEMORY.md หลัก |
| `workflow3.json`, `workflow_patch.json` | M | ไม่เกี่ยวกับงาน session นี้ |

ไม่ต้อง commit เพิ่ม

---

## Context That Took Time To Build (Don't Lose)

1. **Codex = OpenAI GPT จริงๆ** — ไม่ใช่ Claude instance ที่ 2 ทั้ง 2 AI คนละค่าย collaborate ผ่าน git files เท่านั้น ไม่มีช่องทางอื่น
2. **CarbonReceipt API ยัง POC** — path มี `/oneclimat-poc/` production URL น่าจะต่าง ต้องถาม
3. **tmux sessions ไม่ persistent หลัง server reboot** — ถ้า server reboot ต้องรัน `dev` และ `codex` ใหม่ (scripts จะสร้าง session ใหม่ให้อัตโนมัติ)
4. **post-commit hook ไม่ถูก git track** — อยู่ใน `.git/hooks/` ถ้า clone ใหม่ต้องติดตั้งใหม่ (ดู `.git/hooks/post-commit`)
5. **Bearer token ใน Postman** — `MAI-tfCNjlqNVFYB64Pn8OsJIgU1ZbM7LGyJwK3gGENY1P9h04o7fr4g7gl8SNLDNKoB` อาจเป็น dev/test token — ห้าม commit

---

## Commands To Run First (session ถัดไป)

```bash
# 1. SSH + เข้า tmux
dev                    # หรือ tmux attach -t dev

# 2. ตรวจสถานะ
git log --oneline -5
tmux ls                # ตรวจว่า sessions ยังอยู่

# 3. อ่าน context
/recap                 # Claude สรุปให้ทันที

# 4. ถ้าได้ข้อมูลจาก CarbonReceipt admin แล้ว
# → เริ่มออกแบบ Webhook Adapter ใน n8n
# → เริ่มออกแบบ /ocr-feedback endpoint
```
