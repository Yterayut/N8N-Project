# Code Review — T052D: Trusted Example Memory and Retrieval Ranking

**Reviewer:** CC
**Reviewed commit:** REST-patched live (not committed as code change)
**Date:** 2026-03-06
**Spec:** `docs/collab/tasks/T052D-trusted-example-memory.md`
**Score:** 5/10

---

## Summary of What Was Implemented

- เพิ่ม 6 columns ใน `OCR_EXAMPLES`: `example_class`, `trust_level`, `source_case_class`, `canonical_vendor`, `layout_id`, `active_for_prompt`
- Trust ranking ใน `Code node: Format Read Response` และ `Code (Select Few-shot Examples)`: `trusted_gold=300`, `accepted_example=200`, `experimental=100`, blank=50
- `Code node: Build Create Row` ใน ocr-examples-api: assign `example_class`/`trust_level` จาก `source_case_class` automatically
- Cap 5 examples ใน `Code (Select Few-shot Examples)` ✅
- `Code (Build Few-shot Query)` ส่ง filter `active_for_prompt: true, active: true, canonical_vendor, layout_id`

---

## Verification Level

- [x] **Implemented** — new columns present in OCR_EXAMPLES, ranking logic in both read path nodes ✅
- [x] **Mechanism verified** — trust ranking clean, cap=5, fallback safe ✅
- [❌] **E2E — BLOCKED** — only 2/30 active examples accessible; only `ptt_or fuel` examples in prompt; all other vendors effectively have 0 examples

---

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| OCR_EXAMPLES schema | `gg-data?sheet=OCR_EXAMPLES` | 6 new columns present ✅ |
| Trust ranking code | node fetch | trusted_gold=300, accepted=200, experimental=100, blank=50 ✅ |
| Cap 5 | `Code (Select Few-shot Examples)` | `slice(0, 5)` ✅ |
| active_for_prompt filter | filter chain analysis | `want='true' && !yes.includes('')` → EXCLUDE ✅ (but breaks backfill) |
| Rows in prompt | OCR_EXAMPLES check | **2/30 active rows** (both ptt_or fuel) ❌ |
| Excluded active rows | OCR_EXAMPLES check | **28 active=TRUE but active_for_prompt blank** ❌ |
| Vendor coverage in prompt | examples check | Only ptt_or — Caltex/Shell/PT MAX LPG/MEA/others = 0 ❌ |

---

## Critical Issue Found

### 🔴 BLOCKER — Historical backfill ไม่ครบ: 28 active examples excluded

**ข้อมูลจริงจาก OCR_EXAMPLES:**

| ประเภท | จำนวน |
|--------|-------|
| `active=True` ทั้งหมด | 30 rows |
| `active_for_prompt=True` (เข้า prompt) | **2 rows** |
| `active=True` แต่ `active_for_prompt=blank` (excluded) | **28 rows** |
| `active=False` | 35 rows |

**28 excluded rows แยกตาม source:**
- `manual_training`: 25 rows
- `admin_feedback`: 1 row
- `original`: 1 row
- `test_cc_review`: 1 row

**2 rows ที่เข้า prompt:**
- `example_class=trusted_gold`, vendor=`ptt_or`, doc_type=`fuel`
- `example_class=accepted_example`, vendor=`ptt_or`, doc_type=`fuel`

**ผลกระทบ:**
- **ก่อน T052D:** 30 active examples ครอบคลุมหลาย vendors (Shell, Caltex, Succo, PT MAX LPG, MEA, KTB Fleet ฯลฯ)
- **หลัง T052D:** เฉพาะ 2 ptt_or examples — **vendor อื่นทุกตัวมี 0 examples ใน prompt**
- OCR accuracy สำหรับ Shell/Caltex/PT MAX LPG/MEA/Bangchak/Siam Gas อาจ degrade ทันที เพราะไม่มี few-shot examples

**Root cause:** `Code (Build Few-shot Query)` ส่ง `active_for_prompt: true` เป็น filter → `Format Read Response` กรอง rows ที่ `active_for_prompt` ว่าง → 28 historical rows ไม่ถูก return → ไม่เข้า prompt

**Codex closing note:** "ยังไม่ทำ batch mark-inactive backfill บน sheet" — แต่นี่ไม่ใช่แค่ pruning backfill คือ **activation backfill ที่ต้องทำก่อน go-live**

---

## What's Working Well

### 🟢 Trust Ranking Logic — Clean

```javascript
const classScore = (c) => {
  if (x === 'trusted_gold') return 300;
  if (x === 'accepted_example') return 200;
  if (x === 'experimental') return 100;
  return 50;
};
```

Within same class: sort by canonical_vendor → layout_id → doc_type → latest updated_at ✅

### 🟢 Auto-assign trust class on create

```javascript
if (sourceCaseClass === 'audited') exampleClass = 'trusted_gold';
else if (sourceCaseClass === 'accepted') exampleClass = 'accepted_example';
else exampleClass = 'experimental';
```
New examples created via ocr-examples-api ได้ trust class อัตโนมัติ ✅

### 🟢 Fallback safe

`(activeRows.length ? activeRows : rows)` — ถ้า API filter เข้มงวดเกินไปจน activeRows=0 จะ fallback ใช้ทุก row ✅ (แต่ในกรณีนี้ไม่ trigger เพราะ activeRows=2 > 0)

---

## Spec Compliance

| Requirement | Status |
|------------|--------|
| OCR_EXAMPLES schema extended | ✅ |
| example class promotion logic | ✅ (new rows only) |
| retrieval ranking implemented | ✅ |
| stale/duplicate pruning | ✅ (runtime filter) |
| historical backfill complete | ❌ 28/30 active rows excluded |
| all vendor coverage in prompt | ❌ only ptt_or |

---

## Merge Decision

**⚠️ CONDITIONAL APPROVAL — Fix required before trusting OCR quality**

Trust mechanism ออกแบบดี แต่ backfill ไม่ครบทำให้ effective prompt examples ลดจาก 30 → 2 ซึ่งกระทบ OCR accuracy สำหรับ vendor อื่นๆ

**Blocking condition (fix before next OCR batch):**
1. **Backfill `active_for_prompt=TRUE`** สำหรับ 28 rows ที่ `active=TRUE` แต่ `active_for_prompt` ว่าง
2. **Backfill `example_class`/`trust_level`** โดย map จาก `source` column:
   - `source='admin_feedback'` → `example_class='trusted_gold'`, `trust_level='high'`
   - `source='manual_training'` → `example_class='accepted_example'`, `trust_level='medium'`
   - `source='original'` → `example_class='accepted_example'`, `trust_level='medium'`
3. **Verify** post-backfill: `active_for_prompt=True` count ≥ 28, vendor distribution ≠ ptt_or only

**Non-blocking (fix later):**
4. `canonical_vendor`/`layout_id` backfill สำหรับ 63 blank rows — ใช้ `vendor_code` + `vendor` columns เป็น source

---

*CC Review 2026-03-06*
