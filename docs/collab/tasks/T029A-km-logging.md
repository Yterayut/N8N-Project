# T029A — OCR KM Logger: Logging Phase

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** High
**Risk:** ต่ำ — ไม่กระทบ main OCR flow
**Depends on:** ไม่มี
**Next phase:** T029B (หลัง T029A verified)

---

## Overview

สร้าง `ocr-km-logger` workflow + patch 2 existing workflows เพื่อ:
- เมื่อมี feedback หรือ Telegram training confirmation → compute field-level diff → บันทึก TRAIN_CASES + FIELD_DIFFS อัตโนมัติ

**เป็น foundation สำหรับทุก phase ถัดไป** — ถ้าไม่มี data ใน TRAIN_CASES จะทำ T029B/C/D ไม่ได้

---

## Sheets ที่ต้องสร้าง (ใน Spreadsheet ID: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`)

### OCR_TRAIN_CASES (สร้าง tab ใหม่)
Headers row 1:
```
case_id | created_at | source | request_id | doc_type | vendor_tax_id | vendor_name | ocr_accuracy_pct | diff_count | severity | root_cause_tag | example_id_ref | drive_file_id | status | notes
```

### OCR_TRAIN_FIELD_DIFFS (สร้าง tab ใหม่)
Headers row 1:
```
diff_id | case_id | created_at | doc_type | vendor_tax_id | field_name | ocr_value | correct_value | diff_type | severity
```

---

## Workflow ใหม่: `ocr-km-logger`

**Webhook path:** `POST /webhook/ocr-km-log`
**Auth:** `x-api-key` = `$env.OCR_SHARED_API_KEY`
**Response:** JSON `{ok: true, case_id, diff_count}`

### Input payload (จาก caller):
```json
{
  "source": "feedback_kpi",
  "request_id": "req_...",
  "doc_type": "fuel",
  "vendor_tax_id": "0107...",
  "vendor_name": "PTT",
  "ocr_accuracy_pct": 72.5,
  "drive_file_id": "1abc...",
  "example_id_ref": "",
  "ocr_bills": [{ "total": "1200", "invoice_date_th": "15/01/2568", ... }],
  "correct_bills": [{ "total": "1350", "invoice_date_th": "15/01/2568", ... }]
}
```

**`source` enum:** `feedback_kpi` / `telegram_train`

### Nodes:

**Node 1: Webhook (ocr-km-log)**
- type: `n8n-nodes-base.webhook`
- method: POST
- path: `ocr-km-log`
- responseMode: `responseNode`
- options: {}
- **ต้องมี `webhookId` field (UUID)** — ดู PATTERN-008

**Node 2: Code (Validate + Auth)**
```javascript
const payload = $json.body || $json;
const headers = $json.headers || {};

const givenKey = String(headers['x-api-key'] || '');
const expectedKey = String($env.OCR_SHARED_API_KEY || '');
if (!expectedKey || givenKey !== expectedKey) {
  return [{ json: { ok: false, error: 'UNAUTHORIZED', status: 401 } }];
}

const required = ['source', 'request_id', 'doc_type'];
for (const f of required) {
  if (!payload[f]) {
    return [{ json: { ok: false, error: `MISSING_FIELD_${f.toUpperCase()}`, status: 422 } }];
  }
}

const allowedSources = ['feedback_kpi', 'telegram_train', 'manual'];
if (!allowedSources.includes(payload.source)) {
  return [{ json: { ok: false, error: 'INVALID_SOURCE', status: 422 } }];
}

return [{ json: { ...payload, _validated: true } }];
```

**Node 3: IF (auth ok?)**
- condition: `{{ $json._validated === true }}`
- true → Node 4
- false → Respond (error)

**Node 4: Respond to Webhook (auth error)**
- responseCode: `{{ $json.status || 401 }}`
- body: `{{ JSON.stringify($json) }}`

**Node 5: Code (Compute Diffs)**
```javascript
const p = $json;
const ocrBill = (p.ocr_bills || [{}])[0] || {};
const corrBill = (p.correct_bills || [{}])[0] || {};

// Field severity map
const fieldSeverity = {
  total: 'high',
  vendor_tax_id: 'high',
  invoice_date_th: 'medium',
  invoice_number: 'medium',
  customer_name: 'low',
  address: 'low',
  currency: 'low',
  item_description: 'low',
  item_unit_price: 'low',
  item_amount: 'low',
};

const TRACKED_FIELDS = Object.keys(fieldSeverity);

// Compute field-level diffs
const diffs = [];
for (const field of TRACKED_FIELDS) {
  const ocrVal = String(ocrBill[field] ?? '').trim().slice(0, 500);
  const corrVal = String(corrBill[field] ?? '').trim().slice(0, 500);
  if (ocrVal !== corrVal) {
    let diffType = 'wrong_value';
    if (!ocrVal) diffType = 'missing';
    else if (!corrVal) diffType = 'extra';
    // Simple format error heuristic
    else if (field === 'invoice_date_th' && ocrVal && !/^\d{2}\/\d{2}\/\d{4}$/.test(ocrVal)) {
      diffType = 'format_error';
    }
    diffs.push({
      field_name: field,
      ocr_value: ocrVal,
      correct_value: corrVal,
      diff_type: diffType,
      severity: fieldSeverity[field] || 'low',
    });
  }
}

// Severity of case
const diffCount = diffs.length;
let severity = 'low';
if (diffCount >= 5) severity = 'high';
else if (diffCount >= 3) severity = 'medium';

// Root cause tag
let rootCauseTag = 'no_diff';
if (diffCount > 0) {
  const fieldNames = diffs.map(d => d.field_name);
  if (diffCount >= 5) rootCauseTag = 'full_ocr_failure';
  else if (diffCount >= 3) rootCauseTag = 'multi_field_error';
  else if (fieldNames.includes('total') && diffCount === 1) rootCauseTag = 'amount_mismatch';
  else if (fieldNames.includes('invoice_date_th') && diffCount === 1) rootCauseTag = 'date_format';
  else if (fieldNames.includes('vendor_tax_id') && diffCount === 1) rootCauseTag = 'tax_id_wrong';
  else if (fieldNames.includes('invoice_number') && diffCount === 1) rootCauseTag = 'invoice_number_mismatch';
  else rootCauseTag = 'multi_field_error';
}

// Generate IDs
const ts = Date.now();
const rand = () => Math.random().toString(36).substring(2, 8);
const caseId = `tc_${ts}_${rand()}`;
const now = new Date().toISOString();

const trainCase = {
  case_id: caseId,
  created_at: now,
  source: p.source || 'unknown',
  request_id: String(p.request_id || ''),
  doc_type: String(p.doc_type || ''),
  vendor_tax_id: String(p.vendor_tax_id || ''),
  vendor_name: String(p.vendor_name || ''),
  ocr_accuracy_pct: p.ocr_accuracy_pct !== undefined ? Number(p.ocr_accuracy_pct) : '',
  diff_count: diffCount,
  severity,
  root_cause_tag: rootCauseTag,
  example_id_ref: String(p.example_id_ref || ''),
  drive_file_id: String(p.drive_file_id || ''),
  status: 'pending_review',
  notes: '',
};

const fieldDiffs = diffs.map((d, i) => ({
  diff_id: `df_${ts}_${rand()}`,
  case_id: caseId,
  created_at: now,
  doc_type: trainCase.doc_type,
  vendor_tax_id: trainCase.vendor_tax_id,
  field_name: d.field_name,
  ocr_value: d.ocr_value,
  correct_value: d.correct_value,
  diff_type: d.diff_type,
  severity: d.severity,
}));

return [{
  json: {
    train_case: trainCase,
    field_diffs: fieldDiffs,
    case_id: caseId,
    diff_count: diffCount,
  }
}];
```

**Node 6: Google Sheets (Append TRAIN_CASES)**
- operation: append
- sheetId: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- sheetName: `OCR_TRAIN_CASES`
- columns: map จาก `$json.train_case.*`
- `continueOnFail: true`

**Node 7: Code (Prepare FIELD_DIFFS rows)**
```javascript
const diffs = $json.field_diffs || [];
if (diffs.length === 0) {
  return [{ json: { _skip_diffs: true, case_id: $json.case_id } }];
}
return diffs.map(d => ({ json: d }));
```

**Node 8: Google Sheets (Append FIELD_DIFFS)**
- operation: append
- sheetId: same
- sheetName: `OCR_TRAIN_FIELD_DIFFS`
- columns: map จาก `$json.*`
- `continueOnFail: true`

**Node 9: Code (Build Response)**
```javascript
const items = $input.all();
const caseId = items[0]?.json?.case_id || '';
const diffCount = items[0]?.json?.diff_count || 0;
return [{
  json: {
    ok: true,
    case_id: caseId,
    diff_count: diffCount,
  }
}];
```

**Node 10: Respond to Webhook (success)**
- responseCode: 200
- body: `{{ JSON.stringify($json) }}`

### Connections:
```
Webhook → Validate+Auth → IF(auth ok?)
  false → Respond(auth error)
  true → Compute Diffs → Append TRAIN_CASES → Prepare FIELD_DIFFS → Append FIELD_DIFFS → Build Response → Respond(success)
```

---

## Patches ที่ต้องทำ

### Patch 1: `ocr-feedback-receiver` (ztJ8oCBHREUPPry6)

เพิ่ม HTTP node หลัง Google Sheets (Append OCR_FEEDBACK) ใน success path:

**Node ใหม่: HTTP (POST ocr-km-log)**
```javascript
// ใส่เป็น n8n expression ใน HTTP Request node
// URL: http://127.0.0.1:5678/webhook/ocr-km-log
// Method: POST
// Headers: x-api-key = $env.OCR_SHARED_API_KEY
// Body (JSON):
{
  "source": "feedback_kpi",
  "request_id": "={{ $json.request_id }}",
  "doc_type": "={{ $json.doc_type }}",
  "vendor_tax_id": "={{ $json.ocr_pred_json?.bills?.[0]?.vendor_tax_id || '' }}",
  "vendor_name": "={{ $json.ocr_pred_json?.bills?.[0]?.vendor_name || '' }}",
  "ocr_accuracy_pct": "={{ null }}",
  "drive_file_id": "",
  "example_id_ref": "",
  "ocr_bills": "={{ $json.ocr_pred_json?.bills || [] }}",
  "correct_bills": "={{ $json.admin_final_json?.bills || [] }}"
}
```
- `continueOnFail: true` — feedback flow ต้องไม่พัง ถ้า km-log down
- timeout: 10000ms
- ไม่ต้อง wait response

### Patch 2: `ocr-training` (KW0QRXxRh9MjdPaY)

เพิ่ม HTTP node หลัง `Build Command Reply` ใน confirm/correct path (เมื่อ OCR_EXAMPLES row สร้างสำเร็จ):

**Node ใหม่: HTTP (POST ocr-km-log training)**
```javascript
// URL: http://127.0.0.1:5678/webhook/ocr-km-log
// Method: POST
// Headers: x-api-key = $env.OCR_SHARED_API_KEY
// Body:
{
  "source": "telegram_train",
  "request_id": "={{ $('Build OCR Preview Reply').first().json.request_id || '' }}",
  "doc_type": "={{ $('Build OCR Preview Reply').first().json.doc_type || '' }}",
  "vendor_tax_id": "={{ $('Build OCR Preview Reply').first().json.vendor || '' }}",
  "drive_file_id": "={{ $('Build OCR Preview Reply').first().json.drive_file_id || '' }}",
  "example_id_ref": "={{ $json.example_id || '' }}",
  "ocr_bills": "={{ $('Build OCR Preview Reply').first().json.ocr_result?.bills || [] }}",
  "correct_bills": "={{ $json.gold_bills || $('Build OCR Preview Reply').first().json.ocr_result?.bills || [] }}"
}
```
- `continueOnFail: true`
- timeout: 10000ms

---

## Security Considerations

1. **Auth gate**: Webhook ต้องตรวจ x-api-key ก่อนทำงานทุก node
2. **Input sanitize**: field values truncate ที่ 500 chars (ใน Compute Diffs node แล้ว)
3. **No raw OCR response stored**: เก็บแค่ field-level diffs ไม่ใช่ full JSON
4. **continueOnFail**: ป้องกัน main flow พังจาก logger
5. **Schema whitelist**: TRACKED_FIELDS จำกัดเฉพาะ fields ที่รู้จัก

---

## Security Findings (Pre-implementation)
- `vendor_hint` rule_type (T029C) คือจุดเสี่ยงที่สุด → T029A ไม่มี → risk ต่ำ
- ocr_bills / correct_bills จาก caller: ต้องไม่ eval/execute ค่าเหล่านี้ → ใช้แค่ string comparison → safe

---

## Discussion

_Codex: เพิ่มข้อสงสัย/ความเห็นที่นี่ก่อน implement_

### Q1 (CC): Build OCR Preview Reply ใน ocr-training เก็บ `request_id` ไว้ใน staticData ไหม?
ถ้าไม่มี → อาจต้องดึงจาก `$('Telegram Trigger').first().json.message.message_id` แทน ให้ Codex ตรวจก่อน implement Patch 2

### Q2 (CC): `gold_bills` ใน ocr-training — ตอน correct path มี correct_bills ครบไหม?
`Build Examples API Command` น่าจะมีข้อมูลที่ corrected อยู่แล้ว — ให้ Codex ตรวจ node นั้นก่อน

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | feedback_kpi source → 1 TRAIN_CASE row | POST /webhook/ocr-feedback-kpi with diff | case_id in TRAIN_CASES, diffs in FIELD_DIFFS |
| T2 | telegram_train source → 1 TRAIN_CASE row | Telegram confirm → check Sheets | same |
| T3 | 0 diffs (perfect OCR) | POST with identical ocr_bills + correct_bills | diff_count=0, severity=low, root_cause_tag=no_diff |
| T4 | total only wrong → root_cause_tag=amount_mismatch | | ✓ |
| T5 | 5+ diffs → severity=high, root_cause_tag=full_ocr_failure | | ✓ |

### Failure / Security
| # | Test | Expected |
|---|------|----------|
| T6 | wrong x-api-key | 401 UNAUTHORIZED |
| T7 | missing source field | 422 MISSING_FIELD_SOURCE |
| T8 | km-log down → feedback flow ยังทำงาน | continueOnFail verified |
| T9 | field value > 500 chars | truncated, no error |

---

## Definition of Done

- [ ] `ocr-km-logger` workflow created + active
- [ ] Webhook path `/webhook/ocr-km-log` responds 200
- [ ] TRAIN_CASES tab exists in Spreadsheet with correct headers
- [ ] FIELD_DIFFS tab exists in Spreadsheet with correct headers
- [ ] T1: feedback_kpi → row in TRAIN_CASES + FIELD_DIFFS (verified exec ID)
- [ ] T2: telegram_train → row in TRAIN_CASES + FIELD_DIFFS (verified exec ID)
- [ ] T8: continueOnFail verified (manually tested)
- [ ] Docs synced (HANDOFF.md updated)
- [ ] Verified from system: execution ID + Sheet row count

---

## Closing Template (Codex fills after Done)
```
Runtime patched:
Verified from system:
Docs synced:
Remaining limitations:
```
