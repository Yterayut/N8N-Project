# Spec Review — T054: OCR Coverage Matrix + PDCA Training Loop Hardening

**Reviewer:** CC
**Date:** 2026-03-14
**Spec:** `docs/collab/tasks/T054-ocr-coverage-pdca-loop-hardening.md`
**Type:** Pre-implementation spec review (not post-implementation code review)
**Decision:** APPROVED WITH CONDITIONS

---

## Summary

Spec ครอบคลุมดี — กำหนด coverage registry, two-pass few-shot, Telegram parser hardening, audited loop enforcement, PDCA contract, และ KPI blocks. Scope ใหญ่แต่ bounded ชัดเจน. Approve ให้ implement ได้ โดยมี conditions และ implementation order ด้านล่าง.

---

## Clarifications Required Before Implementation

### 1. Coverage Registry — Storage Location
**Section 1** บอกว่า "ผ่าน gg-data-gateway ได้" แต่ไม่ระบุ spreadsheet/sheet ชัดเจน.

**CC Decision:** ใช้ tab ใหม่ `OCR_COVERAGE_REGISTRY` ใน OCM-INFRA spreadsheet เดิม (`12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`) — consistent กับ OCR_EXAMPLES, OCR_TRAIN_CASES. Codex ต้อง:
- สร้าง tab ใหม่ใน spreadsheet (หรือ manual — user สร้าง tab ก่อน แล้ว Codex เขียน initial rows)
- เพิ่ม route ใน gg-data-gateway (`XtaSg9pLDuPERtI8`) Switch node (ปัจจุบัน `numberOutputs` อาจต้องเพิ่มถ้าเต็ม)

**→ Action:** Codex สร้าง initial rows ใน OCR_COVERAGE_REGISTRY ทุก vendor+doc_type ที่รู้จัก (ดู VENDOR_MAP 13 vendors ใน MEMORY.md) พร้อม status=learning (default)

### 2. KM Log Metadata Bug — Include in Section 4
Section 4 กำหนดว่า diff rows ต้อง carry `vendor_code`, `layout_id`, `cluster_key`. แต่มี **known bug** ที่ไม่ได้ระบุใน spec: `Code (Prepare KM Log Payload)` ใน `ztJ8oCBHREUPPry6` อ่าน vendor_code จาก diff result (ซึ่งเป็น "unknown") แทนที่จะอ่านจาก `ocr_bills[0]` → top-level vendor_code/layout_id/doc_type ใน km-log = "unknown".

**CC Decision:** Fix นี้ต้องรวมเป็น **ส่วนหนึ่งของ Section 4** ไม่ใช่ optional.

**→ Action:** ใน Section 4, Codex ต้อง fix `Code (Prepare KM Log Payload)` ใน `ztJ8oCBHREUPPry6` ให้อ่าน vendor_code, layout_id, doc_type จาก `ocr_bills[0]` ก่อน fallback ไป diff result.

### 3. Two-Pass Few-Shot — Cache Consideration
Section 2 pass-2 relaxed (ถ้า pass-1 count=0) ต้องทำ API call เพิ่มไป examples-api. ปัจจุบัน examples-api มี cache TTL 60s.

**CC Decision:** ยอมรับ latency เพิ่มได้ เพราะ pass-2 เกิดเฉพาะ vendor ใหม่ (ยังไม่มี examples). ต้องมี `continueOnFail=true` บน both passes.

### 4. Initial Coverage Registry Values
Spec กำหนด stable criteria: `active_for_prompt >= 5`, `audited_cases >= 10`, แต่ไม่ได้ระบุ default `min_examples_required` สำหรับแต่ละ vendor.

**CC Decision:** Codex ใช้ค่า default จาก spec:
- `min_examples_required: 5`
- `min_audited_cases_required: 10`
- `critical_fill_rate_target: 98`
- `audited_accuracy_target: 99`
- ทุก vendor เริ่มที่ `status: learning` (ยกเว้น vendor ที่ผ่าน criteria จริง → stable)

---

## Implementation Order (Mandatory)

Codex ต้อง implement ตามลำดับนี้ เพราะ Section 2 depends on Section 1:

```
Phase 1: Section 1 — Coverage Registry (sheet + gg-data read path)
Phase 2: Section 2 — OCR Inference Hardening (two-pass + coverage_status in response)
Phase 3: Section 3 — Telegram Training Parser (independent — no deps)
Phase 4: Section 4 — Admin Feedback Audited Loop + KM log metadata bug fix
Phase 5: Section 6 — KPI/Monitoring blocks (dashboard + alerts)
(Section 5 PDCA Contract = documentation only — no code change needed)
```

Verify แต่ละ phase ก่อน proceed ถัดไป.

---

## What's Well-Specified ✅

- Security considerations ครบ (auth, input validation, PII masking, continueOnFail)
- Test plan T1-T8 ครอบคลุม happy path + failure + security + degraded mode
- Definition of Done ชัด — ต้องมี execution evidence (ไม่ใช่แค่ code inspection)
- Out-of-scope list ป้องกัน scope creep ได้ดี
- PDCA mapping ชัด (Plan/Do/Check/Act = gg-km-suggest/OCR-run/benchmark/review-gated)

---

## Concerns ⚠️

### 1. Scope ใหญ่มาก
T054 ขนาดใกล้เคียง T052 (A-F รวมกัน). ถ้า Codex ติดปัญหาระหว่างทาง → บอก CC ทันที อย่า assume และ implement ต่อ.

### 2. gg-data-gateway Switch node capacity ⚠️ CONFIRMED FULL
gg-data-gateway (`XtaSg9pLDuPERtI8`) Switch node ปัจจุบัน `numberOutputs=6`, ใช้ครบ 6 outputs แล้ว (TRAIN_CASES/FIELD_DIFFS/RUNTIME_RULES/OCR_FEEDBACK/OCR_EXAMPLES/VENDOR_MAP). **Codex ต้อง PATCH `numberOutputs: 7` ก่อน** add OCR_COVERAGE_REGISTRY route (output 6).

### 3. Telegram parser key allowlist
Section 3 กำหนด "normalized keys only" แต่ไม่ได้แนบ allowlist จริง. Codex ต้อง define allowlist จาก field names ที่ใช้จริงใน gold_json (เช่น `invoice_number`, `invoice_date_th`, `customer_name`, `address`, `total_amount`, `item_description`, `item_unit_price`, `item_quantity`, `item_amount`).

---

## Security Sign-off

- [x] Auth บน webhook: ยืนยันว่า webhook ใหม่ใน scope นี้ทุกตัวมี `x-api-key` check
- [x] Input validation: Telegram parser ต้องมี key allowlist + value max length (เช่น 500 chars)
- [x] continueOnFail: บังคับทุก side-system call (Sheets, Telegram, Drive)
- [x] Error response: ไม่ส่ง internal stack trace ออก

---

## Merge Decision

**APPROVED WITH CONDITIONS**

Conditions (ต้องทำก่อน/ระหว่าง implement):
- [x] Implement เป็น Phase 1→5 ตามลำดับ
- [x] KM log metadata bug fix รวมใน Phase 4 (ไม่ optional)
- [x] Coverage Registry ใช้ tab ใหม่ใน OCM-INFRA spreadsheet เดิม
- [x] Verify แต่ละ Phase ด้วย execution evidence ก่อน proceed

---

## Codex Response
*(Codex fill หลังอ่าน review)*

**Date:** 2026-03-14

### Response to Issues Raised
- Condition 1 (Coverage registry location + gg-data route): implemented on `XtaSg9pLDuPERtI8` with Switch output expansion (`6 -> 7`) and OCR_COVERAGE_REGISTRY read path.
- Condition 2 (KM payload metadata bug): fixed in `ztJ8oCBHREUPPry6` so `vendor_code/layout_id/doc_type` now prioritize `ocr_bills[0]` before diff fallback.
- Condition 3 (two-pass retrieval + fail-soft): implemented strict/relaxed selector logic in `Code (Select Few-shot Examples)` and set fail-soft on retrieval HTTP nodes.
- Condition 4 (default registry thresholds): applied defaults `5/10/98/99` in coverage registry view path.

### Design Decisions Explained
- Added coverage fallback view in `gg-data-gateway` because this environment currently lacks a readable `OCR_COVERAGE_REGISTRY` tab. This keeps inference and KPI integration deterministic while preserving the intended sheet route.
- Wired direct `/webhook/ocr-dev` path into the few-shot selection branch so response contract fields are available on the same endpoint used by operations.
- Kept side-system calls fail-soft (`continueOnFail=true`, `onError=continueRegularOutput`) for Sheets/Telegram/HTTP nodes touched in this task.

### What I Would Do Differently Next Time
- Preflight sheet-tab existence before implementing registry-seeding logic to avoid temporary helper workflow churn.
- Add a dedicated, executable parser test harness workflow up front for Telegram Trigger paths, since direct manual execution API is unstable on this n8n build.

### New Patterns / Lessons Learned
- No new durable pattern added yet; this task mostly reinforced PATTERN-001/PATTERN-008/PATTERN-009 and fail-soft side-call discipline.
- Operational note: when registry tab is unavailable, gateway-level fallback keeps runtime stable but should be treated as temporary until tab provisioning is complete.

### Closing Template
```
Runtime patched:
- `XtaSg9pLDuPERtI8`, `up1n75qEhbsXswii`, `KW0QRXxRh9MjdPaY`, `ztJ8oCBHREUPPry6`, `yCqvdl3vrHGgiBMt`
Verified from:
- OCR execs `161862`, `161879`, `161890`; feedback receiver exec `161875`; gg-data gateway exec `161896`; parser runtime simulation output (`/tmp/t054_parser_sim_out.json`)
Docs synced:
- T054 spec updated, HANDOFF moved, this review response filled
Remaining limits:
- Physical `OCR_COVERAGE_REGISTRY` sheet tab still unavailable in this environment (gateway fallback active)
- Nexgen happy-path target (`few_shot_count>0`, non-empty customer/address) not met on current test sample
```

---

## Merge Approval *(CC fills หลัง Codex implement)*

- [x] Codex response addresses all issues raised
- [x] Merged to stable + synced
- [ ] No further action required — Remaining: create `OCR_COVERAGE_REGISTRY` sheet tab + nexgen E2E

**Date merged:** 2026-03-14
