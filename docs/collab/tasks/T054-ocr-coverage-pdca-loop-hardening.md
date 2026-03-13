# T054 — OCR Coverage Matrix + PDCA Training Loop Hardening

**Author:** Codex
**Date:** 2026-03-13
**Assignee:** Codex / CC
**Priority:** High
**Risk:** กลาง
**Depends on:** T047, T050, T052A, T052B, T052D, T052E

---

## Overview

ปัจจุบัน OCR pipeline ทำงานได้ดีขึ้นสำหรับ `fuel/electricity/fleet_card` และ vendor ที่มี canonical map แล้ว แต่ยังไม่สามารถบอกได้ชัดว่า "รองรับทุกประเภทบิล" ในระดับ production readiness เพราะ coverage และ loop quality ยังไม่ถูกวัดแบบเป็นระบบเดียวกัน

task นี้กำหนด spec เพื่อทำให้ระบบตอบได้ชัดเจนว่าแต่ละประเภทบิลอยู่ระดับ `stable/learning/unknown` และทำให้ training+feedback loop เป็น PDCA ที่วัดผลและ automate ได้จริง โดยคง human approval เฉพาะจุดที่มีความเสี่ยงสูง

---

## Scope

**In scope:**
- สร้าง canonical coverage matrix ต่อ `doc_type + vendor_code + layout_id`
- นิยามสถานะรองรับ (`stable`, `learning`, `unknown`) ด้วยเกณฑ์เชิงตัวเลข
- harden training loop (telegram correct/confirm) ให้ input parsing deterministic
- harden admin feedback loop ให้เป็น audited truth path ที่แยกจาก accepted path
- ทำ few-shot retrieval fallback 2 ชั้น (strict -> relaxed)
- เพิ่ม quality gate สำหรับ critical fields ก่อน auto-pass/confirm
- เพิ่ม KPI + report สำหรับ coverage และ loop health

**Out of scope (explicit):**
- ไม่ทำ model fine-tuning กับ provider ภายนอก
- ไม่ย้าย storage ออกจาก Google Sheets ในรอบนี้
- ไม่เปลี่ยน synchronous API contract หลักของ `/webhook/ocr-dev`

---

## Technical Spec

### 1) Coverage Registry (Single Source of Truth)

เพิ่ม logical sheet/data-view: `OCR_COVERAGE_REGISTRY` (ผ่าน `gg-data-gateway` ได้)

required fields:
- `doc_type`
- `vendor_code`
- `layout_id`
- `status` (`stable|learning|unknown`)
- `min_examples_required`
- `min_audited_cases_required`
- `critical_fill_rate_target`
- `audited_accuracy_target`
- `updated_at_iso`
- `owner`

initial policy:
- `stable` เมื่อ
  - examples active_for_prompt >= 5
  - audited cases >= 10
  - critical fill-rate >= 98%
  - audited critical accuracy >= 99%
- ถ้าไม่ถึงเกณฑ์ = `learning`
- ไม่พบ vendor/layout mapping = `unknown`

### 2) OCR Inference Path Hardening (`up1n75qEhbsXswii`)

nodes impacted:
- `Code (Document Classifier)`
- `Code (Build Few-shot Query)`
- `HTTP Read OCR_EXAMPLES`
- `Code (Select Few-shot Examples)`
- `Code (Normalize + Validate)`
- `Respond to Webhook6`

changes:
- Few-shot query strategy 2 ชั้น
  - pass-1 strict: `doc_type + canonical_vendor + layout_id`
  - pass-2 relaxed (ถ้า pass-1 count=0): `canonical_vendor + layout_id`
- classifier fallback hints:
  - vendor-tax-id map
  - filename hint
  - OCR text signal
- normalize gate:
  - ถ้า critical fields fail -> `decision=needs_review`
  - include `coverage_status` from registry in response
- response contract เพิ่ม:
  - `coverage_status`
  - `few_shot_count`
  - `retrieval_mode` (`strict|relaxed|none`)

### 3) Telegram Training Path Hardening (`KW0QRXxRh9MjdPaY`)

nodes impacted:
- `Code node: Parse Training Message`
- `Code node: Build Examples API Command`
- `Code node: Build Command Reply`

changes:
- strict command grammar + alias normalization
  - accept both `แก้ field=value` และ `- แก้ field=value`
  - multiline continuation support
  - normalized keys only (`customer_name`, `address`, `item_amount`, ...)
- reject invalid correction keys with explicit error reply
- log parse diagnostics (`parsed_keys`, `raw_command_type`) into km-log payload

### 4) Admin Feedback Path as Audited Loop (`ztJ8oCBHREUPPry6` + `jmJHPPj0OM5LcZ0n`)

changes:
- enforce `source=feedback_kpi -> case_class=audited`
- prevent audited/proxy contamination:
  - KPI source must use `metric_eligible=true`
- diff rows must always carry:
  - `vendor_code`, `layout_id`, `cluster_key`, `source`, `case_class`

### 5) Loop PDCA Contract

Define PDCA mapping:
- `Plan`: `ocr-km-suggest` pattern analysis + candidate lessons
- `Do`: OCR run + training ingestion + candidate rule generation
- `Check`: benchmark + dashboard + fill-rate + audited accuracy gates
- `Act`: approve/reject promote via review-gated flow (`ocr-learning-path1`)

automation level target:
- auto for P/D/C stages
- A stage remains human-approved for high-risk rule promotion

### 6) KPI/Monitoring

add dashboard blocks (or API payload fields):
- `coverage_by_status` (stable/learning/unknown)
- `critical_fill_rate_by_doc_type`
- `first_pass_success_rate`
- `re_correction_rate` (telegram correct ratio)
- `audited_vs_accepted_split`

alerts:
- if `stable` segment drops below threshold for 2 consecutive windows -> Telegram admin alert

---

## Security Considerations (required)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| Telegram correction text เป็น free-form | strict parser + key allowlist + value truncation |
| webhook auth drift | enforce timing-safe key checks ทุก ingress |
| sensitive text ใน logs/Telegram | mask long PII fields ใน diagnostics payload |
| side-system outage (Sheets/Telegram) | `continueOnFail=true` และ main OCR response ต้องไม่ล้ม |

**Required security controls:**
- [ ] Auth บน webhook ใหม่ทุกตัว (x-api-key vs `$env.OCR_SHARED_API_KEY`)
- [ ] Input validation + truncation ก่อน write ไป Sheet/DB
- [ ] `continueOnFail: true` บน side-system calls (Drive, Sheets, Telegram)
- [ ] Error response ไม่ส่ง internal details ออก

---

## Discussion

No concerns — proceeding as spec draft for CC review before implementation.

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Nexgen bill with trained examples | POST `/webhook/ocr-dev` | `coverage_status=learning/stable`, `few_shot_count>0`, customer/address filled |
| T2 | Fuel stable vendor | POST `/webhook/ocr-dev` | retrieval `strict`, critical fields pass |
| T3 | Telegram `แก้ ...` multiline | Telegram message | parser outputs normalized keys + success reply |
| T4 | Admin feedback submit | POST `/webhook/ocr-feedback` | TRAIN_CASES row with `case_class=audited` |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T5 | Unknown vendor no map | `coverage_status=unknown`, `needs_review=true` |
| T6 | Invalid correction key | Telegram reply explicit error, no write |
| T7 | Wrong API key | 401 |
| T8 | OCR_EXAMPLES read fail | main OCR still returns response (degraded mode) |

---

## Definition of Done

**Implemented:**
- [ ] Coverage registry schema + read path integrated
- [ ] Two-pass few-shot retrieval deployed
- [ ] Telegram parser deterministic + key allowlist
- [ ] PDCA status fields surfaced in KPI/dashboard

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [ ] gg-data coverage endpoint returns rows with expected statuses
- [ ] OCR execution evidence shows `retrieval_mode` and `few_shot_count`
- [ ] Telegram training evidence shows normalized keys + success reply
- [ ] KPI report shows audited vs accepted split + coverage metrics

**E2E Passed:**
- [ ] Exec ID: `_______` — Nexgen trained bill pass with non-empty customer/address
- [ ] Exec ID: `_______` — Unknown vendor correctly gated to needs_review

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
