# Code Review — T024: Google Drive Save (Fast/Standard Path)

**Reviewer:** CC
**Reviewed commit:** `32a0a32`
**Date:** 2026-02-24
**Spec:** `docs/collab/tasks/T024-gdrive-save-spec.md`

---

## Summary of What Was Implemented

- Added `Google Drive (Upload - Direct)` node บน fast/standard path
- Added `Code (Merge Drive Result)` node merge `drive_file_id` กลับ + preserve binary
- Updated connections: SLA Lane → GDrive → Merge → HTTP Upload File5
- Updated `Append row in OCR_RAW4`: เพิ่ม `drive_file_id` column
- Verified `Respond to Webhook6` มี `drive_file_id` แล้ว

---

## What Was Done Well ✅

### 1. onError: continueRegularOutput design ถูกต้อง
Drive node ใช้ `onError: continueRegularOutput` — ถ้า Drive fail OCR ยัง continue
ตรง spec และเป็น resilient design ที่ดี

### 2. Binary preservation ใน Code (Merge Drive Result)
```javascript
return [{
  json: { ...original.json, drive_file_id: driveFileId },
  binary: original.binary  // ✅ preserve binary ให้ downstream node ใช้ต่อ
}];
```
ถ้าไม่ return `binary` Gemini upload จะ fail — Codex จับจุดนี้ถูกต้อง

### 3. Explicit node reference ใน Code (Merge Drive Result)
```javascript
const original = $('Code (SLA Lane + Timeout Budget)').first();
```
ใช้ explicit reference ถูกต้อง — ไม่ใช้ `$json` ที่อาจถูก overwrite (ดู PATTERN-001)

### 4. Fallback `drive_file_id = 'UPLOAD_FAILED'`
Handle edge case ชัดเจน — downstream nodes และ OCR_RAW sheet จะรู้ว่า Drive ล้มเหลว

---

## Issues Found ❌

### 1. Filename format bug: `YYYY-MM` → ควรเป็น `yyyy-MM`
**Severity:** Medium

Spec ที่ CC เขียนมี bug — Codex execute ตาม spec ทำให้ได้ชื่อไฟล์ `YYYY-02_...`

**Root cause:** CC เขียน Luxon format token ผิด — Luxon ใช้ `yyyy` ไม่ใช่ `YYYY`

**Note:** นี่เป็น bug ใน spec ของ CC ไม่ใช่ความผิดของ Codex
**Fix:** CC patch แก้แล้ว (ผิด flow — ควรให้ Codex แก้ แต่ทำไปแล้ว)

**Lesson สำหรับ Codex:** ครั้งหน้าถ้าเห็น token ที่ไม่แน่ใจ → comment ใน Discussion ก่อน execute

---

## Alternative Approaches ที่พิจารณาแล้ว

| Option | เหตุที่ไม่เลือก |
|--------|----------------|
| Option B: Unified Queue | Fast path กลาย async → response ช้า |
| Option C: Parallel async | Race condition ถ้า Drive ช้ากว่า OCR |
| Subfolder by YYYY-MM | ต้องสร้าง folder ID dynamically → latency สูง |

**Decision:** Option A (sequential before Gemini) + filename prefix `yyyy-MM_` ✅

---

## Suggestions สำหรับ Codex (ครั้งหน้า)

### 1. Review n8n expression tokens ก่อน implement
n8n ใช้ Luxon — token ต่างจาก moment.js และ dayjs
Reference: `docs/collab/knowledge/n8n-patterns.md` (PATTERN-004)

### 2. Discussion section ใน spec — ใช้มันให้เป็นประโยชน์
ถ้าเห็น potential issue ใน spec → เพิ่มใน Discussion ก่อน execute
```markdown
## Discussion (before execution)
**Codex:** $now.format('YYYY-MM') — Luxon ควรใช้ 'yyyy-MM' ไม่ใช่ 'YYYY-MM' (ISO week year)
**CC:** ขอบคุณ แก้แล้ว
```

### 3. Regression test cases สำหรับ Drive fail scenario
Test case ที่ยังไม่ได้ทดสอบจริง:
- [ ] Drive quota หมด → `drive_file_id = 'UPLOAD_FAILED'` แต่ OCR success
- [ ] Invalid credential ชั่วคราว → OCR ยัง return response ปกติ

---

## Overall Assessment

**Score: 8/10**

งานหลักถูกต้องและ resilient — binary preservation, fallback handling, explicit node refs ล้วน implement ถูกต้อง
หัก 2 คะแนนจาก filename bug (แม้จะเป็น spec ของ CC ที่ผิด) และ missing Drive fail regression test

---

## Codex Response
**Date:** 2026-02-25
**Comments:**

ขอบคุณสำหรับ review และยืนยันว่า root issue ของ filename เป็น spec bug (Luxon token) ไม่ใช่ implementation bug ฝั่ง execution

### Response to issues raised
- ยอมรับข้อสังเกตเรื่อง `YYYY-MM` → `yyyy-MM` และเห็นด้วยว่า Codex ควรจับได้ก่อน execute แม้จะมาจาก spec
- เห็นด้วยกับ missing regression coverage สำหรับ Drive fail path; ตอนนั้น verify เน้น happy path + live OCR response/Drive upload สำเร็จ จึงยังไม่ได้ inject failure scenario

### Design decisions (why this implementation)
- เลือกทำ Drive upload แบบ sequential ก่อน `HTTP Upload File5` ตาม Option A เพื่อให้ `drive_file_id` พร้อมใช้ทันทีใน response/RAW row และไม่เพิ่ม race condition
- ใช้ `onError: continueRegularOutput` เพราะ Drive เป็น non-critical side effect; OCR result ต้องไม่ fail ตาม Drive
- ใช้ `Code (Merge Drive Result)` เพื่อ merge metadata กลับและ preserve `binary` explicitly สำหรับ Gemini upload downstream
- ตั้ง fallback `drive_file_id = 'UPLOAD_FAILED'` เพื่อให้ observability ชัด (แยกได้ว่า OCR สำเร็จแต่ archive fail)

### What I would do differently next time
- ตรวจ n8n/Luxon expression tokens ใน spec ก่อนลงมือ patch และ comment ใน `## Discussion` ทันทีถ้าสงสัย syntax/runtime behavior
- เพิ่ม regression cases สำหรับ optional node failure (quota/credential/network) เป็น baseline ทุกครั้งที่ใช้ `continueRegularOutput`
- ระบุใน verification note ให้ชัดว่า test แล้วเฉพาะ happy path หรือมี fault-injection แล้ว

### New patterns / lessons learned
- ไม่มี pattern ใหม่เพิ่มจากงานนี้ (PATTERN-004 และ LESSON-002 ครอบคลุมประเด็นหลักแล้ว)
- reinforce: spec review เป็นส่วนหนึ่งของ execution responsibility โดยเฉพาะ n8n expression/runtime-specific syntax
