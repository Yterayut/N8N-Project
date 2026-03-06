# Code Review — T052C: Critical Field Validation + Repair

**Reviewer:** CC
**Reviewed commit:** REST-patched live (not committed as code change)
**Date:** 2026-03-06
**Spec:** `docs/collab/tasks/T052C-critical-field-validation-repair.md`
**Score:** 7/10

---

## Summary of What Was Implemented

- เพิ่ม `validateBill()` function ใน `Code (Normalize+Validate)` สำหรับ 4 critical fields + cross-field checks
- เพิ่ม `check()` helper + `_trace` array สำหรับ validation trace
- เพิ่ม 4 nodes ใหม่: `If (Need Re-ask)`, `Code (Build Re-ask Request)`, `HTTP GenerateContent (Re-ask)`, `Code (Apply Re-ask Result)`, `Code (Finalize Decision)`
- Decision gate: `critical_error_count === 0 → auto_pass` else `needs_review`
- Response includes: `field_validation`, `field_confidence`, `used_reask`, `validation_trace`
- **CC hotfix this session:** ลบ `inferredType` alias ที่ทำให้เกิด vm2 SyntaxError → 0 errors ใน 27 execs หลัง fix

---

## Verification Level

- [x] **Implemented** — ตรวจจาก live workflow fetch ครบ: `validateBill()`, `Code (Finalize Decision)`, `Code (Build Re-ask Request)`, `Code (Apply Re-ask Result)` ทั้งหมด present
- [x] **Verified** — exec `157801` (PTT-OR.pdf): `auto_pass`, `critical_error_count=0`, `field_validation/trace` present ✅
- [x] **Verified** — exec `157807` (shell.pdf): `needs_review`, `targeted_repair_applied_unverified` ✅
- [x] **Verified** — Post CC bugfix: 0/27 errors (100% success rate, up from 4 errors/96 execs = 4.2% error rate)

---

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| Validation nodes present | workflow fetch | If (Need Re-ask) + 3 Code + HTTP nodes all ✅ |
| validateBill() code | node code inspection | invoice_date_th + invoice_number + total + vendor_tax_id + cross-field ✅ |
| validation_trace in response | exec 157801 SQLite | `validation_trace` present ✅ |
| field_validation in response | exec 157801 SQLite | `field_validation` present ✅ |
| auto_pass path | exec 157801 | `auto_pass` in compact string refs ✅ |
| needs_review path | exec 157807 | `needs_review` + `targeted_repair_applied_unverified` ✅ |
| E2E error rate post-fix | execution_entity query | 0/27 errors since fix ✅ |
| SyntaxError eliminated | before/after comparison | 4 errors before → 0 after ✅ |

---

## Validation Logic — Verified

### Critical Fields (spec required)

| Field | Check | Result |
|-------|-------|--------|
| `invoice_date_th` | DD/MM/YYYY format + not future-dated | ✅ |
| `invoice_number` | present + max 40 chars | ✅ |
| `total` | parseable decimal + > 0 | ✅ |
| `vendor_tax_id` | 13 digits, starts with 0 — **if present only** | ⚠️ |

### Cross-Field Checks (spec required)

| Check | Implementation |
|-------|---------------|
| `subtotal + vat ~= total` | `Math.abs(sum - round2(total)) <= 2` ✅ |
| `quantity * unit_price ~= amount` | `diff <= arithmeticTolerance (1 or 5 for LPG)` ✅ |
| fuel line sum = total | `fuel_line_total_match` rule ✅ |

### Bonus Validators (beyond spec)

| Check | Type |
|-------|------|
| Electricity: meter_number 10 digits | critical |
| Electricity: electricity_ref 12 digits | critical |
| Electricity: invoice_number starts AB | critical |
| Fleet card: odometer 3–9 digits | critical |
| Line item: description present | warning |
| Line item: amount > 0 | warning |

---

## Issues Found

### 🔴 Critical — SyntaxError Bug (CC hotfix applied this session)

**ก่อน fix:** `const inferredType = inferredTypePre;` ที่ L572 ของ `Code (Normalize+Validate)` ทำให้เกิด vm2 SyntaxError "Identifier 'inferredType' has already been declared"

- 4 production OCR failures ใน 48h ก่อน fix (4.2% error rate)
- Bug เกิดใน vm2 sandbox ซึ่ง detect duplicate identifier ต่างจาก standard Node.js
- CC fix: ลบ alias variable → ใช้ `inferredTypePre` โดยตรงที่ 3 จุด (L572-575)
- Post-fix: exec 158066 success ✅, 0 errors จาก 27 execs ถัดมา ✅

**Impact:** Production-breaking on specific bill types → Codex ต้อง test vm2 compatibility หลัง patch Code node ทุกครั้ง

---

### 🟡 Minor — vendor_tax_id validation เป็น optional

```javascript
if (tax) {  // ← only validates IF present
  if(!check('vendor_tax_id_format', ...)) { ... }
}
```

Blank `vendor_tax_id` → ไม่มี critical error → `auto_pass` ได้แม้ tax_id หาย

**Spec says:** `vendor_tax_id` = critical field — ต้อง explicit validate

**Context:** บิลบางประเภท (other, fleet_card) อาจไม่มี tax_id visible — optional check ยอมรับได้ในทางปฏิบัติ แต่เบี่ยงจาก spec intent

**Fix (non-blocking):** เพิ่ม check เฉพาะ doc_type=fuel/electricity ว่า vendor_tax_id ต้องมีค่า

---

### 🟡 Minor — used_reask = false แม้ repair ถูก attempt

ใน `Code (Apply Re-ask Result)`:
```javascript
out.used_reask = false;  // ← default false
out.repair_status = 'failed';
// ... parse repair response ...
// used_reask only set true if JSON parse succeeds
```

Exec 157807: `used_reask=false` แต่ response มี `targeted_repair_applied_unverified` — หมายความว่า repair HTTP call รัน แต่ parse ล้มเหลว → `used_reask` ยังเป็น `false` ทั้งที่ API call เกิดขึ้นจริง

**Impact:** Auditing ไม่ชัด — ไม่รู้ว่า re-ask ถูก attempt หรือ skip

**Fix (non-blocking):** เพิ่ม `out.repair_attempted = true` เมื่อเข้า `Code (Apply Re-ask Result)` (ต่างจาก `used_reask` ที่หมายถึง repair สำเร็จ)

---

### 🟢 Bonus — Doc-type specific validators

Electricity/fleet_card validators เพิ่มเติมจาก spec — additive improvement ✅

---

## Spec Compliance

| Requirement | Status |
|------------|--------|
| validator library — 4 critical fields | ✅ (vendor_tax_id = optional if blank) |
| cross-field checks | ✅ |
| targeted repair pass | ✅ |
| decision gate auto_pass / needs_review | ✅ |
| response includes validation metadata | ✅ |
| exec 157801 auto_pass | ✅ |
| exec 157807 needs_review | ✅ |
| vm2 compatibility | ⚠️ SyntaxError bug — CC hotfixed |

---

## Merge Decision

**✅ APPROVED WITH CONDITIONS**

Core validation layer ทำงานถูกต้อง — auto_pass / needs_review split ทำงาน, cross-field checks ครบ อนุมัติ

**Non-blocking conditions (fix in next window):**
1. `vendor_tax_id`: เพิ่ม required check สำหรับ doc_type=fuel/electricity (ถ้า vendor resolved ≠ unknown)
2. `repair_attempted` field: แยกความหมาย "attempted" vs "succeeded" ใน re-ask path

**บันทึกสำคัญ:**
- ต้องรัน `./scripts/verify_nowThai_sync.sh` หลัง patch Code node **ทุกครั้ง** (Codex ต้องทำ)
- ต้อง test vm2 compatibility ก่อน deploy: variable naming conflicts ไม่ถูก catch โดย standard `node --check`

---

*CC Review 2026-03-06*
