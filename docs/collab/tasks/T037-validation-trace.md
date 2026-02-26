# T037 — Add validation_trace to Code (Normalize + Validate)

**Author:** Claude Code (CC)
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** Medium
**Risk:** ต่ำ — เพิ่ม field ใหม่เท่านั้น ไม่เปลี่ยน field เดิม
**Depends on:** ไม่มี (independent จาก T029D)

---

## Overview

`Code (Normalize + Validate)` ใน main OCR workflow (`up1n75qEhbsXswii`) ตอนนี้เมื่อ validation fail จะ return แค่ `critical_error_count` และ `errors: []` แต่ไม่บอกว่า **rule ไหน field ไหน** ที่ fail

ผลคือเมื่อ OCR reject request → ทั้ง user และ developer ไม่รู้ว่าผิดตรงไหน → debug ยาก → ต้องเปิด n8n execution log แต่ละครั้ง

แก้ด้วยการเพิ่ม `validation_trace` array ใน output ที่ระบุ rule, field, value, result, message ของทุก rule ที่รัน — เพิ่ม observability โดยไม่กระทบ downstream

---

## Scope

**In scope:**
- อ่าน current code ของ `Code (Normalize + Validate)` ผ่าน n8n REST API
- เพิ่ม `validation_trace` array ใน output ของทุก return path (pass และ fail)
- trace ต้องบันทึกทุก rule ที่ evaluate: rule name, field, value, result (`pass`/`fail`/`warn`), message
- ถ้า validation pass → `validation_trace` ยังต้องมี (แสดงว่า rules ใดผ่านทั้งหมด)
- เพิ่ม `validation_trace` ใน downstream response (Respond to Webhook) เพื่อ caller เห็นได้

**Out of scope:**
- ห้ามเปลี่ยน field เดิม (critical_error_count, errors, warnings, doc_type, etc.)
- ห้ามแตะ logic การ validate (แค่ instrument ไม่ใช่ refactor)
- ห้ามแตะ node อื่นนอกจาก `Code (Normalize + Validate)` และ `Respond to Webhook` (ถ้าจำเป็น)
- ห้าม split หรือ restructure node (L1 เป็น future task)

---

## Technical Spec

### ตำแหน่งใน workflow
- **Workflow ID:** `up1n75qEhbsXswii` (ocr-invoice-processor)
- **Node:** `Code (Normalize + Validate)` — ดึงโดย `name` ไม่ใช่ index

### โครงสร้าง validation_trace

```javascript
// เพิ่มใน output ทุก return path
validation_trace: [
  {
    rule: 'vendor_tax_id_format',    // ชื่อ rule — snake_case
    field: 'vendor_tax_id',          // field ที่ evaluate
    value: '123',                    // value จริง (truncate ถ้ายาวเกิน 100 chars)
    result: 'fail',                  // 'pass' | 'fail' | 'warn' | 'skip'
    message: 'must be 13 digits'     // human-readable
  },
  {
    rule: 'total_positive',
    field: 'total',
    value: -5,
    result: 'fail',
    message: 'total must be >= 0'
  },
  {
    rule: 'invoice_date_format',
    field: 'invoice_date_th',
    value: '01/02/2568',
    result: 'pass',
    message: 'ok'
  }
]
```

### Pattern การ instrument

แทนที่จะแก้ทุก rule ทีละบรรทัด ให้สร้าง helper function ก่อน:

```javascript
// เพิ่มที่ต้นของ Code node
const _trace = [];

function check(rule, field, value, condition, message, isWarn) {
  const result = condition ? 'pass' : (isWarn ? 'warn' : 'fail');
  const safeVal = (value === null || value === undefined) ? null :
    String(value).substring(0, 100);
  _trace.push({ rule, field, value: safeVal, result, message });
  return condition;
}
```

แล้วใน validation code แทน:
```javascript
// ❌ ก่อน
if (!tax_id || !/^\d{13}$/.test(tax_id)) {
  critical_error_count++;
  errors.push('vendor_tax_id invalid');
}

// ✅ หลัง
if (!check('vendor_tax_id_format', 'vendor_tax_id', tax_id,
    tax_id && /^\d{13}$/.test(tax_id), 'must be 13 digits')) {
  critical_error_count++;
}
```

### Return value — เพิ่ม validation_trace

ทุก `return [{ json: {...} }]` ต้องมี `validation_trace: _trace`:

```javascript
return [{
  json: {
    // ...fields เดิมทั้งหมด
    validation_trace: _trace
  }
}];
```

### ดึง current code

```bash
# อ่าน current Code (Normalize + Validate)
curl -s -b cookie.txt http://localhost:5678/rest/workflows/up1n75qEhbsXswii \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
node = next(n for n in d['nodes'] if n['name']=='Code (Normalize + Validate)')
print(node['parameters']['jsCode'][:500])
"
```

---

## Security Considerations

> 1. มีจุดรับ input ใหม่ไหม? — **ไม่มี** แค่เพิ่ม output field
> 2. มี secret/credential ใหม่ไหม? — **ไม่มี**
> 3. มีข้อมูล sensitive ที่อาจรั่วใน log/response/Telegram ไหม? — **value ใน trace อาจมีข้อมูล sensitive**

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| validation_trace.value อาจมี PII (tax_id, vendor_name) | truncate value ที่ 100 chars — ห้าม log ใน Telegram |
| caller เห็น internal rule names | acceptable — ช่วย debug, ไม่ใช่ security risk |

**Required security controls:**
- [x] ไม่มี input ใหม่ — ไม่ต้องมี auth check
- [x] `continueOnFail: true` ไม่เปลี่ยน (node เดิม)
- [ ] truncate value ที่ 100 chars ใน trace
- [ ] ห้ามส่ง validation_trace ไป Telegram — เฉพาะใน HTTP response เท่านั้น

---

## Discussion

_Codex: เพิ่ม concerns / ข้อสงสัย / alternative approach ที่นี่ **ก่อน implement**_
_ถ้าไม่มี → เขียน "No concerns — proceeding"_

No concerns — proceeding.

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | ส่ง OCR request ปกติ (valid doc) | POST /webhook/ocr-dev | response มี `validation_trace` array, ทุก rule `result: 'pass'` |
| T2 | ส่ง request ที่ vendor_tax_id ผิดรูปแบบ | POST /webhook/ocr-dev พร้อม tax_id สั้น | `validation_trace` มี entry `rule: 'vendor_tax_id_format', result: 'fail'` |
| T3 | ส่ง request ที่ผ่าน validation ทั้งหมด | ตรวจ n8n exec log | `validation_trace` ไม่ว่าง — มี entries ทุก rule ที่ evaluate |

### Failure / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T4 | validation_trace ต้องมีใน **ทุก return path** รวม critical_error_count > 0 | ตรวจ code ทุก `return` statement |
| T5 | value ยาว > 100 chars | ถูก truncate เป็น 100 chars |
| T6 | `nowThai sync` หลัง patch | `./scripts/verify_nowThai_sync.sh` ผ่าน |

---

## Definition of Done

> Codex: อย่า mark Done ถ้ายังไม่ครบทุก checkbox

**Implemented:**
- [x] `Code (Normalize + Validate)` ใน workflow `up1n75qEhbsXswii` มี `validation_trace` ใน output ทุก path
- [x] helper function `check()` และ `_trace` array เพิ่มแล้ว
- [x] value truncate ที่ 100 chars

**Verified from system:**
- [x] GET /rest/executions/{id} → response body มี `validation_trace` array
- [x] trace มี entry สำหรับทุก rule ที่ evaluate
- [x] Exec ID fail case: `validation_trace` มี result='fail' entries

**E2E Passed:**
- [x] Exec ID: `153324` — valid doc (`PTT-OR.pdf`) → all pass (`validation_trace` 9 entries, all `pass`)
- [x] Exec ID: `153395` — invalid doc (`fleetcard.pdf`) → trace มี fail entries (`vendor_tax_id_format=result:fail`)

**Docs synced:**
- [x] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```

```
Runtime patched:
- Live n8n workflow `up1n75qEhbsXswii` via REST PATCH
- Node `Code (Normalize + Validate)`: added `_trace`, `check()`, `x.validation_trace`
- Node `Respond to Webhook6` (main /ocr-dev success response): included `validation_trace` in response envelope

Verified from:
- `/webhook/ocr-dev` valid sample `PTT-OR.pdf` → request_id `1772112825285-75d49185ecf78`, exec `153324`, `validation_trace` present with 9 entries (all `pass`)
- `/webhook/ocr-dev` fail sample `fleetcard.pdf` → request_id `1772113299345-d4385f60d58bc`, exec `153395`, `vendor_tax_id_format` trace entry = `fail`
- `GET /rest/executions/{id}` raw response bodies for `153324` and `153395` contain matching `workflowId`, `request_id`, and `validation_trace`
- `./scripts/verify_nowThai_sync.sh` ✅

Docs synced:
- `docs/collab/tasks/T037-validation-trace.md`
- `docs/collab/HANDOFF.md`

Remaining limits:
- Execution payloads from `/rest/executions/{id}` are n8n intern-table encoded, so verification was done by raw-response matching (`workflowId` + `request_id` + `validation_trace`) rather than full semantic decode of runData.
```
