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
### T028 Follow-up Completed (Codex, 2026-02-25)

รับ review แล้ว และ patch ประเด็น `[HIGH]` ของ Path 2 ใน workflow `ocr-training` (`KW0QRXxRh9MjdPaY`) ผ่าน n8n REST API เรียบร้อย

#### สิ่งที่แก้จริง
1. **Store `pending_train` state หลัง OCR preview**
   - patch `Code node: Build OCR Preview Reply`
   - เก็บ `pending_train` ลง workflow static data (`global`) พร้อม:
     - `request_id`, `document_id`, `doc_type`
     - `drive_file_id`
     - `ocr_response`
     - `ocr_result` (payload base สำหรับ `ocr-examples-api`)

2. **รองรับ command `confirm` / `correct` ให้สร้าง example จริง**
   - patch `Code node: Build Examples API Command`
   - ถ้า `confirm` / `correct`:
     - โหลด `pending_train`
     - สร้าง `action=create`
     - `active=true`, `source=manual_training`, `approved_by=user`
     - ใช้ OCR bills จาก pending เป็น `gold_json`
     - `correct` รองรับแก้ field หลักบน bill แรก และ `item_*` (line item แรก)

3. **Clear `pending_train` หลัง create สำเร็จ**
   - patch `Code node: Build Command Reply`
   - เมื่อ `confirm/correct` + `ocr-examples-api` ตอบ `ok=true`:
     - `delete staticData.pending_train`
     - ตอบ Telegram ว่า `✅ บันทึก example สำเร็จ (...)`

#### Verification (Codex)
- patch applied via `/rest/workflows/KW0QRXxRh9MjdPaY` และ re-fetch ตรวจ node code แล้ว
- ตรวจ token สำคัญใน code ครบ:
  - `pending_train` store
  - `confirm/correct` -> `action:'create'`
  - `delete staticData.pending_train`
- รัน `./scripts/verify_nowThai_sync.sh` ผ่าน (ตาม golden rule)

#### Remaining limitation (still true)
- ยังไม่ได้รัน **manual Telegram end-to-end** (ส่งไฟล์ → OCR preview → พิมพ์ `ถูก` / `แก้ ...`) ใน session นี้
- ดังนั้น Test 5 จาก T027 review ควรยกระดับจาก `PARTIAL` เป็น **Implemented + pending manual verification**

#### Note on Scope
- ไม่มีไฟล์ spec `T028` ใน `docs/collab/tasks/` ตอนเริ่มงานนี้
- ใช้ `docs/collab/reviews/T027-review.md` เป็น fallback scope source สำหรับ follow-up patch ตามข้อ `[HIGH]`
