# GAS Spreadsheet CRUD (Apps Script + clasp)

CRUD สำหรับทุกชีตใน Google Sheet:
- Spreadsheet ID: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- ตัวอย่างชีต: `PROMPTS`, `OCR`, `OCR_RAW`, `OCR_KEYS`

หมายเหตุ:
- ระบบจะอ่าน header row (แถว 1) ของแต่ละชีตเป็น data contract
- ถ้ามีคอลัมน์ชื่อ `updated_at` จะอัปเดตเวลาให้อัตโนมัติเมื่อ create/update

## 1) เตรียมเครื่อง

```bash
npm i -g @google/clasp
clasp login
```

## 2) ผูกโปรเจกต์ Apps Script

1. สร้าง Apps Script project ใหม่ที่ https://script.google.com
2. คัดลอก `Script ID` จาก Project Settings
3. ในโฟลเดอร์นี้:

```bash
cd scripts/gas-prompts-crud
cp .clasp.json.example .clasp.json
# แก้ค่า scriptId ใน .clasp.json
```

## 3) Push โค้ดขึ้น Apps Script

```bash
clasp push
```

## 4) Deploy เป็น Web App

```bash
clasp deploy --description "prompts-crud-v1"
```

แล้วนำ Deployment URL ไปเรียก API

## 5) API Contract

ทุก POST ใช้ JSON รูปแบบ:

```json
{
  "action": "create|read|update|delete|sheets",
  "sheet": "PROMPTS",
  "data": {},
  "filter": {},
  "match": {},
  "options": {}
}
```

- `sheet` ถ้าไม่ส่ง จะใช้ค่า default `PROMPTS`
- `filter` ใช้กับ `read`
- `match` ใช้กับ `update/delete` (required)
- `options.updateMany=true` เพื่อ update หลายแถว
- `options.deleteMany=true` เพื่อ delete หลายแถว

### List sheets (GET)

```bash
curl "YOUR_WEB_APP_URL?action=sheets"
```

### Read (GET)

```bash
curl "YOUR_WEB_APP_URL?action=read&sheet=PROMPTS"
```

### Read with filter (GET)

```bash
curl "YOUR_WEB_APP_URL?action=read&sheet=PROMPTS&filter=%7B%22active%22%3A%22TRUE%22%7D"
```

### Create (POST)

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"create",
    "sheet":"PROMPTS",
    "data":{
      "key":"fuel",
      "prompt":"สำหรับบิลน้ำมัน ...",
      "active":"TRUE"
    }
  }'
```

### Update (POST)

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"update",
    "sheet":"PROMPTS",
    "match":{"key":"fuel"},
    "data":{
      "prompt":"prompt ใหม่",
      "active":"FALSE"
    },
    "options":{"updateMany":false}
  }'
```

### Delete (POST)

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"delete",
    "sheet":"PROMPTS",
    "match":{"key":"fuel"},
    "options":{"deleteMany":false}
  }'
```

### Read with filter (POST)

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"read",
    "sheet":"PROMPTS",
    "filter":{"active":true}
  }'
```

### Reserve key atomically (POST)

ใช้สำหรับ dedupe แบบกัน race condition:

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"reserve_key",
    "sheet":"OCR_DEDUPE",
    "key_column":"row_key",
    "key_value":"0105532107890_INV001_01/01/2568_1500"
  }'
```

response ตัวอย่าง:
- จองสำเร็จ: `{"ok":true,"data":{"reserved":true,"duplicate":false,...}}`
- ซ้ำ: `{"ok":true,"data":{"reserved":false,"duplicate":true,...}}`

### Replace all rows (POST)

ใช้สำหรับ materialize dashboard/review queue แบบเป็น snapshot ล่าสุด:

```bash
curl -X POST "YOUR_WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"replace_rows",
    "sheet":"OCR_REVIEW_QUEUE",
    "rows":[
      {"document_id":"doc_1","request_id":"req_1","status":"needs_review"}
    ]
  }'
```

## หมายเหตุ

- เทียบค่า filter/match เป็น exact match ตามค่าที่เก็บในชีต
- ถ้าต้องการ update/delete ทุกแถวที่ match ให้เปิด `updateMany/deleteMany`
- `reserve_key` และ `replace_rows` ใช้ `LockService` เพื่อกันชนกันจาก request พร้อมกัน
- โปรดตั้งสิทธิ์ Web App ให้เหมาะกับการใช้งานจริง (เช่น จำกัดบัญชีหรือป้องกันด้วย token เพิ่ม)
