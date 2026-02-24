# T026 — OCR Feedback Receiver + KPI Accuracy System

**Status:** Completed (implemented + tested by Codex, 2026-02-24)
**Owner:** Codex
**Assigned by:** Claude Code (2026-02-24)
**Priority:** High

---

## Overview

สร้างระบบรับ feedback จาก CarbonReceipt admin เพื่อวัด KPI ความแม่นยำของ OCR

- **เส้นที่ 1** `/webhook/ocr-dev` — มีอยู่แล้ว (ไม่แตะ)
- **เส้นที่ 2** `/webhook/ocr-feedback` — **ใหม่** รับข้อมูลที่ admin แก้ไขแล้ว
  - **Implementation note (Codex):** ใช้ path จริงเป็น `/webhook/ocr-feedback-kpi` ชั่วคราวเพื่อหลีกเลี่ยงชนกับ `Webhook_OCR_Feedback` ใน workflow หลัก (`ocr-invoice-processor`) ที่ใช้ `/webhook/ocr-feedback` อยู่แล้ว

Flow:
```
OCR ประมวลผล → เก็บ OCR_RAW sheet (request_id)
                          ↓
           CarbonReceipt admin ตรวจสอบ + แก้ไข
                          ↓
     POST /webhook/ocr-feedback (body มี request_id เดิม)
                          ↓
          n8n: diff vs ต้นฉบับ → accuracy → KPI
```

---

## Phase A — Workflow: `ocr-feedback-receiver`

### A1. Webhook Node
- **Path:** `ocr-feedback`
  - **Implemented path:** `ocr-feedback-kpi` (see Discussion)
- **Method:** POST
- **Response mode:** `responseNode` (respond manually)
- **Authentication:** ไม่ตั้ง built-in — ใช้ Code node validate เอง

### A2. Code node: Validate Auth + Schema

```javascript
// Input: $json (raw webhook body)
const API_KEY = $env.OCR_SHARED_API_KEY || '';
const receivedKey = $input.first().json?.headers?.['x-api-key']
  || $input.first().json?.headers?.['authorization']?.replace('Bearer ', '')
  || '';

if (!receivedKey || receivedKey !== API_KEY) {
  return [{ json: { valid: false, error: 'UNAUTHORIZED', status: 401 } }];
}

const body = $input.first().json?.body || $input.first().json || {};
const { document_id, request_id, data } = body;

if (!request_id || !data || !Array.isArray(data.bills) || data.bills.length === 0) {
  return [{ json: { valid: false, error: 'INVALID_SCHEMA', status: 400 } }];
}

return [{
  json: {
    valid: true,
    document_id: document_id || '',
    request_id,
    bills: data.bills,
    received_at: new Date().toISOString(),
    bills_count: data.bills.length
  }
}];
```

**หลัง validate:** แยก branch ด้วย IF node
- `valid === false` → Respond to Webhook (error 400/401)
- `valid === true` → ดำเนินการต่อ

### A3. Google Sheets node: Lookup OCR_RAW

ดึง row ต้นฉบับจาก OCR_RAW sheet ด้วย `request_id`

- **Operation:** `getRows` (filter)
- **Sheet:** `OCR_RAW` (gid: `1923516144`)
- **Document ID:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- **Filter:** column `request_id` = `{{ $json.request_id }}`
- **Return:** first match (หรือ empty ถ้าไม่เจอ)

### A4. Code node: Diff + Accuracy Calculation

```javascript
const feedback = $('Code node: Validate Auth + Schema').first().json;
const rawRow = $json; // จาก Sheets lookup — อาจว่างถ้าไม่เจอ

const feedbackBills = feedback.bills || [];
const request_id = feedback.request_id;
const document_id = feedback.document_id;
const received_at = feedback.received_at;

// ดึง OCR bills ต้นฉบับจาก raw_json
let ocrBills = [];
const found = !!(rawRow && rawRow.request_id);
if (found && rawRow.raw_json) {
  try {
    const parsed = JSON.parse(rawRow.raw_json);
    ocrBills = parsed?.bills || [];
  } catch(e) {}
}

// Fields ที่วัด accuracy (ปรับน้ำหนักได้)
const FIELDS = ['vendor_tax_id', 'invoice_number', 'invoice_date_th', 'total'];

function normalizeValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(Math.round(v * 100) / 100);
  return String(v).trim().toLowerCase();
}

function compareTotal(a, b) {
  const na = parseFloat(String(a).replace(/,/g,'')) || 0;
  const nb = parseFloat(String(b).replace(/,/g,'')) || 0;
  return Math.abs(na - nb) < 0.05; // tolerance ±0.05
}

// Vendor classification (doc_type + vendor_name matching)
function classifyVendor(bill) {
  const name = String(bill.customer_name || bill.vendor_name || '').toLowerCase();
  const taxId = String(bill.vendor_tax_id || '');

  // Fuel vendors
  if (name.includes('ptt') || name.includes('ปตท') || taxId.startsWith('0107536000550')) return { doc_type: 'fuel', vendor: 'PTT/OR' };
  if (name.includes('bangchak') || name.includes('บางจาก') || taxId.startsWith('0107536000567')) return { doc_type: 'fuel', vendor: 'Bangchak' };
  if (name.includes(' pt ') || name.includes('พีที') || name.includes('p.t.')) return { doc_type: 'fuel', vendor: 'PT' };
  if (name.includes('shell') || name.includes('เชลล์')) return { doc_type: 'fuel', vendor: 'Shell' };
  if (name.includes('esso') || name.includes('เอสโซ่') || name.includes('caltex')) return { doc_type: 'fuel', vendor: 'Esso/Caltex' };
  if (name.includes('susco') || name.includes('ซัสโก้')) return { doc_type: 'fuel', vendor: 'Susco' };

  // Electricity
  if (name.includes('การไฟฟ้านคร') || name.includes('mea')) return { doc_type: 'electricity', vendor: 'MEA' };
  if (name.includes('การไฟฟ้าส่วนภูมิ') || name.includes('pea')) return { doc_type: 'electricity', vendor: 'PEA' };

  // Water
  if (name.includes('การประปานคร') || name.includes('mwa')) return { doc_type: 'water', vendor: 'MWA' };
  if (name.includes('การประปาส่วนภูมิ') || name.includes('pwa')) return { doc_type: 'water', vendor: 'PWA' };

  return { doc_type: 'other', vendor: 'unknown' };
}

// คำนวณ accuracy ต่อ bill
const results = feedbackBills.map((fb, idx) => {
  const ocr = ocrBills[idx] || {};
  const { doc_type, vendor } = classifyVendor(fb);

  let matched = 0;
  const fieldResults = {};

  FIELDS.forEach(field => {
    let isMatch = false;
    if (field === 'total') {
      isMatch = compareTotal(ocr[field], fb[field]);
    } else {
      isMatch = normalizeValue(ocr[field]) === normalizeValue(fb[field]);
    }
    fieldResults[`${field}_ocr`] = ocr[field] ?? '';
    fieldResults[`${field}_corrected`] = fb[field] ?? '';
    fieldResults[`${field}_match`] = isMatch;
    if (isMatch) matched++;
  });

  const accuracy_score = found ? Math.round((matched / FIELDS.length) * 100) : null;

  return {
    json: {
      request_id,
      document_id,
      received_at,
      bill_index: idx,
      ocr_found: found,
      doc_type,
      vendor,
      ...fieldResults,
      matched_fields: matched,
      total_fields: FIELDS.length,
      accuracy_score,
      raw_feedback_json: JSON.stringify(fb)
    }
  };
});

return results;
```

> **หมายเหตุ:** node นี้ return **หลาย items** (1 item ต่อ 1 bill) — ถ้า bills มี 2 รายการ จะได้ 2 rows ใน Sheets

### A5. Google Sheets node: Append → OCR_FEEDBACK

- **Operation:** `append`
- **Sheet:** `OCR_FEEDBACK` (ต้องสร้าง sheet ใหม่ใน Spreadsheet เดิม)
- **Document ID:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- **Columns (mapping):**

| Column | Value |
|--------|-------|
| `received_at` | `={{ $json.received_at }}` |
| `request_id` | `={{ $json.request_id }}` |
| `document_id` | `={{ $json.document_id }}` |
| `bill_index` | `={{ $json.bill_index }}` |
| `ocr_found` | `={{ $json.ocr_found }}` |
| `doc_type` | `={{ $json.doc_type }}` |
| `vendor` | `={{ $json.vendor }}` |
| `vendor_tax_id_ocr` | `={{ $json.vendor_tax_id_ocr }}` |
| `vendor_tax_id_corrected` | `={{ $json.vendor_tax_id_corrected }}` |
| `vendor_tax_id_match` | `={{ $json.vendor_tax_id_match }}` |
| `invoice_number_ocr` | `={{ $json.invoice_number_ocr }}` |
| `invoice_number_corrected` | `={{ $json.invoice_number_corrected }}` |
| `invoice_number_match` | `={{ $json.invoice_number_match }}` |
| `invoice_date_th_ocr` | `={{ $json.invoice_date_th_ocr }}` |
| `invoice_date_th_corrected` | `={{ $json.invoice_date_th_corrected }}` |
| `invoice_date_th_match` | `={{ $json.invoice_date_th_match }}` |
| `total_ocr` | `={{ $json.total_ocr }}` |
| `total_corrected` | `={{ $json.total_corrected }}` |
| `total_match` | `={{ $json.total_match }}` |
| `matched_fields` | `={{ $json.matched_fields }}` |
| `total_fields` | `={{ $json.total_fields }}` |
| `accuracy_score` | `={{ $json.accuracy_score }}` |
| `raw_feedback_json` | `={{ $json.raw_feedback_json }}` |

### A6. Code node: Build Telegram Notification

```javascript
// รับทุก items จาก A4 (อาจมีหลาย bills)
const items = $input.all();
const first = items[0]?.json || {};
const request_id = first.request_id;
const received_at = first.received_at;
const bills_count = items.length;
const ocr_found = first.ocr_found;

let avg_accuracy = null;
if (ocr_found) {
  const scores = items.map(i => i.json.accuracy_score || 0);
  avg_accuracy = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
}

// สรุป fields ที่ผิด
const wrongFields = [];
items.forEach((item, idx) => {
  const j = item.json;
  ['vendor_tax_id','invoice_number','invoice_date_th','total'].forEach(f => {
    if (j[`${f}_match`] === false) {
      wrongFields.push(`bill[${idx}].${f}: "${j[`${f}_ocr`]}" → "${j[`${f}_corrected`]}"`);
    }
  });
});

const accuracyLine = ocr_found
  ? `Accuracy: ${avg_accuracy}%`
  : `⚠️ ไม่พบ request_id ในระบบ (เก็บ raw ไว้แล้ว)`;

const wrongLine = wrongFields.length > 0
  ? `Fields ที่ผิด:\n${wrongFields.slice(0,5).map(f=>`  • ${f}`).join('\n')}`
  : `✅ ทุก field ถูกต้อง`;

const msg = [
  `📋 [OCR Feedback รับแล้ว]`,
  `Request: ${request_id}`,
  `Bills: ${bills_count} รายการ`,
  accuracyLine,
  wrongLine,
  `เวลา: ${received_at}`
].join('\n');

return [{ json: { telegram_text: msg } }];
```

### A7. Telegram node: Send Notification
- **Chat ID:** `{{ $env.TELEGRAM_OCR_CHAT_ID }}`
- **Credential:** `rauiF9qBRW8iVrsU`
- **Text:** `{{ $json.telegram_text }}`

### A8. Respond to Webhook (success)
- **Status:** 200
- **Body:** `{ "status": "ok", "bills_processed": N }`

### A9. Respond to Webhook (error)
- **Status:** `{{ $json.status }}` (400 / 401)
- **Body:** `{ "error": "{{ $json.error }}" }`

---

## Phase B — Workflow: `ocr-kpi-report`

### B1. Trigger
- **Schedule:** ทุกวัน 08:00 (Asia/Bangkok)
- **Manual trigger:** ด้วย webhook หรือ manual execution

### B2. Google Sheets node: Read OCR_FEEDBACK (all rows)
- อ่านทุก row จาก `OCR_FEEDBACK` sheet

### B3. Code node: Aggregate KPI

```javascript
const rows = $input.all().map(i => i.json);

// filter เฉพาะ rows ที่มี accuracy_score
const valid = rows.filter(r => r.accuracy_score !== null && r.accuracy_score !== '');

if (valid.length === 0) {
  return [{ json: { report: 'ยังไม่มีข้อมูล feedback', total_feedback: 0 } }];
}

function avg(arr) {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a,b) => a+b, 0) / arr.length);
}

// Overall
const overall = avg(valid.map(r => Number(r.accuracy_score)));

// By doc_type
const byType = {};
valid.forEach(r => {
  const t = r.doc_type || 'other';
  if (!byType[t]) byType[t] = [];
  byType[t].push(Number(r.accuracy_score));
});

// By vendor
const byVendor = {};
valid.forEach(r => {
  const v = r.vendor || 'unknown';
  if (!byVendor[v]) byVendor[v] = [];
  byVendor[v].push(Number(r.accuracy_score));
});

// By field
const fields = ['vendor_tax_id','invoice_number','invoice_date_th','total'];
const byField = {};
fields.forEach(f => {
  const matches = valid.filter(r => r[`${f}_match`] === 'TRUE' || r[`${f}_match`] === true);
  byField[f] = Math.round((matches.length / valid.length) * 100);
});

// Build report text
const typeLines = Object.entries(byType)
  .sort((a,b) => b[1].length - a[1].length)
  .map(([t, arr]) => `  ${t}: ${avg(arr)}% (${arr.length} docs)`);

const vendorLines = Object.entries(byVendor)
  .sort((a,b) => b[1].length - a[1].length)
  .map(([v, arr]) => `  ${v}: ${avg(arr)}% (${arr.length} docs)`);

const fieldLines = fields.map(f => `  ${f}: ${byField[f]}%`);

const report = [
  `📊 OCR KPI Report — ${new Date().toLocaleDateString('th-TH')}`,
  ``,
  `🎯 Overall Accuracy: ${overall}%`,
  `📝 Total feedback: ${valid.length} bills`,
  ``,
  `📁 แยกตาม Doc Type:`,
  ...typeLines,
  ``,
  `🏪 แยกตาม Vendor:`,
  ...vendorLines,
  ``,
  `🔍 แยกตาม Field:`,
  ...fieldLines
].join('\n');

return [{ json: { report, overall, total_feedback: valid.length, byType, byVendor, byField } }];
```

### B4. Telegram node: Send KPI Report
- **Chat ID:** `{{ $env.TELEGRAM_OCR_CHAT_ID }}`
- **Text:** `{{ $json.report }}`

---

## Google Sheets Setup (Codex ต้องสร้าง)

### สร้าง sheet ใหม่: `OCR_FEEDBACK`
- **Spreadsheet ID:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- เพิ่ม sheet tab ใหม่ชื่อ `OCR_FEEDBACK`
- **Header row (A1:W1):**
  ```
  received_at | request_id | document_id | bill_index | ocr_found | doc_type | vendor |
  vendor_tax_id_ocr | vendor_tax_id_corrected | vendor_tax_id_match |
  invoice_number_ocr | invoice_number_corrected | invoice_number_match |
  invoice_date_th_ocr | invoice_date_th_corrected | invoice_date_th_match |
  total_ocr | total_corrected | total_match |
  matched_fields | total_fields | accuracy_score | raw_feedback_json
  ```

---

## Risk Mitigation (ต้องทำตาม)

| Risk | Implementation |
|------|---------------|
| R1: crash กระทบ OCR เดิม | สร้างเป็น **workflow แยกสมบูรณ์** — ห้าม modify workflow `up1n75qEhbsXswii` |
| R2: error ใน Code node | wrap ทุก logic ใน `try/catch` — ถ้า error → respond 200 + log ไม่ throw |
| R3: request_id ไม่เจอ | เก็บ raw feedback ไว้เสมอ — flag `ocr_found: false` แต่ไม่ fail |
| R4: malformed JSON | validate schema ใน A2 → respond 400 ก่อน process |
| R5: Sheets quota | เพิ่ม `retryOnFail: true, maxTries: 3` ใน Sheets nodes |

---

## Testing Requirements (Codex ต้องรัน)

### Test 1: Happy path
```bash
curl -X POST http://localhost:5678/webhook/ocr-feedback \
  -H "Content-Type: application/json" \
  -H "x-api-key: ocm-cabonrecipte!" \
  -d '{
    "document_id": "doc_test-001",
    "request_id": "<ใส่ request_id จริงจาก OCR_RAW sheet>",
    "data": {
      "bills": [{
        "vendor_tax_id": "0107561000013",
        "invoice_number": "INV-001",
        "invoice_date_th": "19/05/2568",
        "customer_name": "บริษัท ทดสอบ จำกัด",
        "total": 1122.84
      }]
    }
  }'
# Expected: 200 ok, row in OCR_FEEDBACK, Telegram notify
```

### Test 2: Invalid API key → 401
```bash
curl -X POST ... -H "x-api-key: wrong-key" -d '{...}'
# Expected: 401 UNAUTHORIZED
```

### Test 3: request_id ไม่เจอ → ocr_found=false แต่ยัง 200
```bash
# ใช้ request_id สมมติ ไม่มีใน sheet
# Expected: 200 ok, ocr_found=false ใน sheet, accuracy_score ว่าง
```

### Test 4: Multi-bill document
```bash
# ส่ง bills: [{...}, {...}] — 2 bills
# Expected: 2 rows ใน OCR_FEEDBACK sheet
```

### Test 5: KPI report workflow
- Run manual trigger → Telegram ได้รับ report

---

## Workflow Names
- `ocr-feedback-receiver` (n8n workflow ใหม่)
- `ocr-kpi-report` (n8n workflow ใหม่)

## Environment Variables (ใช้ของเดิมทั้งหมด — ไม่ต้องเพิ่ม)
- `OCR_SHARED_API_KEY` — สำหรับ validate auth
- `TELEGRAM_OCR_CHAT_ID` — สำหรับ notify

---

## Discussion
### Codex implementation notes (2026-02-24)

1. **Webhook path collision**
   - Spec ระบุ `/webhook/ocr-feedback`
   - แต่ workflow หลัก `ocr-invoice-processor` มี `Webhook_OCR_Feedback` path นี้อยู่แล้ว
   - ถ้าสร้าง workflow ใหม่ใช้ path เดียวกัน request จะวิ่งเข้า workflow หลักแทน
   - จึงเปลี่ยน path ของ workflow ใหม่เป็น **`/webhook/ocr-feedback-kpi`**

2. **n8n REST-created webhook node ต้องมี `webhookId`**
   - Workflow `ocr-feedback-receiver` ถูกสร้างผ่าน REST API และ activate ได้ แต่ route ไม่ register (404)
   - Root cause: webhook node ไม่มี field `webhookId`
   - Fix: patch node ให้มี `webhookId` แล้ว toggle active/restart n8n

3. **`bills_processed` response count bug**
   - `Respond to Webhook (feedback success)` รับ input จาก Telegram node จึงอ่าน `bills_processed` ไม่เจอ (ได้ `0`)
   - Fix: เปลี่ยน expression ให้ดึงจาก `$('Code node: Build Telegram Notification').first().json.bills_processed`

4. **`OCR_FEEDBACK` sheet tab ยังไม่มี**
   - สร้าง tab ผ่าน workflow ชั่วคราว (Webhook -> Google Sheets resource=`sheet`, operation=`create`)
   - Header row ถูกสร้างอัตโนมัติจาก append ครั้งแรกของ `Google Sheets (Append OCR_FEEDBACK)` (autoMapInputData)

---

## Completion Checklist
- [x] สร้าง `OCR_FEEDBACK` sheet (header row ครบ)
- [x] สร้าง workflow `ocr-feedback-receiver` ใน n8n
- [x] สร้าง workflow `ocr-kpi-report` ใน n8n
- [x] รัน Test 1-5 ทั้งหมดผ่าน
- [x] บันทึกผลทดสอบใน task file นี้ (section ด้านล่าง)
- [x] อัปเดต HANDOFF.md

## Test Results (Codex fill in)
### Environment
- n8n base: `http://127.0.0.1:5678` (production webhook endpoint on local server)
- Spreadsheet: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- OCR_FEEDBACK gid (created): `1589922285`
- `ocr-feedback-receiver` workflow ID: `ztJ8oCBHREUPPry6`
- `ocr-kpi-report` workflow ID: `yCqvdl3vrHGgiBMt`

### Test 1 — Happy path ✅
- Endpoint used: `POST /webhook/ocr-feedback-kpi`
- Input: valid `request_id` (`1771496401701-14eff6e1c7e3f`) + 1 corrected bill
- Result:
  - HTTP `200`
  - Response: `{\"status\":\"ok\",\"bills_processed\":1}`
  - `OCR_FEEDBACK` append success (verified by KPI workflow reading rows)
  - Telegram feedback notify node executed

### Test 2 — Invalid API key ✅
- Endpoint used: `POST /webhook/ocr-feedback-kpi`
- Header: `x-api-key: wrong-key`
- Result:
  - HTTP `401`
  - Response: `{\"error\":\"UNAUTHORIZED\"}`

### Test 3 — `request_id` not found ✅
- Endpoint used: `POST /webhook/ocr-feedback-kpi`
- Input: non-existent `request_id` (`req_not_found_99999`) + 1 bill
- Result:
  - HTTP `200`
  - Response: `{\"status\":\"ok\",\"bills_processed\":1}`
  - `ocr_found=false` row appended (verified indirectly via workflow logic + row read in KPI workflow)
  - Accuracy remains blank/empty in row (by design)

### Test 4 — Multi-bill document ✅
- Endpoint used: `POST /webhook/ocr-feedback-kpi`
- Input: valid `request_id` + `bills` array length `2`
- Result:
  - HTTP `200`
  - Response: `{\"status\":\"ok\",\"bills_processed\":2}`
  - 2 rows appended to `OCR_FEEDBACK`

### Test 5 — KPI report workflow ✅
- Trigger: manual execution via n8n REST `/rest/workflows/{id}/run` (with `triggerToStartFrom: Manual Trigger`)
- Execution ID: `151377`
- Result (decoded from execution runData):
  - `Google Sheets (OCR_FEEDBACK)` read success (`items=4`)
  - `Code node: Aggregate KPI` success (report generated, `overall=100`, `total_feedback=3`)
  - `Telegram (OCR KPI Report)` success (`ok=true`, message sent to chat `1776637578`)

### Notes
- `OCR_FEEDBACK` headers were auto-generated from first successful append (`autoMapInputData`) after tab creation.
- Workflow path differs from spec (`ocr-feedback-kpi` instead of `ocr-feedback`) to avoid collision with main OCR feedback webhook in `ocr-invoice-processor`.
