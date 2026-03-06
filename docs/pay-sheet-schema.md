# PAY Sheet Schema

ใช้กับ Google Sheet `Sheet1` ของระบบ PAY หลัง canonical migration

## Columns

| Column | Name | Type | Required | Description |
|---|---|---|---|---|
| A | `date` | `yyyy-MM-dd` ใน write path, แสดงผลเป็น `dd/MM/yyyy` | yes | วันที่ทำรายการ |
| B | `time` | `HH:mm` | yes | เวลา |
| C | `type` | `income \| expense \| transfer` | yes | ประเภทธุรกรรมแบบ canonical |
| D | `amount` | number | yes | จำนวนเงินมากกว่า `0` |
| E | `category` | string | yes | หมวดหมู่แบบ normalized |
| F | `sender_name` | string | no | ชื่อผู้โอน/ผู้จ่าย |
| G | `sender_bank` | string | no | ธนาคารต้นทาง |
| H | `receiver_name` | string | no | ชื่อผู้รับ |
| I | `receiver_bank` | string | no | ธนาคารปลายทาง |
| J | `ref_id` | string | no | reference id จากสลิป |
| K | `execution_id` | string | no | execution id จาก n8n |
| L | `status` | string | yes | ปัจจุบันใช้ `active` เป็นหลัก |
| M | `transaction_id` | uuid string | yes | primary identifier สำหรับ mutation |
| N | `source` | string | yes | เช่น `n8n`, `webapp`, `migration` |
| O | `created_at` | ISO-like datetime | yes | เวลาสร้าง row |
| P | `updated_at` | ISO-like datetime | yes | เวลาแก้ไขล่าสุด |
| Q | `note` | string | no | หมายเหตุจาก web app หรือ source อื่น |

## Write Rules

- ทุก write path ต้องเรียก `ensureCanonicalSchema_()` ก่อน
- ทุก transaction ใหม่ต้องมี `transaction_id`
- `type` ต้องอยู่ในชุด `income`, `expense`, `transfer` เท่านั้น
- `amount` ต้องมากกว่า `0`
- `category` ต้องผ่าน normalization ก่อนเขียน
- `source` ต้องระบุทุกครั้ง

## Identity Rules

- ใช้ `transaction_id` เป็น identity หลัก
- `rowIndex` ใช้ได้เฉพาะ fallback ตอน map ไปยัง row ปัจจุบันใน sheet
- delete/update/category update ต้อง resolve `transaction_id -> rowIndex` ก่อน mutate

## Migration

- ใช้ `migrateSheetSchema()` เพื่อเติมคอลัมน์ที่ขาด
- migration จะ backfill:
  - `status`
  - `transaction_id`
  - `source`
  - `created_at`
  - `updated_at`
  - normalized `type/category`
