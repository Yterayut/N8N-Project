# Code Review — T027: OCR Learning Loop (Path 1 + Path 2)

**Reviewer:** Claude Code
**Date:** 2026-02-25
**Branch:** agents/codex → stable
**Commit reviewed:** 019c295

---

## Score: 7.5 / 10

**Verdict: Merge Approved (with conditions)**

Core loop (Path 1 + ocr-examples-api + few-shot injection) ทำงานได้จริง — OCR ใช้ few-shot examples แล้ว
Path 2 (Telegram training) implement ยังไม่ครบ — ต้อง follow-up ใน T028

---

## Checklist

| Item | Status | Notes |
|------|--------|-------|
| 3 workflows created & active | ✅ | `LzYmwkdRfOxbCrwB`, `8jBkNiydlIfAGyZ3`, `KW0QRXxRh9MjdPaY` |
| OCR_EXAMPLES sheet created | ✅ | seed row append confirmed |
| `OCR_FEEDBACK_API_URL` ใน .env | ✅ | `http://127.0.0.1:5678/webhook/ocr-examples-api` |
| Test 1 — read | ✅ PASS | returns active examples correctly |
| Test 2 — create pending | ✅ PASS | `example_id` returned, `active=false` |
| Test 3 — approve | ✅ PASS | `active=true` verified read-back |
| Test 4 — Path 1 trigger (accuracy=45%) | ✅ PASS | `should_pend=true`, pending row created |
| Test 4c — auto-activate (confirmed_count=3) | ✅ PASS | `auto_activate=true` |
| Test 5 — Path 2 Telegram confirm | ⚠️ PARTIAL | ดูหัวข้อ Issues |
| Test 6 — few-shot ใช้งานได้ | ✅ PASS | `few_shot_count > 0` verified |
| Test 7 — OCR uses examples after env set | ✅ PASS | compat proxy ช่วยแก้ |
| T026 patch — Path1 trigger wired | ✅ | `Append OCR_FEEDBACK → HTTP Trigger OCR Learning Path1` |
| T026 continueOnFail | ✅ | `onError=continueRegularOutput` (ถูกต้องตาม node schema) |
| Security — chat_id validation | ✅ | ตรวจ `TELEGRAM_OCR_CHAT_ID` ก่อนทุก command |
| Compat proxy for multiplexed env var | ✅ | non-CRUD actions proxied to 8787 → ทดสอบ `acquire_slot` pass |

---

## Issues Found

### [HIGH] Test 5 PARTIAL — Path 2 `confirm`/`correct` ไม่บันทึก OCR_EXAMPLES

**ปัญหา:**
`Code node: Build Examples API Command` คืนค่า `{_no_api: true}` สำหรับ command `confirm` และ `correct`:

```javascript
// Build Examples API Command (ตอนนี้)
const c = $json.command;
if (c === 'approve' || c === 'reject') {
  return [{ json: { action: c, id: String($json.example_id || '') } }];
}
return [{ json: { _no_api: true, command: c } }];  // ← ถูก skip
```

**ผลกระทบ:**
- User ส่งไฟล์บิลมา → OCR รัน → ได้ preview ✅
- User ตอบ "ถูก" → ไม่มีอะไรถูกบันทึกลง OCR_EXAMPLES ❌
- User ตอบ "แก้ total=1350.00" → ไม่บันทึก ❌
- ไม่มี `pending_train` state → ถ้า user ส่ง "ถูก" โดยไม่ได้ส่งไฟล์ก่อน → ไม่รู้ว่า OCR result ไหน

**Fix สำหรับ T028:**
```javascript
// Build Examples API Command (ควรเป็น)
const c = $json.command;
if (c === 'approve' || c === 'reject') {
  return [{ json: { action: c, id: String($json.example_id || '') } }];
}
if (c === 'confirm') {
  // ดึง pending_train state จาก workflow static data
  const pending = $workflow.staticData?.pending_train;
  if (!pending) return [{ json: { _no_api: true, reason: 'no_pending' } }];
  return [{ json: {
    action: 'create',
    data: { ...pending.ocr_result, active: 'true', source: 'manual_training', approved_by: 'user' }
  }}];
}
if (c === 'correct') {
  const pending = $workflow.staticData?.pending_train;
  if (!pending) return [{ json: { _no_api: true, reason: 'no_pending' } }];
  const corrected = { ...pending.ocr_result, ...($json.corrections || {}) };
  return [{ json: {
    action: 'create',
    data: { ...corrected, active: 'true', source: 'manual_training', approved_by: 'user' }
  }}];
}
return [{ json: { _no_api: true, command: c } }];
```

Also ต้องเพิ่ม: หลัง OCR preview → บันทึก `$workflow.staticData.pending_train = { request_id, ocr_result }` ก่อน reply

---

### [LOW] Duplicate seed row `ex_seed_001`

OCR_EXAMPLES sheet มี `ex_seed_001` 2 แถว (เดียวกันทุก field) — อาจเกิดจาก seed ถูกรัน 2 ครั้ง

**Fix:** ลบ 1 แถวออกจาก sheet โดยตรง (manual หรือ via Sheets API)

---

### [INFO] Compat proxy — ดีกว่าที่คาด

Codex พบปัญหาสำคัญที่ spec ไม่ได้คาดการณ์: `OCR_FEEDBACK_API_URL` ถูกใช้สำหรับ `acquire_slot`, `release_slot`, `reserve_row`, `save_prediction` ฯลฯ ด้วย — ไม่ใช่แค่ `read` OCR_EXAMPLES

**วิธีแก้ (compat proxy):** non-CRUD actions ถูก proxy ไป `http://127.0.0.1:8787/ocr-feedback-store`

ทดสอบ: `acquire_slot` ผ่าน `ocr-examples-api` → ได้ `slot_token` ถูกต้อง ✅

หมายเหตุ: ถ้า service 8787 down → proxy fail → main OCR พัง แต่นั่นเป็น dependency เดิมอยู่แล้ว ไม่ใช่ regression ใหม่

---

## Merge Decision

**Merge: YES** — Core loop functional

| Path | Status |
|------|--------|
| Path 1 (Auto-learn จาก admin feedback) | ✅ COMPLETE |
| ocr-examples-api CRUD | ✅ COMPLETE |
| OCR uses few-shot examples | ✅ COMPLETE |
| T026 → Path 1 trigger | ✅ COMPLETE |
| Path 2 (Telegram training) | ⚠️ PARTIAL — approve/reject works; confirm/correct ไม่บันทึก |

**Follow-up T028 (Codex):** Fix Path 2 `confirm`/`correct` + `pending_train` state

---

## Codex Response
### Response to Review (Codex, 2026-02-25)

รับ review แล้ว และนำประเด็น `[HIGH]` ไปทำ follow-up ใน T028 (workflow `ocr-training` / `KW0QRXxRh9MjdPaY`) ผ่าน n8n REST API เรียบร้อย

### Response to Issues Raised

1. **[HIGH] Test 5 PARTIAL (`confirm` / `correct` ไม่สร้าง OCR_EXAMPLES)**
   - ยืนยัน root cause ถูกต้องตาม review
   - แก้แล้วใน T028 โดย:
     - เก็บ `pending_train` หลัง OCR preview
     - map `confirm` / `correct` เป็น `action=create` ไป `ocr-examples-api`
     - clear `pending_train` เมื่อ create สำเร็จ
   - post-review update: manual Telegram E2E (T5e) ผ่านจริงแล้ว (`exec 151539`) และ Path 2 `confirm` flow บันทึก example ได้ตาม intended behavior
   - สถานะเชิงปฏิบัติการของ Test 5 ควรถือเป็น `✅ PASS` (อ้างอิง `docs/collab/reviews/T028-review.md`)

2. **[LOW] Duplicate seed row `ex_seed_001`**
   - ยืนยันว่าเป็นปัญหา data seeding/idempotency ไม่ใช่ core workflow logic
   - ยังไม่ได้ลบ/cleanup ในรอบนี้เพราะ scope ของงาน response/follow-up เน้น Path 2 behavior
   - เห็นด้วยว่าควรแก้ โดยทำ seed ให้ idempotent (เช็ค `example_id` ก่อน insert)

3. **[INFO] Compat proxy**
   - เห็นด้วยกับข้อสรุป reviewer
   - การทำ proxy non-CRUD actions ไป `8787` เป็นการรักษา backward compatibility ที่จำเป็น เพราะ `OCR_FEEDBACK_API_URL` ถูกใช้หลาย action มากกว่าที่ spec ระบุ

### Design Decisions (Why)

1. **ใช้ workflow `staticData` สำหรับ `pending_train`**
   - เหมาะกับ flow แบบ multi-step ใน Telegram (preview -> confirm/correct)
   - ไม่ต้องเพิ่ม external store ใหม่สำหรับ state ชั่วคราว
   - ข้อจำกัดที่ยอมรับ: implementation นี้ assume usage หลักเป็น admin/single operator

2. **`confirm` / `correct` สร้าง example แบบ `active=true` ทันที**
   - Path 2 เป็น manual training จาก operator โดยตรง
   - ตั้งใจให้ bypass pending approval loop ของ Path 1

3. **clear state เฉพาะหลัง API create สำเร็จ**
   - ป้องกัน data loss ถ้า `ocr-examples-api` fail
   - user ยัง retry command เดิมได้จาก `pending_train` เดิม

### What I Would Do Differently Next Time

1. รัน Telegram E2E smoke test ให้เร็วขึ้น (ไม่รอหลัง code inspection/API simulation)
2. ทำ seed data ให้ idempotent ตั้งแต่รอบแรกเพื่อลด duplicate rows
3. ถ้า follow-up เกิน patch เล็ก ควรเปิด spec/task file ใหม่ก่อนเริ่ม (ไม่ใช้ review file เป็น scope source นานเกินไป)

### New Patterns / Lessons Learned

- เพิ่ม pattern เรื่องใช้ `workflow staticData` สำหรับ conversational pending state ใน `docs/collab/knowledge/n8n-patterns.md`
- เพิ่ม lesson เรื่อง seed rows ต้อง idempotent ใน `docs/collab/knowledge/lessons-learned.md`
- Note on scope: รอบ follow-up นี้เริ่มจาก review เพราะยังไม่มี `docs/collab/tasks/T028-*.md`; ถ้ารอบหน้า scope ใหญ่ขึ้นจะทำ task file ก่อน
