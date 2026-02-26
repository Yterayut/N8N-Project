# T029D — OCR Benchmark Runner: Regression Guard

**Author:** Claude Code (CC)
**Date:** 2026-02-26 (updated from stub 2026-02-25)
**Status:** READY — spec complete, ground truth 21/21 ready
**Assignee:** Codex
**Priority:** High
**Risk:** ต่ำ — สร้าง workflow + sheet ใหม่, ไม่แก้ main OCR

---

## Overview

สร้าง `ocr-benchmark-runner` workflow ที่:
1. อ่าน `OCR_BENCHMARK_FUEL` sheet (test cases)
2. ส่งแต่ละ test case เข้า main OCR webhook
3. เปรียบเทียบผลกับ `ground_truth`
4. บันทึก accuracy + pass/fail กลับใน sheet + ส่ง Telegram summary

**ใช้สำหรับ:**
- วัด baseline accuracy ก่อน rule/template change
- ดู regression: accuracy ลดลง → alert

---

## ข้อมูลสำหรับ Implementation

```
N8N_BASE:              http://localhost:5678
SPREADSHEET_ID:        12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0
SHEET_NAME:            OCR_BENCHMARK_FUEL
OCR_WEBHOOK:           http://localhost:5678/webhook/ocr-dev  (test endpoint, ใช้ test key)
OCR_API_KEY_ENV:       OCR_SHARED_API_KEY
TELEGRAM_CRED_ID:      rauiF9qBRW8iVrsU
CHAT_ID_ENV:           TELEGRAM_OCR_CHAT_ID
TEST_FILES_DIR:        /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/file/
GROUND_TRUTH_DIR:      /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/docs/gg/proposals/
GOOGLE_SHEETS_CRED:    ดูจาก credential ที่ใช้ใน ocr-kpi-report workflow
```

---

## Step 0 (Codex): สร้าง OCR_BENCHMARK_FUEL Sheet

ถ้า sheet ยังไม่มี → สร้างด้วย Google Sheets API หรือผ่าน n8n:

**Columns (ตาม T029-architecture.md Sheet 7):**
```
benchmark_id | doc_type | vendor_tax_id | vendor_name | difficulty | input_file_path | ground_truth | fields_to_check | notes | last_run_at | last_run_exec_id | last_run_accuracy | last_run_result
```

> **หมายเหตุ v1:** ใช้ `input_file_path` (local path) แทน `input_drive_file_id` (ตาม architecture spec) เพื่อไม่ต้องอัปโหลด GDrive ในรอบแรก migrate GDrive ได้ใน T029D-v2

---

## Step 1 (Codex): Populate OCR_BENCHMARK_FUEL Sheet

อ่าน ground truth files จาก `docs/gg/proposals/2026-02-26-groundtruth-*.json` แล้วเพิ่มแต่ละ row

**Ground truth files พร้อมแล้ว 21 ไฟล์ (ตรวจสอบโดย CC):**

| benchmark_id | source_file | doc_type | difficulty | notes |
|---|---|---|---|---|
| bm_caltex01 | file/caltex.pdf | tax_invoice | easy | Page 1/4 of PDF |
| bm_shell01 | file/shell.pdf | tax_invoice | easy | FuelSave G95 |
| bm_pttorm01 | "file/PTT-OR.pdf" | tax_invoice | easy | GASOHOL 91 |
| bm_ptthand01 | "file/PTT-เขียนมือ.pdf" | tax_invoice | hard | handwritten LPG |
| bm_susco01 | file/susco.pdf | tax_invoice | easy | |
| bm_gas01 | file/gas.pdf | tax_invoice | easy | |
| bm_bchk01 | "file/บางจาก01.pdf" | tax_invoice | easy | |
| bm_bchk02 | "file/บางจาก.pdf" | tax_invoice | easy | |
| bm_ptmax01 | file/PT-MAX.pdf | tax_invoice | easy | |
| bm_ritta01 | "file/Example ritta bill.pdf" | tax_invoice | medium | |
| bm_fleet01 | file/fleetcard.pdf | other | hard | Fleet card Page 2/17 |
| bm_feed01 | "file/บิลน้ำมัน 3 Bill.pdf" | tax_invoice | medium | multi-bill |
| bm_feed02 | "file/บิลน้ำมัน_feedcard_02_KTB.pdf" | other | hard | KTB statement 7pp |
| bm_feed03 | "file/บิลน้ำมัน_feedcard_03_KTB.pdf" | other | hard | KTB statement |
| bm_feed04 | "file/บิลน้ำมัน_feedcard_04_kbank.pdf" | other | hard | KBank statement |
| bm_sgas01 | "file/สยามแก๊ส.json" | tax_invoice | easy | |
| bm_elec01 | "file/บิลค่าไฟ.pdf" | tax_invoice | medium | 5 receipts, first |
| bm_elec02 | "file/ใบแจ้งค่าไฟ.pdf" | invoice | medium | MEA electricity |
| bm_elec03 | "file/ใบแจ้งค่าไฟ_02.pdf" | invoice | medium | |
| bm_elec04 | "file/ใบแจ้งค่าไฟ_03.pdf" | invoice | medium | |
| bm_elec05 | "file/ใบแจ้งค่าไฟ_04.pdf" | invoice | medium | |

**ฟิลด์ ground_truth (JSON string)** — map จาก GG JSON ดังนี้:
```javascript
// จาก ground truth file ของแต่ละ PDF
const gt = {
  doc_type: fields.doc_type,
  vendor_name: fields.vendor_name,
  vendor_tax_id: fields.vendor_tax_id,
  invoice_number: fields.invoice_number,
  invoice_date: fields.invoice_date,
  total_amount: fields.total_amount,
  vat_amount: fields.vat_amount,
  subtotal: fields.subtotal
};
```

**fields_to_check (default):**
```json
["doc_type","vendor_tax_id","total_amount","vat_amount","invoice_number"]
```

สำหรับ hard cases (fleet card, feedcard): ใช้ `["doc_type","vendor_tax_id","total_amount"]` เท่านั้น

---

## Step 2: Workflow `ocr-benchmark-runner`

### Nodes

```
Webhook Trigger (POST /webhook/ocr-benchmark)
  → Code: Validate Auth (x-api-key)
  → Google Sheets: Read OCR_BENCHMARK_FUEL (all rows)
  → SplitInBatches (batch=1, rate limit: 12s between items = ≤5/min)
  → Execute Command: curl POST to OCR webhook
  → Code: Parse OCR Response
  → Code: Compare vs Ground Truth
  → Google Sheets: Update row (last_run_*)
  → (loop back)
  → Code: Build Summary
  → Telegram: Send Summary
  → Respond to Webhook (200 + summary JSON)
```

### Node Specs

**Webhook Trigger**
- Path: `/ocr-benchmark`
- Method: POST
- Auth: `x-api-key: {{ $env.OCR_SHARED_API_KEY }}`
- Body (optional): `{ "filter_doc_type": "tax_invoice" }` — ถ้าไม่ส่ง = run ทุก row
- Response mode: `lastNode`

**Code: Validate Auth**
- ใช้ `timingSafeEqual()` ตาม PATTERN ที่ใช้ใน workflow อื่น

**Google Sheets: Read OCR_BENCHMARK_FUEL**
- Operation: `getAll`
- Spreadsheet: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- Sheet: `OCR_BENCHMARK_FUEL`

**SplitInBatches**
- Batch size: 1
- Wait between batches: 12000ms (= ≤5 calls/min)

**Execute Command: curl POST to OCR webhook**
```bash
curl -s -w "\n%{http_code}" \
  -X POST "http://localhost:5678/webhook/ocr-dev" \
  -H "x-api-key: $OCR_SHARED_API_KEY" \
  -F "file=@{{$json.input_file_path}}" \
  --max-time 60
```
- continueOnFail: true

**Code: Parse OCR Response**
```javascript
const output = String($json.stdout || '').trim().split('\n');
const httpCode = output.pop();
const body = output.join('\n');
let parsed = {};
let parseError = null;
try { parsed = JSON.parse(body); } catch (e) { parseError = e.message; }
const bills = parsed.bills || parsed.result?.bills || [];
return [{ json: {
  http_code: parseInt(httpCode),
  parse_error: parseError,
  bills,
  raw_response: body.slice(0, 500)  // truncate for sheet
}}];
```

**Code: Compare vs Ground Truth**

Logic:
1. อ่าน `ground_truth` (JSON.parse จาก sheet)
2. อ่าน `fields_to_check` (JSON.parse หรือ default)
3. ถ้า http_code ≠ 200 → result = fail, accuracy = 0
4. ถ้า bills.length === 0 → result = fail, accuracy = 0
5. ใช้ bills[0] เปรียบเทียบ (single-bill test)
6. Per-field match:
   - numeric: `Math.abs(got - expected) / Math.max(expected, 1) < 0.01` (1% tolerance)
   - string: normalize ก่อน (`trim().toLowerCase()`)
7. accuracy = (matched / total_checked) * 100
8. result: `pass` (≥80%), `partial` (50–79%), `fail` (<50%)

**Google Sheets: Update row**
- Operation: `update`
- Row: match `benchmark_id`
- Update columns: `last_run_at`, `last_run_exec_id`, `last_run_accuracy`, `last_run_result`

**Code: Build Summary** (หลัง loop เสร็จ)
```
🧪 OCR Benchmark Results
━━━━━━━━━━━━━━━━━━━━
📊 Ran: {total} cases
✅ Pass: {pass_count} ({pass_pct}%)
⚠️ Partial: {partial_count}
❌ Fail: {fail_count}

📈 Avg accuracy: {avg_accuracy}%

{ถ้า fail_count > 0:}
❌ Failed cases:
  • {benchmark_id} ({doc_type}): {accuracy}%
  ...

⏰ {datetime}
```

---

## Test Plan

| # | Test | Expected |
|---|------|----------|
| T1 | POST `/webhook/ocr-benchmark` ไม่มี key | 401 |
| T2 | POST ด้วย key ถูกต้อง (body ว่าง) | ทุก row รัน, Telegram ได้ summary |
| T3 | ดู sheet OCR_BENCHMARK_FUEL: last_run_* ถูก update | ✅ |
| T4 | POST `{ "filter_doc_type": "tax_invoice" }` | รันเฉพาะ rows ที่เป็น tax_invoice |
| T5 | row ที่ ground_truth ตรง → accuracy ≥80% | pass |

---

## Definition of Done

**Implemented:**
- [ ] `OCR_BENCHMARK_FUEL` sheet สร้างแล้ว, columns ตาม spec
- [ ] Sheet populated: ≥10 rows จาก ground truth files
- [ ] `ocr-benchmark-runner` workflow active

**Verified:**
- [ ] T1 ผ่าน (auth)
- [ ] T2 ผ่าน (full run, Telegram received)
- [ ] T3 ผ่าน (sheet updated)
- [ ] ≥1 row มี result=pass (ยืนยัน accuracy logic ทำงาน)

**Docs:**
- [ ] HANDOFF.md อัปเดต T029D complete + workflow ID

---

## Security Considerations

- Webhook auth: `timingSafeEqual()` เหมือน T032
- `Execute Command: curl` ไม่รับ file path จาก user input — hardcoded จาก sheet ที่ CC populate เท่านั้น
- Sheet column `input_file_path` ควรมีแค่ `/home/oneclimate-uat/.../file/*.pdf` — Codex ต้อง validate ว่า path อยู่ใน `file/` directory ก่อน execute

---

## Discussion

*(Codex pre-execution questions ใส่ที่นี่)*
