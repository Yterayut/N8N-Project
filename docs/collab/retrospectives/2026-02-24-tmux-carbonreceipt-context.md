# Session Retrospective — 2026-02-24 (tmux-carbonreceipt-context)

> Mini-session หลังจาก retro ก่อนหน้า (707d676)

---

## 1. Git Summary

| Commit | Message | ทำอะไร |
|--------|---------|--------|
| `07ecb7c` | chore(forward): session handoff 2026-02-24 | บันทึก FORWARD.md + อัปเดต HANDOFF.md |
| `7ddb36b` | chore(collab): notify Codex — tmux session 'codex' ready | แจ้ง Codex ว่า tmux sessions พร้อมแล้ว |

---

## 2. Tasks Completed

### tmux setup สมบูรณ์ (dev + codex)
- **ปัญหา:** VPN หลุด → SSH ตาย → session หาย → ทำงานต่อไม่ได้
- **แก้:**
  - `~/.tmux.conf` — mouse on, history 50k, status bar
  - `~/dev.sh` + alias `dev` → session "dev" ที่ `N8N-AUTO-RESPONSE/`
  - `~/codex.sh` + alias `codex` → session "codex" ที่ `agents/codex/`
- **ทดสอบแล้ว:** รัน `pwd` + `git branch` ใน session ทั้ง 2 — ถูกต้อง
- **ผล:** VPN หลุดแล้ว SSH ใหม่ → `dev` หรือ `codex` → กลับมาตรงที่ค้าง

### CarbonReceipt API วิเคราะห์แล้ว
- **ได้รับ:** Postman collection จาก CarbonReceipt admin
- **endpoint:** `POST /api/v1/documents/process-batch` body `{filename, content_type, file_base64}` + Bearer token
- **Gap analysis เสร็จ:** URL ต่าง, auth ต่าง, ไม่มี `/ocr-feedback` ฝั่งเขา, ไม่รู้ response format
- **แนวทาง:** Adapter Layer ใน n8n
- **ยังไม่ implement** — รอข้อมูลเพิ่มจาก admin

---

## 3. Decisions Made

### Codex = OpenAI GPT (ไม่ใช่ Claude)
- **ชี้แจง:** ก่อนหน้านี้เข้าใจผิดว่า Codex = Claude instance ที่ 2
- **จริงๆ:** Codex = OpenAI GPT ที่ทำงานบน `agents/codex` branch จริงๆ (ทำ T002, T006, T014, T020)
- **ผล:** Architecture เป็น 2 AI คนละค่าย collaborate ผ่าน git — ยังใช้งานได้เหมือนเดิม

### Terminal-only workflow (ไม่ต้อง VSCode)
- **ตัดสินใจ:** ใช้แค่ Terminal + SSH + tmux — ไม่ต้อง VSCode
- **เหตุผล:** งานหลักคือ Claude Code (CLI) + n8n (web) — VSCode ไม่ได้เพิ่ม value
- **ประหยัด:** เปิดเร็วกว่า, RAM น้อยกว่า, reconnect ง่ายกว่า

---

## 4. Issues Found / Deferred

### CarbonReceipt API ยังไม่ครบ
- **severity:** medium
- **รายละเอียด:** ยังไม่รู้ response format ที่เขาคาดหวัง, `/ocr-feedback` ฝั่งเขายังไม่มี, Bearer token rotation policy ไม่รู้
- **defer:** รอคุยกับ admin รอบถัดไป
- **next action:** ถาม 4 ข้อที่ระบุใน FORWARD.md

### tmux sessions ไม่ persistent หลัง server reboot
- **severity:** low
- **รายละเอียด:** ถ้า server reboot, tmux sessions หาย — ต้องสร้างใหม่ด้วย `dev` / `codex`
- **defer:** ยอมรับได้ server ไม่ค่อย reboot
- **next action:** ถ้าต้องการ auto-start ค่อยเพิ่ม systemd unit หรือ `~/.profile`

---

## 5. What Went Well / What Was Hard

### ดี
- tmux setup ทดสอบผ่านง่ายมาก — ไม่มีปัญหา
- CarbonReceipt API วิเคราะห์ gap ได้รวดเร็ว เห็น bottleneck ชัด
- การแก้ความเข้าใจเรื่อง Codex = OpenAI (ไม่ใช่ Claude) — ทำให้ architecture ชัดขึ้น

### ยาก / น่าสังเกต
- เดิมเข้าใจผิดว่า Codex = Claude instance ที่ 2 ทำให้ตอบผิดไป 1 รอบ — ควรถามก่อนสรุป
- CarbonReceipt Postman collection มี JSON body ที่ truncated (`file_base64` ไม่สมบูรณ์) — ต้องระวัง

---

## 6. Memory Update

MEMORY.md อัปเดตแล้วใน session ก่อนหน้า — เพิ่มแค่ข้อมูล codex session:

---

## 7. One-Line Session Summary

ติดตั้ง tmux 2 sessions (dev/codex) ให้ทำงานรอด VPN หลุด, วิเคราะห์ CarbonReceipt API gap, และชี้แจงว่า Codex = OpenAI GPT ไม่ใช่ Claude
