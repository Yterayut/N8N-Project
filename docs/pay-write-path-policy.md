# PAY Write Path Policy

## วัตถุประสงค์
กำหนดนโยบายชัดเจนว่าใครมีสิทธิ์เขียนข้อมูลธุรกรรมของ PAY และต้องเขียนผ่านชั้นไหน

เป้าหมายคือ:
- ลด schema drift
- ลด duplicate behavior ที่อธิบายไม่ได้
- ทำให้ trace source ได้
- ลด incident ที่เกิดจากการเขียน `Sheet1` หลายทาง

## Policy หลัก

### ธุรกรรมทุกตัวต้องเขียนผ่าน Apps Script layer เท่านั้น
allowed:
- mobile app -> Apps Script API
- n8n workflow -> Apps Script API
- web app -> Apps Script function/API

not allowed:
- append ลง `Sheet1` ตรงจากระบบภายนอก
- update/delete `Sheet1` ตรงจาก script อื่นที่ไม่ผ่าน canonical Apps Script
- เขียนข้ามคอลัมน์เองโดยไม่เรียก schema guard

## Canonical Write Interface

### Transaction create/update/delete
ต้องผ่าน:
- `apps-script/pay-finance/Code.js`

และต้องผ่าน logic ต่อไปนี้:
- schema enforcement
- validation
- type/category normalization
- duplicate detection
- status normalization
- provenance fields

## Sheet Access Rules

### `Sheet1`
- สถานะ: canonical business storage
- เขียนตรงได้เฉพาะผ่าน Apps Script canonical layer

### `Categories`
- แก้ได้ผ่าน Apps Script category management เท่านั้น

### `ApiLogs`
- ใช้สำหรับ trace/debug
- ไม่ใช่ source of truth ของธุรกรรม

## Manual Edit Policy

### แก้มือใน Google Sheet
ทำได้เฉพาะกรณี:
- incident repair
- migration / backfill
- admin correction ที่จำเป็น

แต่ต้องทำตามนี้:
1. บันทึกเหตุผล
2. ระบุ row / ref_id / transaction_id
3. อัปเดต `updated_at`
4. log ลง `ApiLogs` หรือมี evidence ใน runbook

### ห้าม
- แก้มือแบบเงียบ ๆ แล้วถือว่าระบบ sync เอง
- เปลี่ยน `type/category/status` โดยไม่มี trace

## n8n Policy

### n8n เป็น integration writer เท่านั้น
- n8n ส่ง payload ไป Apps Script
- n8n ไม่ใช่ owner ของ canonical row
- execution success ไม่ใช่ตัวตัดสิน final business truth

### สิ่งที่ n8n ต้องส่งเมื่อเขียน transaction
- `source`
- `request_id`
- `execution_id`
- `ref_id` ถ้ามี
- fields ตาม contract ปัจจุบัน

## Mobile App Policy

### mobile app เป็น API consumer + cache
- เขียนผ่าน Apps Script API เท่านั้น
- local cache / offline queue ไม่ใช่ authoritative storage

## Web App Policy

### web app ต้องใช้ canonical Apps Script layer เดียวกัน
- ห้ามมี write path ที่ bypass schema/validation

## Enforcement Checklist

ก่อน merge งานที่แตะ write path ต้องตอบให้ได้:
1. flow นี้เขียน `Sheet1` ผ่าน Apps Script canonical layer หรือไม่
2. มี `transaction_id` ไหม
3. มี `source` ไหม
4. มี `updated_at` ไหม
5. duplicate logic จะเห็นรายการนี้ไหม
6. runbook จะ trace กลับรายการนี้ได้ไหม

## Enforcement Tooling
- audit script:
  - `scripts/pay/audit_pay_write_paths.sh`
- latest audit evidence:
  - `docs/pay-write-path-audit-2026-03-17.md`

## Definition of Done
ถือว่านโยบายนี้ถูกใช้งานจริงเมื่อ:
- ไม่มีระบบใหม่ใดเขียน `Sheet1` ตรง
- ทุก mutation ผ่าน Apps Script layer เดียว
- manual edits ถูกบันทึกและ trace ได้
