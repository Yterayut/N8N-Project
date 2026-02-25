# T031 — Runtime Rules flag=true E2E Smoke Test

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** High
**Risk:** ต่ำ — test แล้ว restore ทุก change กลับ
**Depends on:** T029C complete ✅

---

## Overview

T029C implement ระบบ Runtime Rules พร้อม flag=false ที่ verified แล้ว แต่ **flag=true path ยังไม่เคย E2E test** เลย ก่อนที่ human จะ enable ระบบจริงต้องรู้ก่อนว่า path นั้นทำงานถูกต้อง

Task นี้ทำ smoke test flag=true โดย:
1. เพิ่ม test rule (non-destructive `field_default`) ใน RUNTIME_RULES sheet
2. Temporarily patch IF node ให้ evaluate = true (แทนที่จะ restart n8n)
3. รัน E2E test — verify `rules_engine: 'applied'` + rule applied ใน output
4. Restore ทุก change กลับ (IF condition + rule status)

---

## Scope

**In scope:**
- เพิ่ม 1 test rule ใน `OCR_KM_RUNTIME_RULES` sheet (status=active ระหว่าง test → inactive หลัง test)
- Patch `IF (Runtime Rules Enabled?)` node: condition temporary = `true`
- รัน E2E test OCR request
- Verify output มี `rules_engine: 'applied'` และ `rules_applied` ไม่ว่าง
- Restore IF condition กลับเป็น env check
- Set test rule กลับ status=inactive
- บันทึก exec ID + output

**Out of scope:**
- ไม่ enable `OCR_RUNTIME_RULES_ENABLED=true` จริงใน .env (ไม่ restart n8n)
- ไม่ implement `field_format` rule type (T029C known limitation)
- ไม่ test `skip_validation` rule type ใน task นี้

---

## Technical Spec

### Step 1: เพิ่ม Test Rule ใน Sheet

Sheet: `OCR_KM_RUNTIME_RULES` ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`

เพิ่ม row ใหม่:

| Column | Value |
|--------|-------|
| `rule_id` | `rr_smoke_test_031` |
| `created_at` | ISO8601 now |
| `updated_at` | ISO8601 now |
| `status` | `active` (ระหว่าง test เท่านั้น) |
| `priority` | `99` (รันทีหลัง — ไม่รบกวน real rules) |
| `doc_type` | `*` |
| `vendor_tax_id` | `*` |
| `scope` | `post_normalize` |
| `rule_type` | `field_default` |
| `rule_key` | `_test_rule_marker` |
| `rule_value` | `{"field":"_test_rule_marker","default":"runtime_rules_v1"}` |
| `description` | `T031 SMOKE TEST — set inactive after test` |
| `approved_by` | `CC (test)` |
| `approved_at` | today date |
| `source_lesson_id` | _(empty)_ |
| `benchmark_result` | _(empty)_ |
| `benchmark_run_at` | _(empty)_ |

**ทำไม `_test_rule_marker`:** field นี้ไม่มีใน schema bills จริง → `field_default` logic จะ set ค่า (เพราะ field เป็น undefined = falsy) → non-destructive ต่อ real OCR output

### Step 2: Temporarily Patch IF Node

Workflow: `up1n75qEhbsXswii` (`ocr-invoice-processor`)
Node: `IF (Runtime Rules Enabled?)`

**ก่อน patch — snapshot condition เดิม:**
```
{{ String($env.OCR_RUNTIME_RULES_ENABLED || 'false').toLowerCase() === 'true' }}
```

**Patch เป็น temporary test condition:**
```
true
```

วิธี patch ผ่าน REST API:
```bash
# 1. GET workflow current state
curl -s -b cookie.txt http://localhost:5678/rest/workflows/up1n75qEhbsXswii > /tmp/t031-backup.json

# 2. Find IF node, change condition to literal true
# PATCH only the IF node parameters — ต้อง include full nodes array
# ดู pattern จาก T029C implementation
```

> **IMPORTANT:** ต้อง PATCH ด้วย full workflow nodes+connections — ห้ามแก้ JSON file โดยตรง ใช้ REST API เท่านั้น

### Step 3: รัน E2E Test

```bash
# ส่ง test request ผ่าน webhook ที่ใช้งานอยู่
curl -s -X POST http://localhost:5678/webhook/ocr-dev \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/any/test.pdf" \
  -o /tmp/t031-response.json

# หรือใช้ไฟล์ที่มีอยู่แล้ว (ดู docs/collab/tests/ หรือ tmp/)
```

**Expected output** (ในส่วน response หรือ exec logs):
```json
{
  "rules_engine": "applied",
  "rules_applied": [
    {
      "rule_id": "rr_smoke_test_031",
      "field": "_test_rule_marker",
      "old": null,
      "new": "runtime_rules_v1"
    }
  ],
  "rules_skipped": []
}
```

บันทึก:
- Exec ID จาก n8n
- `rules_engine` value
- `_test_rule_marker` value ใน bills[0]

### Step 4: Restore ทุก Change

1. **Patch IF node กลับ** เป็น condition เดิม:
   ```
   {{ String($env.OCR_RUNTIME_RULES_ENABLED || 'false').toLowerCase() === 'true' }}
   ```

2. **Set test rule กลับ status=inactive** ใน RUNTIME_RULES sheet:
   - แก้ `rr_smoke_test_031` → `status: inactive`

3. **Verify restore** — รัน E2E อีกครั้ง → verify ว่า rules nodes ไม่รัน (ตาม exec 151755 pattern)

---

## Security Considerations

1. มีจุดรับ input ใหม่ไหม? → **ไม่มี** — ใช้ webhook เดิม
2. มี secret/credential ใหม่ไหม? → **ไม่มี**
3. มีข้อมูล sensitive ที่อาจรั่วไหม? → **ไม่มี** — `_test_rule_marker` เป็น dummy field

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| IF node ค้าง = true ถ้า restore ล้มเหลว | ตรวจ verify restore step บังคับ — ถ้า restore fail = blocker |
| test rule ค้าง active ถ้า restore ล้มเหลว | ตรวจ sheet หลัง restore บังคับ |

---

## Discussion

_Codex: เพิ่ม concerns / ข้อสงสัย ที่นี่ก่อน implement_

---

## Test Plan

### Happy Path

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | flag=true + active rule → apply | E2E OCR request หลัง patch | `rules_engine: 'applied'`, `_test_rule_marker: 'runtime_rules_v1'` ใน bills |
| T2 | rules-reader return rule | GET /webhook/ocr-rules?doc_type=*&vendor=* | `{"rules":[{rule_id:"rr_smoke_test_031",...}]}` |
| T3 | restore flag=false pass-through | E2E หลัง restore | rules nodes ไม่รัน (IF false branch) |
| T4 | restore rule inactive | inspect sheet | `rr_smoke_test_031` status=inactive |

### Failure / Edge Cases

| # | Test | Expected |
|---|------|----------|
| T5 | rules-reader down ระหว่าง flag=true | continueOnFail → `rules_engine: 'no_rules'` ไม่ crash |

---

## Definition of Done

**Implemented:**
- [ ] Test rule `rr_smoke_test_031` เพิ่มแล้วใน RUNTIME_RULES sheet (status=active ระหว่าง test)
- [ ] IF node patched temporary = true

**Verified from system:**
- [ ] `rules_engine: 'applied'` ใน exec output (Exec ID: `_______`)
- [ ] `_test_rule_marker: 'runtime_rules_v1'` ปรากฏใน bills[0]
- [ ] rules-reader GET return rule `rr_smoke_test_031`

**Restored:**
- [ ] IF node condition กลับเป็น `{{ String($env.OCR_RUNTIME_RULES_ENABLED || 'false').toLowerCase() === 'true' }}`
- [ ] `rr_smoke_test_031` status=inactive ใน sheet
- [ ] Verify restore: E2E ผ่าน flag=false (exec ID: `_______`)

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] T029C-review.md checklist item "flag=true path" mark done

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:    IF node (temp=true→restored), sheet rr_smoke_test_031 (active→inactive)
Verified from:      Exec [ID] flag=true applied; Exec [ID] flag=false restored
Docs synced:        HANDOFF.md, T029C-review.md checklist
Remaining limits:
```
