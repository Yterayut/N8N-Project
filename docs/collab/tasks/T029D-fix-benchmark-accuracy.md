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

- 2026-02-26 (Codex, pre-check): live sheet row `bm_sgas01` no longer uses `.json`; current `input_file_path` is `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/file/สยามแก๊ส.pdf` and notes already say spec listed `.json` but source PDF is used. Proceeding with generic `.json` skip handling in runner, but `bm_sgas01` itself is no longer a skip candidate on live data.

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
- [x] vat_amount: ตรวจ key จริง + แก้ mapping หรือลบออก
- [x] http_0 → result=`transport_fail`, accuracy=null
- [x] `.json` fixture → `skip` logic added (live `bm_sgas01` row is already PDF; not exercised)
- [x] avg คำนวณจาก `ocr_scored` เท่านั้น

**Verified:**
- [x] Re-run exec ID: `152579` — avg_accuracy > 60% (`75.52%`)
- [x] Sheet: transport_fail rows ไม่มี accuracy value (`skip` rows none in live batch)

**Docs synced:**
- [x] HANDOFF.md updated
- [x] Review file: `docs/collab/reviews/T029D-review.md` (update Remaining limits)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
  ocr-benchmark-runner (`vkIBCzSBUDVZH5kQ`) via n8n REST API
  - Compare node: `transport_fail` + `skip` result classes, `accuracy=null` for unscored rows
  - Summary node: avg accuracy computed from scored rows only; reports `transport_fail_count`/`skip_count`
  - Prepare/Parse/Execute nodes: generic `.json` fixture skip detection path
  - Sheet update row: writes `last_run_http_code`, `last_run_curl_exit_code`, blank accuracy for unscored rows
  - VAT mismatch mitigation: auto-remove `vat_amount` from `fields_to_check` when OCR output schema lacks VAT field; writes updated `fields_to_check` back to sheet
Verified from:
  - OCR payload schema sample (main OCR exec `152555`): `bills[0]` has no VAT field (`vat_amount`/`vat`/`tax_amount`)
  - Targeted benchmark run `152572` (`bm_sgas01`): score improved to 75% after `vat_amount` removal (row is PDF on live sheet)
  - Full benchmark rerun `152579`: `total=20`, `ocr_scored_count=16`, `transport_fail_count=4`, `skip_count=0`, `avg_accuracy_v2_pct=75.52`
  - Execution-data spot check (`152579`): `transport_fail` rows (`bm_ritta01`, `bm_fleet01`, `bm_feed03`, `bm_elec04`) have `accuracy=null` / sheet update emits blank `last_run_accuracy`
Docs synced:
  - `docs/collab/tasks/T029D-fix-benchmark-accuracy.md`
  - `docs/collab/reviews/T029D-review.md`
  - `docs/collab/HANDOFF.md`
Remaining limits:
  - `bm_sgas01` skip expectation in spec/review is stale on live sheet (row already switched to PDF before this task), so `skip_count=0` in exec `152579`
  - `.json` skip path is implemented generically but not exercised by current live 20-row batch
```
