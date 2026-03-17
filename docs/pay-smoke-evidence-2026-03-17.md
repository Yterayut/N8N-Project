# PAY Smoke Evidence: 2026-03-17

## วัตถุประสงค์
บันทึกหลักฐานการตรวจ smoke test รอบจัดระเบียบ source of truth / workflow contract / duplicate handling

## Environment
- Timezone: `Asia/Bangkok`
- n8n workflow: `PAY`
- n8n workflow ID: `L1NnDsCnLgUsKMgK`
- Apps Script endpoint:
  - `https://script.google.com/macros/s/AKfycbz1_NiIQDVcEHE-byhCCifZ7mxuuJgQCWWWUyHrZoSi920APhRviGkLEBwMzYN9Kt1qKQ/exec`
- Automation script:
  - `scripts/pay/smoke_pay_runtime.sh`

## Evidence

### 1. Add new transaction -> success
- Source:
  - n8n execution `#163284`
  - runtime smoke automation `PAY_SMOKE_ADD=1 scripts/pay/smoke_pay_runtime.sh`
- Observed:
  - execution `Succeeded`
  - Apps Script response `status=ok`
  - Google Sheet append สำเร็จ
- Canonical evidence:
  - row `437`
  - `ref_id = C20260316607516382771`
  - `amount = 187`
  - `category = Shopping`
  - `receiver_name = Shopee`
  - `transaction_id = 962ad7a2-b950-4ade-b095-7e02141bdcd7`

### 1A. Automated add smoke after source-of-truth hardening
- Run time:
  - `2026-03-17 14:14 +07`
- Request:
  - `PAY_SMOKE_ADD=1 scripts/pay/smoke_pay_runtime.sh`
- Generated ref:
  - `smoke-add-20260317141447`
- Response:
```json
{
  "success": true,
  "status": "ok",
  "error_code": "OK",
  "data": {
    "rowIndex": 438,
    "transaction_id": "3f8afc20-b110-47f4-9cb6-f19fdc986408"
  }
}
```
- Canonical evidence:
  - row `438`
  - `request_id = SMOKE-ADD-REQ-1773731687`
  - `last_writer = n8n`
  - `schema_version = 2026-03-17.v1`
  - `classification_version = 2026-03-17.v1`
  - `reconciliation_status = canonical`

### 2. Duplicate -> duplicate response with row trace
- Source:
  - replay / direct smoke call against live endpoint
- Request:
  - `endpoint=ingestSlip`
  - `api_key=Marn2530`
  - `ref_id=C20260316607516382771`
  - same slip payload
- Response:
```json
{
  "success": false,
  "status": "duplicate",
  "error_code": "DUPLICATE_REF_ID",
  "data": {
    "rowIndex": 436,
    "transaction_id": "962ad7a2-b950-4ade-b095-7e02141bdcd7",
    "duplicate": true,
    "matched_row_index": 436,
    "matched_transaction_id": "962ad7a2-b950-4ade-b095-7e02141bdcd7",
    "matched_ref_id": "c20260316607516382771",
    "matched_status": "active",
    "matched_created_at": "Tue Mar 17 2026 11:59:23 GMT+0700 (เวลาอินโดจีน)",
    "matched_reason": "ref_id"
  }
}
```
- Result:
  - ไม่มี row ใหม่ถูก append
  - duplicate trace กลับได้ถึง row เดิม

### 3. Unauthorized -> unauthorized response
- Time checked:
  - `2026-03-17 13:21:13 +07`
- Request:
  - `endpoint=ingestSlip`
  - `api_key=WRONGKEY`
- Response:
```json
{
  "success": false,
  "status": "unauthorized",
  "error_code": "UNAUTHORIZED",
  "error": "Unauthorized request"
}
```
- Result:
  - ไม่มีการ append row
  - ไม่ถูกตีความเป็น duplicate

### 4. Validation error -> validation_error response
- Time checked:
  - `2026-03-17 13:21:13 +07`
- Request:
  - `endpoint=ingestSlip`
  - `api_key=Marn2530`
  - ไม่มี `amount`
- Response:
```json
{
  "success": false,
  "status": "validation_error",
  "error": "amount must be greater than 0",
  "error_code": "VALIDATION_ERROR"
}
```
- Result:
  - ไม่มีการ append row
  - ไม่ถูกตีความเป็น duplicate

### 5. Search / trace by ref_id
- Request:
  - `endpoint=findByRefId`
  - `ref_id=C20260316607516382771`
- Response summary:
  - `status=ok`
  - `count=1`
  - row `436`
  - `transaction_id=962ad7a2-b950-4ade-b095-7e02141bdcd7`
  - `status=active`

### 6. Runtime smoke automation
- Run time:
  - `2026-03-17 13:21:13 +07`
- Command:
  - `scripts/pay/smoke_pay_runtime.sh`
- Covered cases:
  - add success
  - unauthorized
  - validation_error
  - duplicate
  - findByRefId
- Result:
  - `PAY runtime smoke passed`

### 7. Schema migration / provenance backfill
- Run time:
  - `2026-03-17 13:59 +07`
- Request:
  - `GET endpoint=migrateSheetSchema&api_key=...`
- Response:
```json
{
  "success": true,
  "status": "ok",
  "error_code": "OK",
  "data": {
    "updated": 436,
    "message": "Schema migration completed."
  }
}
```
- Follow-up verification:
  - `findByRefId(C20260316607516382771)` returned:
    - `request_id = 163284`
    - `last_writer = n8n`
    - `schema_version = 2026-03-17.v1`
    - `classification_version = 2026-03-17.v1`
    - `reconciliation_status = canonical`

## Conclusion
ชุด smoke หลักของ PAY ผ่านครบ:
- add success
- duplicate
- unauthorized
- validation error
- search by ref_id
- schema migration / provenance backfill

จุดที่ยังแยกติดตามต่อ:
- mobile sync ต้องตรวจจากฝั่ง Android app runtime หลัง release consumer
