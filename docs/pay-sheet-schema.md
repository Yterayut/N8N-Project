# PAY Canonical Sheet Schema

## วัตถุประสงค์
เอกสารนี้ประกาศ canonical schema ของ `Sheet1` สำหรับระบบ PAY

authoritative source:
- `apps-script/pay-finance/Code.js`
- constant `CANONICAL_HEADERS`

## Canonical Columns

| ลำดับ | column | ความหมาย |
|---|---|---|
| 1 | `date` | วันที่ธุรกรรม |
| 2 | `time` | เวลา |
| 3 | `type` | `income` / `expense` / `transfer` |
| 4 | `amount` | จำนวนเงิน |
| 5 | `category` | หมวด canonical หลัง classify |
| 6 | `sender_name` | ชื่อผู้ส่ง |
| 7 | `sender_bank` | ธนาคารผู้ส่ง |
| 8 | `receiver_name` | ชื่อผู้รับ |
| 9 | `receiver_bank` | ธนาคารผู้รับ |
| 10 | `ref_id` | external reference / slip reference |
| 11 | `execution_id` | execution id จาก integration |
| 12 | `status` | `active` / `inactive` / `deleted` / `archived` |
| 13 | `transaction_id` | id หลักของ transaction |
| 14 | `source` | แหล่งที่มา เช่น `n8n`, `webapp`, `mobile_app` |
| 15 | `created_at` | เวลาสร้าง canonical row |
| 16 | `updated_at` | เวลาอัปเดตล่าสุด |
| 17 | `note` | หมายเหตุ |
| 18 | `request_id` | request trace id |
| 19 | `last_writer` | writer ล่าสุดที่เขียน row นี้ |
| 20 | `schema_version` | schema version ตอนเขียน |
| 21 | `classification_version` | classification rules version ตอนเขียน |
| 22 | `reconciliation_status` | สถานะ reconciliation เช่น `canonical` |

## Canonical Rules

### Required minimum for slip ingestion
- `date`
- `time`
- `type`
- `amount`

### Required minimum for stable traceability
- `transaction_id`
- `source`
- `status`
- `created_at`
- `updated_at`

### Required minimum for provenance
- `request_id`
- `last_writer`
- `schema_version`
- `classification_version`
- `reconciliation_status`

## Notes

### `transaction_id`
- เป็น primary business identifier ของระบบ
- ห้ามอิง row index เป็น identity หลัก

### `request_id`
- ใช้ trace request ข้าม layer
- เช่น n8n execution หรือ consumer request

### `last_writer`
- ใช้ตอบว่า row นี้ถูกเขียนล่าสุดโดย flow ไหน

### `schema_version` / `classification_version`
- ใช้ตอบว่า row นี้ถูกสร้าง/ซ่อมภายใต้กติกาชุดไหน

## Maintenance
- ถ้าเพิ่ม/ลบ/เปลี่ยนคอลัมน์ ต้องแก้:
  - `apps-script/pay-finance/Code.js`
  - `docs/source-of-truth.md`
  - `docs/environments.md`
  - `docs/pay-release-manifest.md`
  - `docs/pay-smoke-test-checklist.md` ถ้ากระทบ contract
