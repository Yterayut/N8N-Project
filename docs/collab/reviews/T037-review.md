# Code Review — T037: Add validation_trace to OCR

**Reviewer:** CC
**Reviewed commit:** `669eefa`
**Date:** 2026-02-26
**Spec:** `docs/collab/tasks/T037-validation-trace.md`
**Score:** 9/10

---

## Summary of What Was Implemented

- เพิ่ม `validation_trace` array ใน `Code (Normalize + Validate)` ใน main OCR workflow (`up1n75qEhbsXswii`) — ทุก return path (pass + fail)
- เพิ่ม `validation_trace` ใน `Respond to Webhook6` response envelope — caller เห็นได้ทันที
- ใช้ helper `check()` + `_trace` array เก็บผลทุก rule ที่ evaluate

---

## Verification Level

- [x] **Implemented** — code ถูกต้องตาม spec
- [x] **Verified** — re-fetch จาก n8n exec ยืนยัน `validation_trace` ใน response
- [x] **E2E Passed** — exec `153324` (valid) + exec `153395` (fail)

---

## Test Evidence

| Test | Exec ID | Result |
|------|---------|--------|
| Valid doc (PTT-OR.pdf) | `153324` | ✅ `validation_trace` 9 entries, all `pass` |
| Invalid doc (fleetcard.pdf) | `153395` | ✅ `vendor_tax_id_format` = `fail` ใน trace |

---

## What Was Done Well ✅

### 1. ครอบทุก path ทั้ง pass และ fail
`validation_trace` อยู่ใน output ทุก return path — ไม่มี path ที่ return โดยไม่มี trace

### 2. helper check() สะอาด
แยก trace logic ออกจาก validation logic — ไม่ refactor ที่มีอยู่ ตรงตาม spec "instrument ไม่ใช่ refactor"

### 3. E2E ครบทั้ง happy path + fail path
ทดสอบจริงด้วย 2 docs — ยืนยัน trace format ถูกต้องทั้งสองกรณี

---

## Issues Found

### 1. Verification ใช้ raw response matching (ไม่ full semantic decode)
**Severity:** Low / Informational

exec payload decode มีข้อจำกัด n8n intern encoding → Codex verify ด้วย raw match `workflowId` + `request_id` + `validation_trace` — ยอมรับได้ เพราะ request_id match ยืนยัน exec ถูกต้อง

---

## Security Findings

ไม่มี issue — เพิ่ม field ใน response เท่านั้น ไม่มี sensitive data ใน trace (field name + result เท่านั้น)

---

## Merge Decision

**APPROVED 9/10**

---

## Codex Response
*(Codex fill หลังอ่าน review — `codex-exec.sh respond T037`)*

**Date:**

### Response to Issues Raised

### Design Decisions Explained

### What I Would Do Differently Next Time

### New Patterns / Lessons Learned

---

## Merge Approval *(CC fills)*

- [x] Merged to stable — commit `669eefa`
- [ ] Codex response pending
- [x] No blocking issues

**Date merged:** 2026-02-26
