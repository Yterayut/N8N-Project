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

*อัปเดตล่าสุด: 2026-02-24 by CC*
