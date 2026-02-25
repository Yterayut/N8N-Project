# n8n Patterns — Shared Knowledge Base

> ทั้ง CC และ Codex เพิ่ม/แก้ได้ — ใส่ชื่อ contributor และ task ref ทุกครั้ง

---

## PATTERN-001: Multi-input Node — $json Overwrite

**Contributor:** CC | **Discovered:** T023
**Severity:** High — silent bug, ยาก debug

### ปัญหา
เมื่อ 2+ nodes เชื่อมเข้า node เดียว `$json` = output ของ node **ล่าสุดที่ run** เท่านั้น
node อื่นถูก overwrite โดยไม่มี error

### ตัวอย่าง (T023)
```
Code (Build Telegram Notification OCR) ──┐
                                          ├──► Telegram (OCR Notify)
HTTP Release Admission Slot ─────────────┘
```
HTTP node run ทีหลัง → `$json` = `{success, data}` → ไม่มี `telegram_text` → "undefined"

### Fix Pattern
```javascript
// ❌ อย่าใช้
$json.telegram_text

// ✅ ใช้ explicit node reference เสมอ
$('Code (Build Telegram Notification OCR)').first().json.telegram_text
```

### Rule
> ถ้า node มี input มากกว่า 1 → ห้ามใช้ `$json` โดยตรง — ใช้ `$('NodeName').first().json.field` เสมอ

---

## PATTERN-002: Telegram typeVersion 1.2 Auto-footer

**Contributor:** CC | **Discovered:** T023

### ปัญหา
Telegram node typeVersion 1.2 เพิ่ม footer "This message was sent automatically with n8n" อัตโนมัติ

### Fix
ห้ามเพิ่ม footer ใน Code node เอง — จะได้ double footer

---

## PATTERN-003: n8n Workflow Patch via REST API

**Contributor:** CC | **Ref:** T023, T024

### Pattern
```python
# 1. Load current workflow (ไม่ใช้ไฟล์ JSON โดยตรง)
r = subprocess.run(['curl','-s','-b',COOKIE, f'{BASE_URL}/rest/workflows/{WF_ID}'], ...)
wf = json.loads(r.stdout).get('data', {})
nodes = wf['nodes']
connections = wf['connections']

# 2. แก้ไข nodes/connections ใน memory

# 3. Patch ผ่าน REST API — ห้าม edit JSON file โดยตรง
with open('/tmp/patch.json','w') as f:
    json.dump({"nodes": nodes, "connections": connections, "settings": settings}, f)

subprocess.run(['curl','-X','PATCH', f'{BASE_URL}/rest/workflows/{WF_ID}',
    '--data-binary','@/tmp/patch.json', ...])
```

### Why `--data-binary @file` (ไม่ใช้ `-d`)
Workflow 109+ nodes → JSON ใหญ่เกิน shell argument limit → `Argument list too long`

---

## PATTERN-004: Luxon Date Format ใน n8n Expressions

**Contributor:** CC | **Discovered:** T024

### ปัญหา
`$now.format('YYYY-MM')` → `YYYY` ใน Luxon = ISO **week-based year** ไม่ใช่ calendar year

### Fix
```javascript
// ❌ ผิด
$now.format('YYYY-MM')   // → "YYYY-02" (literal + week year bug)

// ✅ ถูก
$now.format('yyyy-MM')   // → "2026-02"
```

### Luxon tokens ที่ใช้บ่อยใน n8n
| ต้องการ | Token | ตัวอย่าง |
|---------|-------|---------|
| ปี ค.ศ. | `yyyy` | 2026 |
| เดือน | `MM` | 02 |
| วัน | `dd` | 24 |
| ชั่วโมง | `HH` | 13 |

---

## PATTERN-005: n8n Execution Data — Intern Table Format

**Contributor:** CC | **Ref:** T023 debugging

### ปัญหา
`execution_data.data` ใน SQLite ไม่ใช่ plain JSON — เป็น intern table (array of values)

### Deref Pattern
```python
arr = json.loads(raw_data)
ref_map = arr[0]                              # index 0 = reference map
result_data = arr[int(ref_map['resultData'])] # deref by index
run_data = arr[int(result_data['runData'])]   # deref again

# ดึง field value
field_ref = some_dict['fieldName']
value = arr[int(field_ref)] if isinstance(field_ref, str) and field_ref.isdigit() else field_ref
```

### Warning
> ห้าม recursive deref แบบ naive — stack overflow ถ้า data ใหญ่

---

## PATTERN-006: onError: continueRegularOutput สำหรับ Optional Nodes

**Contributor:** CC | **Ref:** T024

### Use case
Node ที่ optional (ไม่ critical ต่อ main flow) เช่น Google Drive upload บน OCR path

### Config
```json
{
  "onError": "continueRegularOutput"
}
```

### Behavior
- Node สำเร็จ → output มีข้อมูลปกติ (`$json.id` = Drive file ID)
- Node fail → output = `{}` (empty json) — flow ยัง continue
- downstream node ต้อง handle กรณี empty: `driveOutput.id || 'UPLOAD_FAILED'`

---

## PATTERN-007: Binary Field Naming ใน OCR Workflow

**Contributor:** CC | **Ref:** T024

| Path | Binary Field | Source |
|------|-------------|--------|
| Fast/Standard | `files0` | Webhook → JS22 normalize |
| Heavy/Queue | `file` | Code (Split Files) rename |

> ถ้าใช้ผิด field → Google Drive upload ไม่เจอ binary → error

---

---

## PATTERN-008: Telegram Trigger webhookId Required (n8n REST API)

**Contributor:** CC | **Discovered:** T028 T5e real Telegram test

**Severity:** High — webhook returns 404 silently, no error in n8n

### ปัญหา
เมื่อสร้าง workflow ที่มี Telegram Trigger ผ่าน REST API (PATCH/POST) โดยไม่ระบุ `webhookId`:
- n8n ลงทะเบียน webhook URL แบบ path-based: `/webhook/{workflowId}/telegram trigger/webhook`
- URL นี้ return 404 เมื่อ Telegram ส่ง update มา
- ไม่มี error log ใน n8n — message ถูก drop เงียบๆ

### Fix
ต้องใส่ `webhookId` UUID ใน Telegram Trigger node เสมอ:
```json
{
  "type": "n8n-nodes-base.telegramTrigger",
  "webhookId": "b542ef86-816c-48b7-a581-0d6d632d600a"
}
```
หลัง PATCH ต้อง toggle workflow inactive → active เพื่อ re-register webhook URL ใหม่

---

## PATTERN-009: Code Node Binary Data Loss

**Contributor:** CC | **Discovered:** T028 T5e real Telegram test

**Severity:** High — silent bug, downstream gets no binary

### ปัญหา
Code node ที่ `return [{json:{...}}]` โดยไม่ copy binary → binary data จาก parent node หายไปทั้งหมด

```javascript
// ❌ WRONG — binary จาก Telegram Trigger หาย
return [{json:{mode:'file', chat_id:'...'}}];

// downstream ที่รับไปไม่มี binary:
const src = $input.first();  // ❌ ไม่มี src.binary
```

### Fix
Downstream node ที่ต้องการ binary ต้องดึงจาก **source node** โดยตรง:
```javascript
// ✅ CORRECT — ดึง binary จาก Telegram Trigger โดยตรง
const src = $('Telegram Trigger').first();
const b = src.binary || {};
```

### กฎ
- Code node ที่ return item ใหม่ → **ไม่ carry binary ต่อ** (by design)
- ถ้า flow ต้องการ binary หลัง Code node → ดึงจาก source node เสมอ
- ทดสอบด้วย `Object.keys(src.binary||{}).length` — ถ้า = 0 แสดงว่าแหล่งผิด

---

## PATTERN-010: IF Node typeVersion vs Conditions Format (n8n 1.123.20)

**Contributor:** CC | **Discovered:** T028 T5e real Telegram test

**Severity:** High — silent routing error, ไม่มี error message

### ปัญหา
n8n 1.123.20 มี IF node 2 versions ที่ใช้ conditions format ต่างกัน:

| typeVersion | Conditions format | ใช้งานได้ |
|-------------|-------------------|-----------|
| 1 | `conditions.boolean[].operation: "equal"/"notEqual"` | ✅ |
| 2.x / 2.3 | `conditions.options.version:3 + conditions.conditions[].operator` | ✅ |
| 1 | `conditions.boolean[].operation: "isTrue"` | ❌ error: compareOperationFunctions |
| 2.3 | `conditions.boolean[].operation: "isTrue"` (v1 format) | ❌ routes all to output 0 silently |

### Fix (n8n 1.123.20)
ใช้ typeVersion 2.3 + v3 conditions format เสมอ:
```json
{
  "typeVersion": 2.3,
  "parameters": {
    "conditions": {
      "options": {"caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 3},
      "conditions": [{
        "id": "uuid-here",
        "leftValue": "={{ $json.skip }}",
        "operator": {"type": "boolean", "operation": "true", "singleValue": true}
      }],
      "combinator": "and"
    }
  }
}
```

---

## PATTERN-011: Webhook Path Collision Preflight (ก่อนสร้าง workflow ใหม่)

**Contributor:** Codex | **Discovered:** T026 review response

**Severity:** High — route วิ่งผิด workflow ได้โดยไม่มี error ชัดเจน

### ปัญหา
ใน n8n สามารถมี webhook path ซ้ำ/ชนกับ workflow อื่นได้ (โดยเฉพาะ legacy node ที่ลืมไว้ใน workflow หลัก) ทำให้ request ไปผิดปลายทาง หรือ behavior ไม่ตรงที่คาด

### Preflight Pattern
ก่อนสร้าง/patch workflow ที่มี webhook:
1. enumerate webhook nodes ใน workflows ที่เกี่ยวข้อง
2. search path ซ้ำก่อนเลือกชื่อ path ใหม่
3. ถ้าต้องเปลี่ยน path จาก spec → document เหตุผล + แจ้ง consumer endpoint owner ทันที

### Rule
> อย่า assume path ใน spec ว่าว่างอยู่จริง ต้องตรวจใน live n8n ก่อน activate webhook workflow

---

## PATTERN-012: Multi-step Telegram Training State via `workflow staticData`

**Contributor:** Codex | **Discovered:** T027/T028 follow-up

### Use case
Workflow Telegram training ที่ต้องทำหลาย step:
- ผู้ใช้ส่งไฟล์ -> OCR preview
- ผู้ใช้ตอบ `confirm` / `correct` ภายหลัง
- command รอบหลังต้องอ้างอิง OCR result รอบก่อน

### Pattern
เก็บ state ชั่วคราวเป็น `pending_train` ใน workflow static data หลังส่ง preview:
```javascript
const sd = $getWorkflowStaticData('global');
sd.pending_train = {
  request_id,
  chat_id,
  ocr_result,
  created_at: new Date().toISOString(),
};
```

แล้ว node command handler (`confirm` / `correct`) โหลด state นี้มาใช้สร้าง payload `action=create` ไป API

### Guardrails
- ถ้าไม่พบ `pending_train` -> return `_no_api` พร้อม reason (`no_pending`) แทน call API แบบ invalid
- ลบ state เฉพาะหลัง downstream create สำเร็จ (`ok=true`) เพื่อลด risk data loss
- ถ้ามีหลาย chat/operator พร้อมกัน ให้ key state ตาม `chat_id` (ไม่ใช้ key เดียว global)

---

*อัปเดตล่าสุด: 2026-02-25 by Codex*
