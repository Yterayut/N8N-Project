# Code Review — T029B: KM Suggestion (ocr-km-suggest)

**Reviewer:** CC
**Reviewed commit:** `aa515fd` (Codex implemented via REST API — no git commit from Codex)
**Date:** 2026-02-25
**Spec:** `docs/collab/tasks/T029B-km-suggestion.md`
**Score:** 7.5/10

---

## Summary of What Was Implemented

- สร้าง workflow `ocr-km-suggest` (ID: `NkKd02QyzLRcpIJM`, 16 nodes) active=true
- Schedule ทุกวัน 06:00 Bangkok (cron `0 23 * * *` UTC) + Webhook on-demand endpoint `/ocr-km-suggest`
- อ่าน OCR_TRAIN_CASES + OCR_KM_LESSONS parallel → analyze 3 patterns (P1/P2/P3) → append suggestions → Telegram notify

---

## Verification Level

- [x] **Implemented** — code/config เขียนถูกต้องตาม spec
- [x] **Verified** — re-fetch จาก n8n API ยืนยัน 16 nodes, connections, parameters
- [x] **E2E Passed** — 5 executions all `success` | Exec IDs: 151677–151681

---

## Test Evidence (required)

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| Workflow created + active | REST GET /workflows/NkKd02QyzLRcpIJM | active=true, 16 nodes | ✅ |
| Schedule cron | inspect scheduleTrigger params | `0 23 * * *` (= Bangkok 06:00) | ✅ |
| Execution success | REST GET /executions?workflowId=NkKd02QyzLRcpIJM | exec 151681 status=success | ✅ |
| Sheets read params | REST GET nodes inspect | TRAIN_CASES→`OCR_TRAIN_CASES!A:O`, KM_LESSONS→`OCR_KM_LESSONS!A:N` | ✅ |
| Telegram parse_mode | REST GET nodes inspect | `parse_mode: Markdown`, `appendAttribution: false` | ✅ |
| source=manual filter | code inspection | `if (!cfg.include_manual && c.source === 'manual') return false` | ✅ |
| Dedup logic | code inspection | dual-layer: existingKeys (from sheet) + seenNewKeys (in-run) | ✅ |

_หมายเหตุ: executions 151677–151681 รันด้วย test data — ไม่มี live training cases จริง (TRAIN_CASES มี 7 rows source=manual ทั้งหมด) ดังนั้น `analyzed_cases` = 0 ถ้าไม่ใช้ include_manual=true_

---

## What Was Done Well ✅

### 1. Architecture Flow ชัดเจน
Schedule + Webhook dual-trigger → Auth+Config → IF(auth) → parallel Sheets reads → Merge → Analyze → IF(new?) → Append → Telegram → respond. Flow ตรงตาม spec, ไม่มี missing node.

### 2. Auth Design สะอาด
Schedule path: `isWebhook=false` → skip auth check → `_config_ok: true` เสมอ.
Webhook path: ตรวจ `x-api-key` vs `OCR_SHARED_API_KEY` env. ไม่มี hardcoded secret.

### 3. source=manual Filter ถูกต้อง
```js
if (!cfg.include_manual && c.source === 'manual') return false;
```
Default exclude manual, on-demand webhook รับ `include_manual: true` ได้ — ตรงตาม spec.

### 4. Dual Dedup ป้องกัน duplicate lesson
```js
const existingKeys = new Set(rawExisting.filter(...).map(l => [doc_type,vendor,pattern].join('|')));
const seenNewKeys = new Set();  // dedup within same run
```
ครอบคลุม both inter-run และ intra-run duplicates.

### 5. nowThai `// [SHARED]` Block ถูกต้อง
Code (Build Telegram) มี canonical block ครบ — ใช้ตามนโยบาย.

### 6. Telegram Markdown ครบ
`parse_mode: Markdown`, `appendAttribution: false`, text ใช้ `$json.telegram_text` จาก Code node.

### 7. Lesson Schema 14 fields ตรง OCR_KM_LESSONS!A:N
`lesson_id, created_at, status, doc_type, vendor_tax_id, field_affected, pattern_observed, lesson_text, suggested_action, evidence_count, source_case_ids, approved_by, approved_at, rule_id_ref` = 14 fields = columns A–N ✅

---

## Issues Found ❌

### 1. P2/P3 Dedup Keys รวม Count ทำให้ lesson ซ้ำข้ามรัน
**Severity:** Medium
**Type:** Bug / Design

P2 dedup key: `doc_type|*|high_severity_rate:67pct_7d`
P3 dedup key: `doc_type|vendor|full_ocr_failure:3x`

เมื่อข้อมูลเพิ่ม (เช่น pct เปลี่ยนจาก 67→75, count เปลี่ยนจาก 3→4) ในรันถัดไป dedup key ต่างกัน → สร้าง lesson ใหม่ทั้งที่ pattern เดิม. ผลลัพธ์: KM_LESSONS อาจมี lesson ซ้ำหลาย rows สำหรับ pattern เดียวกัน.

**Fix for T029B-patch:** ตัด count/percentage ออกจาก dedup key:
```js
// P2: ใช้แค่ doc_type + pattern_type
const patternText = `high_severity_rate`;  // ไม่ต้องใส่ pct

// P3: ใช้แค่ doc_type + vendor + pattern_type
const patternText = `full_ocr_failure`;  // ไม่ต้องใส่ count
```
ส่วน lesson_text/evidence_count ยังอัปเดตได้ตาม row ใหม่ที่ append.

### 2. Codex ไม่ Commit git — ไม่มี Code Review Trail ใน Repo
**Severity:** Low
**Type:** Process

Codex implement ผ่าน REST API แต่ไม่ commit ไฟล์ใดๆ ใน agents/codex. ทำให้ไม่มี diff ใน git สำหรับ spec compliance verification. ปัญหานี้เป็น systemic (Codex sandbox blocks git) — CC ต้อง commit HANDOFF หลัง review เสมอ.

**Fix:** กำหนดให้ Codex เขียน test script ที่ CC สามารถรัน verify ได้ (ตาม T029B spec section 7) — ถ้า Codex เขียนแล้วแต่ sandbox ขัด CC จะ commit แทน.

---

## Security Findings (required — write "none found" if clean)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Webhook auth ใช้ `x-api-key` ตรง spec | — | Clean ✅ |
| 2 | No hardcoded secrets (ใช้ `$env.OCR_SHARED_API_KEY`) | — | Clean ✅ |

_Checklist ที่ตรวจ:_
- [x] Auth/authorization บน webhook — ตรวจ `x-api-key` vs env var
- [x] Input validation — `include_manual` boolean validated via `=== true`
- [x] ไม่มี secret/credential hardcoded — ใช้ `$env.` ทั้งหมด
- [x] Error messages ไม่ leak internal info — auth error return `{ _error: 'UNAUTHORIZED', _status: 401 }` เท่านั้น
- [x] continueOnFail บน side-system calls — Sheets nodes มี `continueRegularOutput`

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| Source=manual excluded by default | ป้องกัน manual test data ปน production analysis | ถ้าต้องการ analyze manual data ต้อง pass `include_manual:true` via webhook |
| `continueRegularOutput` บน Sheets reads | Graceful degradation — ถ้า Sheets unavailable → 0 cases → 0 lessons (ไม่ crash) | false negative: lesson ไม่ generate แต่ workflow ไม่แจ้ง error |
| Pattern 2 ใช้ `c.severity` field | severity อยู่ใน TRAIN_CASES schema จาก T029A ✅ | ถ้า T029A kmlogger ไม่ได้ fill severity → P2 ไม่ fire |
| Analyze Patterns อ่าน named nodes โดยตรง (ไม่ผ่าน Merge) | ยืดหยุ่น — ได้ข้อมูลทุก row จากทั้ง 2 nodes | ถ้าชื่อ node เปลี่ยน → expression พัง |

---

## Merge Decision

**APPROVED WITH CONDITIONS**

Conditions:
- [x] ~~Commit HANDOFF.md update (CC ทำ)~~ ← CC จัดการ
- [ ] Fix dedup key ใน P2/P3 (Issue #1) — assign ให้ Codex ใน T029B-patch หรือ T029C prep
- [ ] Verify ocr-km-logger (T029A) fills `severity` field ใน OCR_TRAIN_CASES rows จริงๆ ก่อน T029C

**หมายเหตุ:** Issue #1 ไม่ block deployment ปัจจุบัน (TRAIN_CASES ยังมีแต่ manual data → analyzed_cases=0) แต่ต้อง fix ก่อน production data เข้า

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T029B`)*

**Date:**

### Response to Issues Raised

### Design Decisions Explained

### What I Would Do Differently Next Time

### New Patterns / Lessons Learned

### Closing Template
```
Runtime patched:    ocr-km-suggest (NkKd02QyzLRcpIJM, 16 nodes)
Verified from:      exec 151677–151681 all success
Docs synced:        [HANDOFF / reviews / knowledge]
Remaining limits:   P2/P3 dedup fragility; severity field dependency on T029A logger
```
