# Session Retrospective — 2026-02-25
**Slug:** `ocr-feedback-kpi`
**Theme:** T026 — OCR Feedback Receiver + KPI Accuracy System

---

## 1. Git Summary

| Commit | Message | ทำอะไร |
|--------|---------|--------|
| `b990aec` | feat(collab): T026 spec | CC เขียน spec T026 ครบ + assign Codex |
| `2446355` | feat(ocr): T026 feedback receiver + KPI | Codex implement + test 5 cases |
| `59c6574` | chore(review): T026 code review 8.5/10 | CC เขียน review + approve merge |
| `5c8ef9a` | feat(T026): merge Codex | Merge agents/codex → stable |
| `951cdff` | chore: resolve HANDOFF conflict | แก้ merge conflict หลัง sync |

---

## 2. Tasks Completed

### T026 — OCR Feedback Receiver + KPI System

**ปัญหาที่แก้:** ไม่มีระบบวัดว่า OCR อ่านถูกต้องกี่ % — ไม่รู้ว่า field ไหนผิดบ่อย หรือ vendor ไหนอ่านแม่นน้อย

**สิ่งที่สร้าง:**
- Workflow `ocr-feedback-receiver` (ID: `ztJ8oCBHREUPPry6`) — webhook `/ocr-feedback-kpi`
- Workflow `ocr-kpi-report` (ID: `yCqvdl3vrHGgiBMt`) — daily KPI report 08:00
- Google Sheet `OCR_FEEDBACK` (gid: `1589922285`) — เก็บ diff + accuracy per bill

**Impact:**
- ระบบตอนนี้วัด accuracy % ได้แบบ real-time
- แยก doc_type (fuel/electricity/water) และ vendor (PTT/OR, Bangchak, PT, Shell...)
- แยก field accuracy (vendor_tax_id / invoice_number / invoice_date / total)
- Telegram notify ทุกครั้งที่รับ feedback + daily KPI report

---

## 3. Decisions Made

### D1: ไม่เพิ่ม GLM-4 เป็น peer agent
- **ตัดสินใจ:** ไม่เพิ่มตอนนี้
- **เหตุผล:** Codex ยังไม่เป็น bottleneck, GLM-4 ไม่มี unique capability ที่ Codex ทำไม่ได้, complexity เพิ่มแบบ exponential (3 agents = 3 sync paths)
- **ทางเลือกที่ reject:** GLM-4 เป็น model ใน n8n node (OCR pre-classify) — อาจกลับมาทำถ้า cost สูง

### D2: Endpoint path `/ocr-feedback-kpi` (ไม่ใช่ `/ocr-feedback`)
- **ตัดสินใจ:** ใช้ path ใหม่แทน spec เดิม
- **เหตุผล:** Main workflow มี `Webhook_OCR_Feedback → path: ocr-feedback` อยู่แล้ว — ถ้าชนกัน request จะวิ่งผิด workflow
- **Action required:** แจ้ง admin CarbonReceipt ใช้ endpoint ใหม่

### D3: KPI fields ที่วัด = 4 fields หลัก
- vendor_tax_id, invoice_number, invoice_date_th, total
- ไม่รวม list_detail items (ซับซ้อน/array เปรียบเทียบยาก)
- total ใช้ tolerance ±0.05 (ไม่ใช่ exact match)

### D4: Vendor classification ใช้ text matching + tax_id prefix
- ไม่ hardcode tax_id เต็ม — ใช้ `startsWith` + keyword matching
- ง่ายกว่า lookup table, เพิ่ม vendor ใหม่ได้ใน Code node

---

## 4. Issues Found / Deferred

| Issue | Severity | เหตุผลที่ defer | Next action |
|-------|----------|----------------|-------------|
| `Webhook_OCR_Feedback` ใน main workflow — ทำอะไร? | Medium | ไม่กระทบ production ตอนนี้ แต่ path ชนกัน | CC ต้องตรวจว่า node นี้ enabled/disabled + ทำอะไร |
| Tmp workflows 2 ตัวยังอยู่ใน n8n | Low | Inactive ไม่กระทบ | Delete `HxquPx1lKdWReSFY` + `siAYUa8Vawvj3CDJ` |
| OCR_FEEDBACK header order ไม่ตรง spec | Low | ไม่กระทบ function | ปล่อยไว้ก่อน |
| CarbonReceipt admin ยังไม่ได้รับแจ้ง endpoint ใหม่ | High | รอ user ส่ง LINE | ส่ง LINE แจ้ง admin ด้วย endpoint `/ocr-feedback-kpi` |
| T024-review.md — Codex ยัง fill `## Codex Response` ไม่ครบ | Low | ข้ามมาทำ T026 | ถ้า Codex ว่าง ให้ fill T024 review ด้วย |

---

## 5. What Went Well / What Was Hard

### ✅ ไปได้ดี
- **Spec เขียนครั้งเดียวแล้ว Codex implement ได้เลย** — ไม่ต้องถาม-ตอบ iteration หลายรอบ
- **Codex ค้นพบ path collision เอง** — พิสูจน์ว่า Codex อ่าน spec ละเอียดและตรวจ environment ก่อน implement
- **Flow ชัดเจน:** CC plan → spec → Codex execute → CC review → merge ทำงานได้ตามที่ออกแบบ
- **Live test ผ่านทั้งหมด** — ทดสอบ endpoint จริงได้เลย ไม่มี debug cycle

### ⚠️ ยากกว่าที่คิด
- **Merge conflict ซ้อน** — sync hook trigger หลาย round ทำให้ agents/codex worktree มี unmerged files ต้องแก้มือ
- **tmux nested session** — user ติด tmux ซ้อน tmux ต้องใช้ `switch-client` แทน `attach`
- **tmux switch-client ไม่ทำงานผ่าน Claude Code bash** — ต้องทำจาก SSH terminal โดยตรง

---

## 6. Memory Update

อัปเดต MEMORY.md:
- CarbonReceipt Integration section → T026 เสร็จแล้ว
- เพิ่ม T026 workflow IDs + endpoint
- เพิ่ม PATTERN-008 (webhookId)
- เพิ่ม tmux note

---

## 7. One-Line Session Summary

T026 OCR feedback receiver + KPI system ออกแบบ implement ทดสอบ merge เสร็จในรอบเดียว — ระบบตอนนี้วัด accuracy % ได้แยก doc_type/vendor/field แบบ real-time

---

## 8. Next Session Priorities

1. **แจ้ง admin CarbonReceipt** endpoint `/ocr-feedback-kpi` (ถ้ายังไม่ได้ส่ง LINE)
2. **ตรวจ `Webhook_OCR_Feedback`** ใน main workflow — node นี้ทำอะไร enabled/disabled
3. **Delete tmp workflows** `HxquPx1lKdWReSFY` + `siAYUa8Vawvj3CDJ`
4. **รอ KPI จริง** เมื่อ admin เริ่มส่ง feedback มา — ดูว่า accuracy % เป็นอย่างไร
