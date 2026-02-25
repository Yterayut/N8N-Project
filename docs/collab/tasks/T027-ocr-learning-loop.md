# T027 — OCR Learning Loop (Path 1 + Path 2)

**Status:** Completed (Codex, 2026-02-25)
**Owner:** Codex
**Assigned by:** Claude Code (2026-02-25)
**Priority:** High

---

## Overview

ปิด PDCA loop ของ OCR system โดยสร้างกลไก "Act" ที่ยังขาดอยู่

```
ก่อน T027:  P ✅ → D ✅ → C ✅ → A ❌ (OCR_FEEDBACK_API_URL ไม่มี)
หลัง T027:  P ✅ → D ✅ → C ✅ → A ✅ (loop ปิดครบ)
```

**3 workflows ใหม่:**
| Workflow | หน้าที่ |
|----------|--------|
| `ocr-examples-api` | CRUD API สำหรับ OCR_EXAMPLES sheet — เป็น `OCR_FEEDBACK_API_URL` |
| `ocr-learning-path1` | Path 1: รับ feedback จาก T026 → promote to OCR_EXAMPLES |
| `ocr-training` | Path 2: User trains เอง ผ่าน Telegram |

**1 env var ใหม่:**
```
OCR_FEEDBACK_API_URL=http://127.0.0.1:5678/webhook/ocr-examples-api
```

---

## สถาปัตยกรรม Full Loop

```
OCR_EXAMPLES sheet (few-shot pool)
         │ โหลดทุก request
         ▼
   Gemini OCR (ocr-invoice-processor)
         │ return bills[]
         ▼
   OCR Result → เก็บ OCR_RAW
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼ PATH 1                   ▼ PATH 2
Admin ส่ง feedback        User ส่งเอกสาร
/ocr-feedback-kpi         /ocr-train (Telegram)
    │                          │
    ▼                          ▼
T026: คำนวณ accuracy     OCR ประมวลผล
accuracy < 75%?          User ยืนยัน/แก้
    │                          │
    ▼                          ▼
ocr-learning-path1       บันทึก OCR_EXAMPLES
POST → ocr-examples-api  active=true ทันที
(active=false, pending)
    │
Telegram notify user
"approve ไหม?"
    │
User approve →
active=true
    │
    └──────────────────────────┘
                │
         OCR_EXAMPLES ดีขึ้น
         Gemini แม่นขึ้นครั้งหน้า
```

---

## Part A — Workflow: `ocr-examples-api`

เป็น internal API (CRUD) สำหรับ OCR_EXAMPLES sheet
ใช้โดย: main OCR workflow (อ่าน few-shot) + Path 1 (บันทึก pending) + Path 2 (บันทึก approved)

### A1. Webhook
- **Path:** `ocr-examples-api`
- **Method:** POST
- **Auth:** `x-api-key: {{ $env.OCR_SHARED_API_KEY }}`

### A2. Code node: Router

```javascript
const body = $input.first().json?.body || $input.first().json || {};
const key = ($input.first().json?.headers?.['x-api-key'] || '');
if (key !== ($env.OCR_SHARED_API_KEY || '')) {
  return [{ json: { ok: false, error: 'UNAUTHORIZED', status: 401 } }];
}

const { action, sheet, filter, data, id } = body;
const validActions = ['read', 'create', 'update', 'approve', 'reject'];
if (!action || !validActions.includes(action)) {
  return [{ json: { ok: false, error: 'INVALID_ACTION', status: 400 } }];
}

return [{ json: { ok: true, action, sheet: sheet || 'OCR_EXAMPLES', filter: filter || {}, data: data || {}, id: id || '' } }];
```

**แยก branch ด้วย Switch node ตาม `action`:**
- `read` → branch A
- `create` → branch B
- `update` / `approve` / `reject` → branch C

### A3. Branch A — Read OCR_EXAMPLES

Google Sheets node: Get Rows (filter by `doc_type` + `active=true`)
- **Sheet:** `OCR_EXAMPLES`
- **Document ID:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`

Code node: Format response
```javascript
const rows = $input.all().map(i => i.json).filter(r => {
  const f = $('Code node: Router').first().json.filter || {};
  if (f.doc_type && String(r.doc_type).toLowerCase() !== String(f.doc_type).toLowerCase()) return false;
  if (f.active !== undefined) {
    const active = String(r.active).toLowerCase();
    const want = String(f.active).toLowerCase();
    if (active !== want && !(want === 'true' && (active === '1' || active === 'yes'))) return false;
  }
  return true;
});
return [{ json: rows }];
```

### A4. Branch B — Create (pending or approved)

Code node: Build row
```javascript
const d = $('Code node: Router').first().json.data || {};
const now = new Date().toISOString();
return [{
  json: {
    example_id: `ex_${Date.now()}_${Math.random().toString(16).slice(2,6)}`,
    example_key: d.example_key || `${d.vendor || 'generic'}_${d.doc_type || 'unknown'}_${Date.now()}`,
    doc_type: d.doc_type || 'unknown',
    vendor: d.vendor || 'unknown',
    gold_json: typeof d.gold_json === 'string' ? d.gold_json : JSON.stringify(d.gold_json || {}),
    active: d.active === true ? 'true' : 'false',
    source: d.source || 'unknown',
    confirmed_count: d.confirmed_count || 1,
    approved_by: d.approved_by || '',
    drive_file_id: d.drive_file_id || '',
    request_id_ref: d.request_id_ref || '',
    created_at: now,
    updated_at: now
  }
}];
```

Google Sheets node: Append to `OCR_EXAMPLES`

### A5. Branch C — Update / Approve / Reject

Google Sheets node: Update row (filter by `example_id`)
- `approve` → set `active=true`, `approved_by=user`, `updated_at=now`
- `reject` → set `active=false`, `approved_by=rejected`, `updated_at=now`
- `update` → update ตาม data ที่ส่งมา

### A6. Respond to Webhook

```javascript
const action = $('Code node: Router').first().json.action;
return [{ json: { ok: true, action, timestamp: new Date().toISOString() } }];
```

---

## Part B — Workflow: `ocr-learning-path1`

Path 1: รับ trigger จาก T026 (ocr-feedback-receiver) หลัง feedback มีความแม่นต่ำ

### B1. Webhook (internal trigger)
- **Path:** `ocr-learning-trigger`
- **Method:** POST
- **เรียกโดย:** ocr-feedback-receiver หลังเก็บ OCR_FEEDBACK

### B2. Code node: Check Promote Criteria

```javascript
const f = $input.first().json || {};
// เงื่อนไข promote เป็น pending example
const accuracy = Number(f.accuracy_score || 100);
const ocr_found = f.ocr_found;
const vendor = f.vendor || 'unknown';
const doc_type = f.doc_type || 'unknown';
const confirmed_count = Number(f.confirmed_count || 1);

// เงื่อนไขพิจารณา
const should_pend = ocr_found && accuracy < 75;

// auto-activate ถ้า vendor+doc_type เคย correct ≥ 3 ครั้งแล้ว
const auto_activate = ocr_found && accuracy < 75 && confirmed_count >= 3;

return [{
  json: {
    ...f,
    should_pend,
    auto_activate,
    pending_reason: should_pend ? `accuracy=${accuracy}% < 75%` : 'not_needed'
  }
}];
```

**IF node:** `should_pend === true` → ดำเนินการต่อ, `false` → จบ

### B3. Code node: Build Example Payload

```javascript
const f = $json;
// ดึง gold_json จาก admin-corrected bills
const goldJson = {
  bills: (f.feedback_bills || []).map(b => ({
    vendor_tax_id: b.vendor_tax_id_corrected || b.vendor_tax_id_ocr,
    invoice_number: b.invoice_number_corrected || b.invoice_number_ocr,
    invoice_date_th: b.invoice_date_th_corrected || b.invoice_date_th_ocr,
    total: b.total_corrected || b.total_ocr,
    customer_name: b.customer_name || '',
  }))
};

return [{
  json: {
    ...f,
    example_payload: {
      action: 'create',
      sheet: 'OCR_EXAMPLES',
      data: {
        example_key: `${f.vendor}_${f.doc_type}_${f.request_id}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        doc_type: f.doc_type,
        vendor: f.vendor,
        gold_json: JSON.stringify(goldJson),
        active: f.auto_activate ? 'true' : 'false',
        source: 'admin_feedback',
        confirmed_count: f.confirmed_count || 1,
        approved_by: f.auto_activate ? 'auto' : '',
        drive_file_id: f.drive_file_id || '',
        request_id_ref: f.request_id
      }
    }
  }
}];
```

### B4. HTTP node: POST → ocr-examples-api (create)

```
POST http://127.0.0.1:5678/webhook/ocr-examples-api
x-api-key: {{ $env.OCR_SHARED_API_KEY }}
body: {{ $json.example_payload }}
```

### B5. IF node: auto_activate?

- `true` → ข้ามไป Telegram (แจ้งว่า auto-activated)
- `false` → Telegram แจ้งรอ approve

### B6. Code node: Build Telegram Approval Request

```javascript
const f = $json;
const example_id = $('HTTP node: POST ocr-examples-api').first().json?.example_id || '';

const msg = [
  `🔔 [OCR Learning] มี example ใหม่รอ approve`,
  ``,
  `Vendor: ${f.vendor}`,
  `Doc type: ${f.doc_type}`,
  `Accuracy เดิม: ${f.accuracy_score}%`,
  `Request ID: ${f.request_id}`,
  ``,
  `ถ้าต้องการ approve:`,
  `ส่ง "approve ${example_id}" มาที่ bot นี้`,
  `ถ้าไม่ approve:`,
  `ส่ง "reject ${example_id}"`,
].join('\n');

return [{ json: { telegram_text: msg, example_id } }];
```

### B7. Telegram node: Send Approval Request
- **Chat ID:** `{{ $env.TELEGRAM_OCR_CHAT_ID }}`

---

## Part C — Workflow: `ocr-training`

Path 2: User trains เอง ผ่าน Telegram

### C1. Webhook (รับ Telegram message จาก bot)

n8n มี Telegram Trigger node — ใช้ existing bot credential `rauiF9qBRW8iVrsU`

**2 flows ใน workflow นี้:**

#### Flow C-A: User ส่งไฟล์/รูปมาเพื่อ train
```
Telegram Trigger (รับ document/photo)
    ↓
Code: validate เป็น training request?
  - ต้องมาจาก TELEGRAM_OCR_CHAT_ID (ป้องกัน outsider)
    ↓
Download file จาก Telegram
    ↓
Convert to base64
    ↓
POST /webhook/ocr-dev (เรียก OCR pipeline ปกติ)
    ↓
ส่งผลลัพธ์กลับ Telegram:
  "OCR ได้ผลนี้:
   vendor_tax_id: 0107536000550
   invoice_number: PTT-001
   total: 1,250.00

   ถูกต้องไหม?
   ตอบ: 'ถูก' หรือ 'แก้ total=1350.00'"
    ↓
เก็บ state ใน static data:
  { pending_train: { request_id, ocr_result, chat_id } }
```

#### Flow C-B: User ตอบ confirm/correct
```
Telegram Trigger (รับข้อความ)
    ↓
Code: parse คำตอบ
  ┌─────────────────────────────────┐
  │ "approve <example_id>"          │ → call ocr-examples-api (approve)
  │ "reject <example_id>"           │ → call ocr-examples-api (reject)
  │ "ถูก"                           │ → promote pending_train as active=true
  │ "แก้ total=1350.00"              │ → apply correction → promote as active=true
  └─────────────────────────────────┘
    ↓
POST → ocr-examples-api
  action: create (ถ้าใหม่)
  action: approve (ถ้า pending จาก Path 1)
  data.active: 'true'
  data.source: 'manual_training'
  data.approved_by: 'user'
    ↓
Telegram ตอบกลับ:
  "✅ บันทึกเป็น example แล้ว
   Vendor: PTT/OR, Doc: fuel
   จะใช้ใน OCR ครั้งถัดไป"
```

### C2. Code node: Parse Training Message

```javascript
const msg = String($json?.message?.text || '').trim();
const chatId = String($json?.message?.chat?.id || '');
const allowedChat = String($env.TELEGRAM_OCR_CHAT_ID || '');

// Security: รับเฉพาะจาก chat ที่อนุญาต
if (chatId !== allowedChat) {
  return [{ json: { skip: true } }];
}

// Parse approve/reject
const approveMatch = msg.match(/^(approve|reject)\s+(ex_[a-z0-9_]+)/i);
if (approveMatch) {
  return [{ json: {
    command: approveMatch[1].toLowerCase(),
    example_id: approveMatch[2],
    skip: false
  }}];
}

// Parse correction "แก้ field=value"
const correctMatch = msg.match(/^แก้\s+(.+)/i);
if (correctMatch) {
  const corrections = {};
  const parts = correctMatch[1].split(/[,\s]+/);
  parts.forEach(p => {
    const m = p.match(/^(\w+)=(.+)$/);
    if (m) corrections[m[1]] = m[2];
  });
  return [{ json: { command: 'correct', corrections, skip: false } }];
}

// Parse confirm "ถูก"
if (msg === 'ถูก' || msg === 'ถูกต้อง' || msg === 'ok') {
  return [{ json: { command: 'confirm', skip: false } }];
}

return [{ json: { skip: true, reason: 'unrecognized command' } }];
```

---

## Part D — OCR_EXAMPLES Sheet Setup

สร้าง sheet ใหม่ `OCR_EXAMPLES` ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`

**Header row:**
```
example_id | example_key | doc_type | vendor | gold_json | active |
source | confirmed_count | approved_by | drive_file_id | request_id_ref |
created_at | updated_at
```

**Seed data (Codex เพิ่ม 1 row ตัวอย่าง):**
```json
{
  "example_id": "ex_seed_001",
  "example_key": "generic_fuel_default",
  "doc_type": "fuel",
  "vendor": "generic",
  "gold_json": "{\"bills\":[{\"vendor_tax_id\":\"0107536000550\",\"invoice_number\":\"PTT-001\",\"invoice_date_th\":\"25/02/2568\",\"total\":1250.00}]}",
  "active": "true",
  "source": "original",
  "confirmed_count": 1,
  "approved_by": "user",
  "created_at": "2026-02-25"
}
```

---

## Part E — Env Var ที่ต้องเพิ่มใน .env

```bash
# เพิ่มใน .env (server)
OCR_FEEDBACK_API_URL=http://127.0.0.1:5678/webhook/ocr-examples-api
OCR_LEARNING_ACCURACY_THRESHOLD=75
OCR_LEARNING_AUTO_ACTIVATE_COUNT=3
```

---

## Part F — Update T026 (ocr-feedback-receiver)

Codex ต้อง **patch** workflow `ztJ8oCBHREUPPry6` เพิ่ม trigger ไปหา Path 1:

หลัง Append OCR_FEEDBACK sheet สำเร็จแล้ว → เพิ่ม HTTP node:

```javascript
// POST to ocr-learning-trigger (Path 1)
// ส่ง feedback data พร้อม accuracy สำหรับ learning decision
POST http://127.0.0.1:5678/webhook/ocr-learning-trigger
body: {
  accuracy_score,
  ocr_found,
  vendor,
  doc_type,
  request_id,
  drive_file_id,
  feedback_bills: [...],  // corrected bills จาก admin
  confirmed_count: 1       // จะ increment ถ้า vendor+doc_type เคยมีแล้ว
}
```

**หมายเหตุ:** ใช้ `retryOnFail: false, continueOnFail: true` — ถ้า Path 1 fail ไม่กระทบ T026

---

## Risk Mitigation

| Risk | Implementation |
|------|----------------|
| example ที่ admin แก้ผิดเข้า pool | active=false จนกว่า user approve |
| auto-activate ด้วย data noise | ต้อง confirmed_count ≥ 3 ก่อน auto |
| Telegram bot รับ command จาก คนอื่น | validate chat_id ก่อนทุก command |
| OCR pipeline พัง ถ้า ocr-examples-api down | `Code (Select Few-shot Examples)` มี try/catch → fallback empty |
| Loop ไม่สิ้นสุด (learning trigger → feedback → trigger) | ใช้ internal webhook path แยก — ไม่วิ่งผ่าน /ocr-feedback-kpi |

---

## Testing Requirements

### Test 1: ocr-examples-api read
```bash
curl -X POST http://localhost:5678/webhook/ocr-examples-api \
  -H "x-api-key: ocm-cabonrecipte!" \
  -d '{"action":"read","sheet":"OCR_EXAMPLES","filter":{"doc_type":"fuel","active":true}}'
# Expected: array of active fuel examples
```

### Test 2: ocr-examples-api create (pending)
```bash
curl -X POST http://localhost:5678/webhook/ocr-examples-api \
  -H "x-api-key: ocm-cabonrecipte!" \
  -d '{"action":"create","data":{"doc_type":"fuel","vendor":"PTT/OR","gold_json":"{\"bills\":[]}","active":false,"source":"test"}}'
# Expected: ok=true, row appended to OCR_EXAMPLES active=false
```

### Test 3: ocr-examples-api approve
```bash
curl -X POST http://localhost:5678/webhook/ocr-examples-api \
  -H "x-api-key: ocm-cabonrecipte!" \
  -d '{"action":"approve","id":"ex_xxx"}'
# Expected: row updated active=true
```

### Test 4: Path 1 trigger (simulate low accuracy feedback)
```bash
curl -X POST http://localhost:5678/webhook/ocr-learning-trigger \
  -H "x-api-key: ocm-cabonrecipte!" \
  -d '{"accuracy_score":45,"ocr_found":true,"vendor":"PTT/OR","doc_type":"fuel","request_id":"test-001","feedback_bills":[]}'
# Expected: pending example created in OCR_EXAMPLES + Telegram notify
```

### Test 5: Path 2 (Telegram confirm flow)
- ส่งไฟล์บิลไปที่ Telegram bot
- รอ OCR result reply
- ตอบ "ถูก"
- ตรวจ OCR_EXAMPLES มี row ใหม่ active=true, source=manual_training

### Test 6: OCR ใช้ few-shot จริง
- ตั้ง `OCR_FEEDBACK_API_URL` แล้วรัน OCR request ปกติ
- ตรวจ few_shot_count > 0 ใน execution log

### Test 7: main workflow ใช้ OCR_EXAMPLES
- หลัง OCR_FEEDBACK_API_URL set → few_shot_count ต้อง > 0

---

## Workflow Names
- `ocr-examples-api` (ใหม่)
- `ocr-learning-path1` (ใหม่)
- `ocr-training` (ใหม่)

---

## Completion Checklist
- [x] สร้าง `OCR_EXAMPLES` sheet + seed data
- [x] สร้าง workflow `ocr-examples-api` + test 1-3
- [x] เพิ่ม `OCR_FEEDBACK_API_URL` ใน `.env`
- [x] สร้าง workflow `ocr-learning-path1` + test 4
- [x] Patch `ocr-feedback-receiver` เพิ่ม trigger Path 1
- [x] สร้าง workflow `ocr-training` + test 5 *(v1 implemented in T027; manual Telegram end-to-end confirm flow completed in T028 follow-up / T5e)*
- [x] ตรวจ few-shot ใช้งานได้จริง (test 6-7)
- [x] อัปเดต HANDOFF.md

## Discussion
### Codex Notes (2026-02-25)

1. `OCR_FEEDBACK_API_URL` ถูกใช้แบบ multiplex ใน workflow หลัก (`ocr-invoice-processor`)
   - ไม่ได้ใช้เฉพาะ few-shot read แต่ยังถูกใช้กับ action อื่น (admission/dedupe/etc.)
   - ถ้าเปลี่ยน env ให้ชี้ `ocr-examples-api` ตรง ๆ โดยไม่มี backward compatibility จะทำให้ OCR main path fail (`ADMISSION_SERVICE_UNAVAILABLE`)

2. วิธีแก้ที่ implement จริง
   - เพิ่ม **compatibility proxy branch** ใน `ocr-examples-api`
   - action ที่ workflow หลักส่งมาและไม่ใช่ CRUD ของ `OCR_EXAMPLES` จะถูก proxy ไป `http://127.0.0.1:8787/ocr-feedback-store`
   - ทำให้ `OCR_FEEDBACK_API_URL` ชี้ `ocr-examples-api` ได้โดยไม่ทำ main OCR พัง

3. T026 integration patch
   - spec ระบุ `continueOnFail: true`
   - ใน n8n implementation ใช้ node-level `onError=continueRegularOutput` (ถูกต้องตามเวอร์ชัน node schema)

4. Telegram training path (Path 2)
   - Implement v1 ครบทั้ง command/file routes
   - ยังไม่มี persistent `pending_train` state สำหรับคำสั่ง `ถูก` / `แก้ field=value` ในระดับ production-ready
   - จึง mark test 5 เป็น partial (workflow พร้อม แต่ manual round-trip ยังไม่ verify ครบ)

## Test Results (Codex fill in)
### Implemented Workflows / IDs
- `ocr-examples-api` — `LzYmwkdRfOxbCrwB` (active)
- `ocr-learning-path1` — `8jBkNiydlIfAGyZ3` (active)
- `ocr-training` — `KW0QRXxRh9MjdPaY` (active)
- patched workflow: `ocr-feedback-receiver` — `ztJ8oCBHREUPPry6`

### OCR_EXAMPLES Sheet
- Created tab `OCR_EXAMPLES` in spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- Seed row append success (autoMapInputData)

### Test 1 — ocr-examples-api read
- **Result:** ✅ PASS
- `POST /webhook/ocr-examples-api` with `action=read` returns active examples

### Test 2 — ocr-examples-api create (pending)
- **Result:** ✅ PASS
- Returns `ok=true`, `example_id`, row appended with `active=false`

### Test 3 — ocr-examples-api approve
- **Result:** ✅ PASS
- Approve call success and read-back confirms `active=true`

### Test 4 — Path 1 trigger (simulate low accuracy feedback)
- **Result:** ✅ PASS
- `ocr-learning-path1` returns:
  - `should_pend=true`
  - `auto_activate=false`
  - creates pending example in `OCR_EXAMPLES`

### Test 5 — Path 2 (Telegram confirm flow)
- **Result:** ✅ PASS *(final status after T028 follow-up / T5e real Telegram test)*
- `ocr-training` workflow created and active
- Telegram command/file routes implemented
- Real Telegram end-to-end verified: ส่งไฟล์ → OCR preview reply → confirm path works (`T5e`, exec `151539`)

### Test 6 — OCR ใช้ few-shot จริง
- **Result:** ✅ PASS
- Main OCR execution shows `Code (Select Few-shot Examples)` output:
  - `few_shot_count > 0`
  - `few_shot_text` populated

### Test 7 — main workflow ใช้ OCR_EXAMPLES หลังตั้ง `OCR_FEEDBACK_API_URL`
- **Result:** ✅ PASS (after compat proxy fix)
- OCR initially failed with `ADMISSION_SERVICE_UNAVAILABLE` after env switch
- Added compat proxy in `ocr-examples-api`, restarted n8n, OCR returned success normally

### Additional Verification
- T026 (`ocr-feedback-receiver`) real trigger path to Path 1 verified:
  - `/webhook/ocr-feedback-kpi` still returns success
  - low-accuracy feedback creates `OCR_EXAMPLES` row via side branch
