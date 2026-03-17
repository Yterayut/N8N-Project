# PAY Smoke Test Checklist

## วัตถุประสงค์
ใช้เป็น checklist สั้นสำหรับทดสอบเส้นหลักของ PAY หลังแก้ backend, workflow, หรือ app consumer

## Pre-check
- ยืนยัน Apps Script deployment URL ที่ live ใช้จริง
- ยืนยัน n8n workflow live ID และ webhook path
- ยืนยัน mobile/web app endpoint ที่ใช้ตรงกับ manifest
- ถ้าต้องการรันอัตโนมัติ ใช้:
  - `scripts/pay/smoke_pay_runtime.sh`
  - หรือ `PAY_SMOKE_ADD=1 scripts/pay/smoke_pay_runtime.sh`

## Smoke Tests

### 1. New slip -> save success
ขั้นตอน:
1. ส่งสลิปใหม่ที่ไม่เคยมี `ref_id`
2. เปิด n8n execution
3. ตรวจ Google Sheet

Expected:
- Apps Script response: `status = ok`
- มี row ใหม่ใน `Sheet1`
- มี `transaction_id`
- `status = active`
- LINE ตอบสำเร็จ

### 2. Duplicate slip -> duplicate response
ขั้นตอน:
1. ส่งสลิปเดิมซ้ำ
2. เปิด execution
3. ตรวจ response จาก Apps Script

Expected:
- `status = duplicate`
- มี `matched_row_index`
- ไม่มี row ใหม่ถูก append
- LINE ตอบ duplicate ไม่ใช่ข้อความ error อื่น

### 3. Unauthorized request
ขั้นตอน:
1. ยิง request ด้วย `api_key` ผิด

Expected:
- `status = unauthorized`
- ไม่มี row ใหม่
- ห้ามตอบ duplicate

### 4. Validation error
ขั้นตอน:
1. ยิง payload ที่ไม่มี field สำคัญ เช่น `amount` หรือ `date`

Expected:
- `status = validation_error`
- ไม่มี row ใหม่
- ห้ามตอบ duplicate

### 5. Search by ref_id
ขั้นตอน:
1. ใช้ `ref_id` จากรายการที่เพิ่งบันทึก
2. ค้นผ่าน API / UI

Expected:
- หาเจอรายการนั้น
- row index / type / category ตรงกับ canonical sheet

### 6. Mobile sync
ขั้นตอน:
1. เปิด app
2. sync ใหม่
3. ตรวจรายการล่าสุด

Expected:
- app เห็นรายการที่เพิ่งบันทึก
- ไม่ติด stale cache ผิดตัว

## Evidence ที่ต้องเก็บ
- execution id
- `ref_id`
- response body ของ Apps Script
- row index ใน sheet
- screenshot ถ้าจำเป็น

## Evidence ล่าสุด
- `docs/pay-smoke-evidence-2026-03-17.md`

## Exit Criteria
ถือว่ารอบ deploy ผ่านเมื่อ:
- add success ผ่าน
- duplicate ผ่าน
- unauthorized ผ่าน
- validation error ผ่าน
- search by ref_id ผ่าน
