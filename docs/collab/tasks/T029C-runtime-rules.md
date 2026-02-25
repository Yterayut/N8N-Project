# T029C — OCR Runtime Rules: Dynamic Rules Integration

**Author:** Claude Code (CC)
**Date:** 2026-02-25 (updated — T029D skipped, flag OFF is sufficient guard)
**Assignee:** Codex
**Priority:** Medium
**Risk:** สูง — กระทบ main OCR workflow แต่ feature flag OFF = zero impact by default
**Depends on:** T029B complete ✅ (T029D skipped — ไม่มี ground truth data)

---

## Overview

Patch `ocr-invoice-processor` (ID: `up1n75qEhbsXswii`) ให้อ่าน `OCR_KM_RUNTIME_RULES` sheet และ apply rules ที่ scope `post_normalize` — **แต่ default flag=false ทำให้ไม่กระทบ request ใดๆ จนกว่า human จะ enable**

**หน้าที่ของ T029C:**
1. สร้าง sheet tab `OCR_KM_RUNTIME_RULES` ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
2. เพิ่ม node `Code (Apply Runtime Rules)` ใน main OCR workflow หลัง `Code (Normalize + Validate)` และก่อน `If (Need Re-ask)`
3. Node นี้: ถ้า flag off → pass-through ทันที ถ้า flag on → อ่าน rules + apply

---

## Fail-safe Requirements (mandatory — ห้ามข้าม)

- `OCR_RUNTIME_RULES_ENABLED` env var missing หรือ `false` → **pass-through ทันที** ไม่ call Sheets เลย
- Sheets read fail (network/auth/timeout) → `continueOnFail` → ใช้ empty rules (pass-through)
- Rule parse error (JSON invalid) → **skip rule นั้น** log warning ใน output, ไม่ throw
- Rule type `vendor_hint` → **ห้าม implement ใน T029C** (prompt injection risk)
- ห้าม modify fields นอก `post_normalize` scope: ห้าม touch `gemini_raw`, `request_id`, `file_*`
- ต้อง log: `rules_applied[]`, `rules_skipped[]`, `rules_engine: 'disabled'|'no_rules'|'applied'`

---

## Sheet Schema: OCR_KM_RUNTIME_RULES

สร้าง tab ชื่อ `OCR_KM_RUNTIME_RULES` ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`

**Header row (row 1):**
```
rule_id | created_at | updated_at | status | priority | doc_type | vendor_tax_id | scope | rule_type | rule_key | rule_value | description | approved_by | approved_at | source_lesson_id | benchmark_result | benchmark_run_at
```

**Column rules:**
- `status` enum: `active` / `inactive` / `pending_approval` / `deprecated`
- `priority` number: 1=สูงสุด (apply ก่อน)
- `doc_type` / `vendor_tax_id`: ค่า `*` = match ทุก type/vendor
- `scope`: `post_normalize` เท่านั้นใน T029C
- `rule_type`: `field_format` / `field_default` / `skip_validation` (ห้าม `vendor_hint`)
- `rule_value`: JSON string — schema ขึ้นกับ rule_type (ดู T029-architecture.md Sheet 5)
- ห้าม activate rule ถ้า `approved_by` ว่าง

---

## Node ที่ต้องเพิ่มใน main workflow

### Position:
```
Code in JavaScript9
        ↓
Code (Normalize + Validate)   ← เดิม
        ↓
[NEW] Code (Apply Runtime Rules)   ← เพิ่มตรงนี้
        ↓
If (Need Re-ask)              ← เดิม
```

### Node spec:
- **Type:** Code node
- **Name:** `Code (Apply Runtime Rules)`
- **Input:** รับจาก `Code (Normalize + Validate)` output[0]
- **Output[0]:** ต่อไป `If (Need Re-ask)`

### Code logic (ให้ Codex implement ตาม pseudocode นี้):

```javascript
// 1. Feature flag check — ถ้า off → pass-through ทันที
const enabled = String($env.OCR_RUNTIME_RULES_ENABLED || 'false').toLowerCase() === 'true';
if (!enabled) {
  return [{ json: { ...$json, rules_engine: 'disabled', rules_applied: [], rules_skipped: [] } }];
}

// 2. อ่าน rules จาก Google Sheets (Codex ใช้ HTTP call ไปยัง ocr-examples-api pattern หรือ Sheets node ก็ได้)
// rules = active rules only (status === 'active') เรียง priority ASC
// ถ้า read fail → ใช้ empty rules

// 3. Filter rules ที่ match doc_type + vendor_tax_id ของ request นี้
// match logic: rule.doc_type === '*' || rule.doc_type === bills[0].doc_type
//              rule.vendor_tax_id === '*' || rule.vendor_tax_id === bills[0].vendor_tax_id

// 4. Apply rules ตาม rule_type:
//   field_format: ตรวจ field value match regex — ถ้าไม่ match และมี transform → apply transform
//   field_default: ถ้า field value ว่าง/null → set default value
//   skip_validation: เพิ่ม skip_validations[] array ไว้ใน output (downstream ใช้)
//   vendor_hint: ห้าม implement

// 5. Return bills ที่ patch แล้ว + audit log
```

### ข้อมูลที่ต้อง append ใน output:
```javascript
{
  ...existingFields,    // ทุก field เดิม ไม่ตัด
  bills: patchedBills,  // bills ที่ apply rules แล้ว
  rules_engine: 'applied',  // 'disabled' | 'no_rules' | 'applied'
  rules_applied: [...],     // [{rule_id, rule_key, field, old_value, new_value}]
  rules_skipped: [...],     // [{rule_id, rule_key, reason}]
}
```

---

## วิธีอ่าน Rules (Codex ใช้ approach นี้)

อ่าน OCR_KM_RUNTIME_RULES ผ่าน Google Sheets REST API โดยตรง (เหมือน km-logger/km-suggest ใช้):

```
GET https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/OCR_KM_RUNTIME_RULES!A:Q
```

หรือถ้าใช้ HTTP call ให้อ่าน via n8n Google Sheets node แบบ split execution node แยกต่างหาก

**แต่:** เนื่องจาก node นี้อยู่ใน main workflow ที่รัน per-request — ถ้า flag=false ต้องไม่ call Sheets เลย (latency)

---

## Scope ที่ Codex ต้องทำ

1. **สร้าง sheet tab** `OCR_KM_RUNTIME_RULES` — header row ตาม schema ด้านบน
   - Codex ทำผ่าน Google Sheets API หรือ n8n node โดยตรง
   - ใส่ **1 test rule** (inactive) ไว้เพื่อ verify schema ถูก:
     ```
     rule_id: rr_test_001
     status: inactive
     priority: 99
     doc_type: fuel
     vendor_tax_id: *
     scope: post_normalize
     rule_type: field_default
     rule_key: currency_default
     rule_value: {"field":"currency","default":"THB"}
     description: Default currency to THB if missing
     approved_by: (ว่าง — inactive ไม่ต้องมี)
     ```

2. **Patch main workflow** `up1n75qEhbsXswii`:
   - เพิ่ม node `Code (Apply Runtime Rules)` ระหว่าง `Code (Normalize + Validate)` → `If (Need Re-ask)`
   - ต้องตัด connection เดิม แล้วต่อ: Normalize → NewNode → Re-ask
   - **ต้องเพิ่ม Google Sheets node** สำหรับอ่าน RUNTIME_RULES (ถ้าไม่ทำ inline call)
     - หรือ: ทำ HTTP call ไป endpoint ที่สร้างเพิ่มใน step 3

3. **ทางเลือกที่แนะนำสำหรับ read rules** (เพื่อไม่ให้ main workflow complex เกิน):
   - สร้าง workflow `ocr-rules-reader` ที่ expose `/webhook/ocr-rules` → อ่าน sheet → return active rules
   - Main workflow เรียก HTTP GET `/webhook/ocr-rules?doc_type=X&vendor=Y` เฉพาะตอน flag=true
   - ทำให้ main workflow ไม่ต้องมี Sheets credential โดยตรง + testable แยก

4. **Verify** รัน end-to-end test กับ flag=false → ยืนยัน response ไม่เปลี่ยน
5. **Verify** รัน verify_nowThai_sync.sh ถ้า patch Code nodes ใน main workflow

---

## Definition of Done

- [ ] Sheet `OCR_KM_RUNTIME_RULES` สร้างแล้ว มี header + 1 test rule (inactive)
- [ ] `Code (Apply Runtime Rules)` node อยู่ใน main workflow ถูก position
- [ ] flag=false → request response เหมือนเดิม 100% (exec evidence)
- [ ] flag=true + inactive rules → response เหมือนเดิม (no active rules)
- [ ] `rules_engine` field อยู่ใน output เสมอ (disabled / no_rules / applied)
- [ ] `continueOnFail` หรือ try/catch บน Sheets read
- [ ] HANDOFF.md updated

---

## Discussion
*(Codex fill ก่อน implement — raise concerns ทุกข้อ)*

