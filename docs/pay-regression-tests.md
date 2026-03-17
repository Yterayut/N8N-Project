# PAY Regression Tests

สำหรับ smoke test หลัง deploy หรือหลัง patch production flow ให้ยึด checklist หลักที่:
- `docs/pay-smoke-test-checklist.md`

## Scope

ครอบคลุมเส้นหลัก:
- LINE/N8N slip ingestion
- GAS API auth + response contract
- canonical schema
- web app CRUD
- dashboard/statistics aggregation

## API/Auth

1. `GET /exec?endpoint=userinfo` โดยไม่มี `api_key`
- Expected: `status = unauthorized`

2. `POST handleN8nTransaction` พร้อม `api_key` ที่ถูกต้อง
- Expected: `status = ok` หรือ `duplicate`

3. `POST handleN8nTransaction` ด้วย `api_key` ผิด
- Expected: `status = unauthorized`

4. `POST` แบบ JSON และ form payload
- Expected: parse ได้ทั้งสองแบบ

## Slip Ingestion

1. slip ใหม่ที่มี `ref_id`
- Expected: append row ใหม่
- Expected: มี `transaction_id`
- Expected: `source = n8n`

2. slip ซ้ำด้วย `ref_id` เดิม
- Expected: `status = duplicate`

3. slip ไม่มี `ref_id` แต่มี fingerprint ซ้ำ
- Expected: `status = duplicate`

4. slip amount เป็น `0` หรือ date/time ว่าง
- Expected: `status = validation_error`

## Web App CRUD

1. เพิ่ม transaction จาก modal
- Expected: row ใหม่ใน sheet
- Expected: dashboard/list refresh

2. แก้ transaction จาก modal
- Expected: update row เดิมด้วย `transaction_id`
- Expected: `updated_at` เปลี่ยน

3. ลบ transaction จากหน้า list
- Expected: resolve `transaction_id` ได้ถูก
- Expected: row ถูกลบจริง

4. เปลี่ยนชื่อ category จาก category manager
- Expected: `Categories` sheet update
- Expected: rows ใน `Sheet1` ที่ match category เดิม update ตาม

## Filters/UI

1. ค้นหาด้วยข้อความ
- Expected: list update ตาม keyword

2. เปลี่ยน type/category/date filters ถี่ ๆ
- Expected: ไม่มี stale response overwrite ผลล่าสุด

3. กด `ล้างตัวกรอง`
- Expected: filters reset และ list โหลดทั้งหมด

4. force backend error
- Expected: มี error banner ไม่เงียบ

## Aggregation

1. Dashboard เดือนที่มีข้อมูล
- Expected: income/expense/balance ตรงกับ sheet

2. Statistics รายปี
- Expected: monthly totals และ top categories ตรงกับ normalized data

3. Rows เก่าหลัง migration
- Expected: dashboard/list/statistics ใช้ `transaction_id`, `source`, `type`, `category` ได้ครบ

## Manual Checks After Deploy

1. เปิด web app และยืนยันว่าโหลดได้
2. เปิดหน้า Transactions และทดสอบ add/edit/delete
3. ส่งสลิปจริง 1 ใบเข้า LINE
4. ตรวจ response:
- LINE reply
- GAS row
- web app list
- dashboard summary
