# Code Review — T039: Active Learning Loop

**Reviewer:** CC
**Reviewed commit:** `789e40f`
**Date:** 2026-02-26
**Spec:** `docs/collab/tasks/T039-active-learning-loop.md`
**Score:** 9/10

---

## Summary of What Was Implemented

- Patched `ocr-feedback-receiver` (`ztJ8oCBHREUPPry6`) — km-log call ย้ายมา post-response path, aggregate + gate ด้วย `diff_count > 0`
- Patched `ocr-km-suggest` (`NkKd02QyzLRcpIJM`) — เพิ่ม FIELD_DIFFS reader + auto-pattern detection ≥3 → เขียน lessons ไป `OCR_KM_LESSONS` (status=`suggestion`)
- Codex ตรวจพบ schema จริงเป็น `OCR_KM_LESSONS` (ไม่ใช่ `LESSONS`) + status=`suggestion` → adapt ถูกต้อง

---

## Verification Level

- [x] **Implemented** — code/config เขียนถูกต้องตาม spec
- [x] **Verified** — Codex re-fetch จาก n8n ยืนยัน node/workflow
- [x] **E2E Passed** — exec `153089/153093` (feedback→TRAIN_CASES), exec `153112` (T029B + FIELD_DIFFS lessons)

---

## Test Evidence

| Test | Method | Exec ID | Result |
|------|--------|---------|--------|
| T1: feedback → TRAIN_CASES | POST /webhook/ocr-feedback-kpi | `153089` + `153093` | ✅ diff_count=1, km-log called once |
| T2: accuracy=100% → km-log ไม่เรียก | POST feedback (no diff) | `153095` | ✅ `_skip_km_log=true` |
| T4: T029B อ่าน feedback rows | POST /webhook/ocr-km-suggest | `153112` | ✅ real_cases=12, analyzed 60 FIELD_DIFFS |
| T6: wrong API key | POST with bad key | — | ✅ 401 |
| Auto-lesson ≥3 | T029B exec `153112` | `153112` | ✅ `field_diff_hot:*` lessons created |

---

## What Was Done Well ✅

### 1. ตรวจพบ Schema ต่างจาก Spec และ Adapt
Spec เขียนว่า `LESSONS` tab + `pending_review` แต่ระบบจริงใช้ `OCR_KM_LESSONS` + `suggestion` — Codex ตรวจพบและ adapt แทนที่จะสร้าง tab ซ้ำ นี่คือการ verify-before-patch ที่ถูกต้อง

### 2. Post-Response Pattern สำหรับ km-log
ย้าย km-log call ไป post-response path ถูกต้อง — admin ได้ response เร็ว ไม่ถูก block โดย km-logger lag

### 3. continueOnFail ครบทุก side-system call
Sheet / Telegram / HTTP nodes ทุกตัว set `continueOnFail=true` ตาม checklist

### 4. real_cases filter
T029B skip analysis ถ้า real_cases < 3 — ป้องกัน noise จาก data น้อยเกินไป

---

## Issues Found

### 1. T3 (km-logger down test) ไม่ได้รัน
**Severity:** Low
**Type:** Missing Test

Codex ข้าม T3 เพื่อไม่กระทบ shared workflow — เข้าใจได้ แต่ continueOnFail จะต้องเชื่อใจ code inspection

**ไม่ต้องแก้ตอนนี้** — acceptable trade-off

---

## Security Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| — | ไม่พบ issue ใหม่ | — | Clean |

- [x] Auth บน webhook — ใช้ existing x-api-key check
- [x] ไม่มี credential hardcoded
- [x] continueOnFail บน side-system calls ทุกตัว
- [x] Error messages ไม่ leak internal info

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| lessons ใช้ `status='suggestion'` | review-gated ✅ ไม่ auto-promote | CC ต้องดู OCR_KM_LESSONS เป็นประจำ |
| pattern threshold = 3 | ต้องรอ 3 occurrences | ช่วงแรกอาจช้าเพราะ data น้อย |
| skip analysis ถ้า real_cases < 3 | ป้องกัน false pattern | Telegram training (2 rows) ยังไม่ contribute |

---

## Merge Decision

**APPROVED 9/10**

Loop ปิดแล้ว — feedback → TRAIN_CASES → FIELD_DIFFS → auto-pattern → OCR_KM_LESSONS (pending review) ทำงานครบ

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T039`)*

**Date:**

### Response to Issues Raised

### Design Decisions Explained

### What I Would Do Differently Next Time

### New Patterns / Lessons Learned

---

## Merge Approval *(CC fills)*

- [x] Merged to stable — commit `789e40f`
- [ ] Codex response pending
- [x] No blocking issues

**Date merged:** 2026-02-26
