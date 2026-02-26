# T029D-fix — Fix Benchmark Accuracy: vat_amount + http_0 + bm_sgas01

**Author:** Claude Code (CC)
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** High
**Risk:** ต่ำ — แก้ benchmark runner + sheet data เท่านั้น ไม่แตะ main OCR
**Depends on:** T029D (เสร็จแล้ว)

---

## Overview

T029D review พบ 3 ปัญหาที่ทำให้ baseline accuracy ต่ำกว่าความเป็นจริง (49.67% แทนที่จะเป็น ~72%+):

1. **`vat_amount` field name mismatch** — ground truth ใช้ `vat_amount` แต่ OCR output อาจใช้ชื่ออื่น
2. **`http_0` ใน 4 rows** — transport failure ถูกนับเป็น accuracy=0 ทำให้ avg ตก
3. **`bm_sgas01`** — ใช้ `.json` แทน PDF → ควร mark `skip` ไม่ใช่ `fail`

---

## Scope

**In scope:**

**Step 0 — ตรวจ vat_amount key ใน OCR output จริง**
- ดึง exec ล่าสุดของ `up1n75qEhbsXswii` → inspect `bills[0]` ใน response JSON
- หาว่า field ที่มี VAT value ใช้ชื่ออะไร (`vat_amount` / `tax_amount` / `vat` / อื่น)
- ถ้าชื่อต่างกัน → แก้ `Code (Compare vs Ground Truth)` ใน `ocr-benchmark-runner` ให้ normalize
- ถ้า OCR ไม่ emit field นี้เลย → ลบ `vat_amount` ออกจาก `fields_to_check` ใน sheet 20 rows

**Step 1 — แก้ http_0 diagnostics**
- แก้ `Code (Compare vs Ground Truth)` หรือ `Execute Command` ให้บันทึก:
  - `last_run_http_code` (แยก column หรือใน notes)
  - ถ้า http_0 → set result=`transport_fail` (ไม่ใช่ `fail`) + accuracy=null
- แก้ `Code (Build Summary)` ให้ report `transport_fail_count` แยกออกจาก `fail_count`
- re-run ดูว่า avg_accuracy คำนวณจาก `ocr_scored` rows เท่านั้น (ไม่รวม transport_fail)

**Step 2 — mark bm_sgas01 เป็น skip**
- อัปเดต sheet row `bm_sgas01`: เปลี่ยน `notes` column ให้ระบุ `SKIP: input_file_path is .json not PDF`
- แก้ runner ให้ detect `.json` extension → set result=`skip` แทน run จริง

**Step 3 — re-run benchmark และ report ผลใหม่**
- หลังแก้ครบ → trigger full run ใหม่
- report: pass/partial/fail/skip/transport_fail counts + avg_accuracy_v2

**Out of scope:**
- ห้ามแตะ main OCR workflow (`up1n75qEhbsXswii`)
- ห้ามเปลี่ยน ground truth JSON files
- ห้ามแก้ invoice_number matching logic (เป็น v1 limitation ที่ยอมรับ)

---

## Technical Spec

### ตรวจ vat_amount key

```bash
# ดู response json ของ OCR exec ล่าสุด
sqlite3 .n8n-dev/.n8n/database.sqlite "
  SELECT id FROM execution_entity
  WHERE workflowId='up1n75qEhbsXswii' AND status='success'
  ORDER BY id DESC LIMIT 1
"
# แล้ว inspect execution_data → หา bills[0] keys
```

### แก้ result type ใน Compare node

```javascript
// เพิ่ม result types:
// 'pass'           → accuracy >= 80
// 'partial'        → 40 <= accuracy < 80
// 'fail'           → accuracy < 40 (OCR ran but low accuracy)
// 'transport_fail' → http_0 หรือ curl error (OCR ไม่ได้รัน)
// 'skip'           → fixture ไม่รองรับ (non-PDF)

if (http_code === 0 || curl_exit !== 0) {
  result = 'transport_fail';
  accuracy = null;  // ไม่นับใน avg
}
if (is_skip) {
  result = 'skip';
  accuracy = null;
}
```

### Summary node — avg คำนวณจาก ocr_scored เท่านั้น

```javascript
const scored = results.filter(r => r.result !== 'transport_fail' && r.result !== 'skip');
const avg = scored.length ? scored.reduce((s,r) => s + r.accuracy, 0) / scored.length : 0;
```

---

## Security Considerations

> 1. Input ใหม่? — ไม่มี
> 2. Secret ใหม่? — ไม่มี
> 3. Sensitive data? — ไม่มี

ไม่มีประเด็น security ใหม่

---

## Discussion

_Codex: เพิ่ม concerns ที่นี่ก่อน implement_

---

## Test Plan

| # | Test | Expected |
|---|------|----------|
| T1 | Re-run benchmark หลังแก้ | avg_accuracy สูงขึ้นจาก 49.67% |
| T2 | bm_sgas01 | result=`skip`, ไม่นับใน avg |
| T3 | http_0 rows | result=`transport_fail`, ไม่นับใน avg |
| T4 | Summary Telegram | แสดง `transport_fail_count` + `skip_count` แยก |
| T5 | vat_amount | ถ้า fix mapping → rows ที่เคย miss vat_amount ควร match แล้ว |

---

## Definition of Done

**Implemented:**
- [ ] vat_amount: ตรวจ key จริง + แก้ mapping หรือลบออก
- [ ] http_0 → result=`transport_fail`, accuracy=null
- [ ] bm_sgas01 → result=`skip`
- [ ] avg คำนวณจาก `ocr_scored` เท่านั้น

**Verified:**
- [ ] Re-run exec ID: `_______` — avg_accuracy > 60%
- [ ] Sheet: transport_fail/skip rows ไม่มี accuracy value

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] Review file: `docs/collab/reviews/T029D-review.md` (update Remaining limits)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
