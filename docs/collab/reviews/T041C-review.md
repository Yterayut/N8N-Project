# Code Review — T041C: Typhoon OCR Fallback — Direct Path (`/ocr-dev`)

**Reviewer:** CC
**Reviewed commit:** `9186093`
**Date:** 2026-02-27
**Spec:** `docs/collab/tasks/T041C-typhoon-fallback-direct.md`
**Score:** 9/10

---

## Summary of What Was Implemented

- เพิ่ม 4 nodes ใน direct path (`/ocr-dev`): `Code (Prepare Typhoon Request - Direct)` → `HTTP (Typhoon OCR - Direct)` → `Code (Reshape Typhoon Response - Direct)` → `IF (Typhoon OK? - Direct)`
- ถอด connection `If2 [TRUE] → Respond to Webhook (error)` ออก — ต่อไปที่ Typhoon chain แทน
- `IF (Typhoon OK?) [TRUE]` → `Code in JavaScript9` [input 0]; `[FALSE]` → `Respond to Webhook (error)` [input 0]
- `continueOnFail=true` + `onError=continueRegularOutput` บน HTTP node (direct) ตาม spec

---

## Verification Level

- [x] **Implemented** — ตรวจ HANDOFF.md: Codex ยืนยัน implementation เสร็จ
- [x] **Verified** — exec 153614: `If2` forced TRUE → Typhoon chain ran, `fallback_used=true`, `fallback_status=success`
- [x] **E2E Passed** — exec 153614 (Typhoon fallback) + exec 153621 (Gemini OK, normal path unaffected)

---

## Test Evidence

| Test | Method | Exec ID | Result |
|------|--------|---------|--------|
| T1: Typhoon fallback (direct) | Force If2 TRUE | `153614` | `fallback_used=true`, `fallback_status=success`, `bills_count=1` ✅ |
| T2: Gemini OK (unchanged) | Normal request | `153621` | `success=true`, `bills_count=4`, Typhoon NOT called ✅ |
| verify_nowThai_sync | Script | — | ✅ |

---

## Code Quality Assessment

### Strengths
- Spec compliance ดีมาก — implement ตาม spec ตรงทุกจุด
- `If2 [TRUE]` → Typhoon chain pattern เหมือนกับ T041B queue path — consistent
- Binary source: `Webhook_OCR_Test5.binary.files0 || files` fallback ถูกต้อง
- Reshape code: copy pattern จาก T041B — ไม่ต้องแก้อะไร เพราะ format เดิม
- `continueOnFail: true` + `onError: continueRegularOutput` ถูกต้อง

### Minor Issues
- T3 (ทั้ง Gemini + Typhoon fail) ไม่ได้ test explicitly — acceptable เพราะเป็น fallback path ของ fallback; `Respond to Webhook (error)` รับ `{error: 'Typhoon no response'}` และส่ง graceful 500

---

## Spec Compliance

| Requirement | Met? | Notes |
|-------------|------|-------|
| Remove `If2 [0] → Respond to Webhook (error)` | ✅ | exec 153614 ยืนยัน If2 TRUE ไม่ไปที่ error node โดยตรง |
| 4 Typhoon nodes เพิ่ม | ✅ | Prepare/HTTP/Reshape/IF |
| `IF (Typhoon OK?) [TRUE]` → `Code in JavaScript9` input 0 | ✅ | ยืนยันจาก exec |
| `IF (Typhoon OK?) [FALSE]` → `Respond to Webhook (error)` | ✅ | ตาม spec |
| Binary from `Webhook_OCR_Test5.binary.files0` | ✅ | ถูกต้อง (ต่างจาก queue path ที่ใช้ `Download file.binary.data`) |
| `verify_nowThai_sync.sh` ✅ | ✅ | |

---

## Merge Approval

**Decision: APPROVED ✅ (9/10)**

เหตุผล:
- Spec compliance ครบ
- E2E ผ่าน: Typhoon fallback ทำงานใน direct path ✅
- Normal Gemini path ไม่กระทบ ✅
- Pattern consistent กับ T041B ✅

หัก 1 คะแนน: T3 (ทั้ง 2 ล้ม) ไม่ได้ทดสอบ — minor เพราะเป็น edge ของ edge

---

## Codex Response

*(Codex กรอก ถ้ามี concern / feedback หลัง review)*
