# Code Review — T029C: OCR Runtime Rules Integration

**Reviewer:** CC
**Reviewed commit:** `971f51d`
**Date:** 2026-02-25
**Spec:** `docs/collab/tasks/T029C-runtime-rules.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- สร้าง sheet `OCR_KM_RUNTIME_RULES` ใน Spreadsheet พร้อม header row + 1 inactive seed rule
- สร้าง workflow `ocr-rules-reader` (ID: `dFzVzAFjdRJHbQqe`) — `GET /webhook/ocr-rules` + Sheets read + auth
- Patch main workflow `ocr-invoice-processor` (`up1n75qEhbsXswii`): เพิ่ม IF(flag) → HTTP reader → Code apply ระหว่าง Normalize+Validate → If(Need Re-ask)

---

## Verification Level

- [x] **Implemented** — code/config เขียนถูกต้องตาม spec
- [x] **Verified** — re-fetch connections จาก n8n API ยืนยัน path ถูกต้อง
- [x] **E2E Passed** — exec 151755 flag=false branch confirmed, nowThai PASS | Exec ID: `151755`

---

## Test Evidence (required)

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| IF node position | REST verify connections | Normalize→IF→(true:HTTP,false:If(Need Re-ask)) | ✅ |
| flag=false pass-through | E2E `shell.pdf` | exec 151755 success, IF false branch, rules nodes skipped | ✅ |
| rules-reader auth 401 | wrong x-api-key | HTTP 401 | ✅ |
| rules-reader auth 200 | correct x-api-key | `{"rules":[],"warnings":[]}` | ✅ |
| RUNTIME_RULES sheet | inspect spreadsheet | header + rr_test_inactive_001 row | ✅ |
| nowThai sync | `./scripts/verify_nowThai_sync.sh` | PASS | ✅ |
| webhookId on rules-reader | code inspection | webhookId UUID present (PATTERN-008) | ✅ |
| flag=true path | — | **NOT TESTED** — requires env restart | ⚠️ |

---

## What Was Done Well ✅

### 1. IF Gate — Zero Latency When Disabled
ใช้ IF node (ไม่ใช่ code check) เป็น gate ก่อน Sheets call — guarantee ว่า flag=false ไม่แตะ network เลย เป็นไปตาม concern ที่ raise ใน discuss ✅

### 2. Architecture แยก ocr-rules-reader ออกจาก main
Main workflow ไม่ต้องมี Sheets credential โดยตรง — HTTP GET ไปยัง `ocr-rules-reader` แยก ทำให้ testable + replaceable อิสระ ✅

### 3. continueOnFail ทั้ง 2 จุด
- HTTP GET rules-reader: `continueOnFail` → ถ้า reader down → rules=[] → no crash
- Google Sheets ใน reader workflow: `continueOnFail` → ถ้า Sheets ล่ม → rules=[] ✅

### 4. webhookId UUID บน rules-reader
Codex จำ PATTERN-008 และเพิ่ม `webhookId` field เอง — ป้องกัน route ไม่ register ✅

### 5. Discussion → Spec → Implement loop ทำงานดี
Codex raise 4 concerns ใน discuss mode → CC update spec → Codex implement ตาม spec ที่ update แล้ว — ไม่มี surprise ตอน review ✅

### 6. Security: x-api-key บน ocr-rules-reader
Codex เพิ่ม auth ให้ rules-reader (stricter than spec) — ป้องกัน external reads แม้ว่า endpoint นี้จะ localhost-only ✅

---

## Issues Found ❌

### 1. flag=true Path ไม่ได้ Test E2E
**Severity:** Medium
**Type:** Missing Test

`OCR_RUNTIME_RULES_ENABLED=true` path ไม่ได้ verify ว่า `rules_engine: 'applied'` ออกมาใน output จริง รวมถึง `field_default` rule apply logic ใน Code node ยัง code inspection only

**Why acceptable:** flag=true requires env restart ซึ่ง disruptive ต่อ live n8n — การ test ควรทำใน maintenance window

**Fix:** CC ทำ manual verify ตอน enable flag จริง — ก่อน enable ต้องมี approved rule ก่อนอยู่แล้ว (gate)

### 2. Code (Apply Runtime Rules) — field_format Not Fully Implemented
**Severity:** Low
**Type:** Incomplete (Known)

จาก spec pseudocode: `field_format` rule type มี `// ...` (placeholder) — ยังไม่มี regex check + transform logic

**Impact:** rule_type=`field_format` rows ใน RUNTIME_RULES จะถูก skip silently — แต่ไม่ crash

**Fix for T029C+1:** implement field_format logic เมื่อมี use case จริงครั้งแรก

---

## Security Findings (required — write "none found" if clean)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `vendor_hint` rule type blocked in Code node | — | ✅ Not implemented |
| 2 | x-api-key auth บน ocr-rules-reader | — | ✅ Added (extra protection) |
| 3 | No approved_by check in apply logic | Low | Acceptable — gate อยู่ที่ sheet status=active ซึ่ง require approved_by เป็น rule |

_Checklist ที่ตรวจ:_
- [x] vendor_hint ไม่ implement ✅
- [x] ไม่มี secret hardcoded ✅
- [x] input validation บน rules (JSON.parse try/catch → skip broken rules) ✅
- [x] continueOnFail บน Sheets + HTTP calls ✅
- [x] rule apply ใช้ write เฉพาะ field values ไม่แตะ structural fields ✅

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| flag=false = IF node (not code check) | Cleaner, no Sheets call at all | ถ้า env var ตั้ง wrong case → might not match; `.toLowerCase()` covers this |
| Separate ocr-rules-reader workflow | Testable + replaceable แยก | HTTP latency เพิ่ม ~50-200ms ตอน flag=true |
| continueOnFail → empty rules | Graceful degradation | ถ้า Sheets ล่มตอน flag=true → rules=[] → OCR ยังทำงาน แต่ไม่ apply rules (silent) |
| flag=true path not E2E tested | Can't disrupt live n8n | Must test before first human enable |

---

## Merge Decision

**APPROVED**

หมายเหตุ:
- flag=false path ทำงานถูกต้อง 100% — zero risk ต่อ production ปัจจุบัน
- flag=true path test ยังค้างอยู่ แต่ acceptable เพราะ require human enable อยู่แล้ว
- field_format incomplete แต่ไม่ crash และยังไม่มี use case จริง

**ก่อน enable `OCR_RUNTIME_RULES_ENABLED=true` ในอนาคต ต้องทำ:**
- [ ] Manual test flag=true path + verify `rules_engine: 'applied'` ใน output
- [ ] มี ≥1 approved rule ใน RUNTIME_RULES sheet
- [ ] Implement field_format ถ้ามี rule type นี้

---

## Codex Response
*(Codex fill ใน section นี้ — ใช้ `codex-exec.sh respond T029C`)*

**Date:**

### Response to Issues Raised

### Design Decisions Explained

### What I Would Do Differently Next Time

### New Patterns / Lessons Learned

### Closing Template
```
Runtime patched:    ocr-invoice-processor (up1n75qEhbsXswii, +3 nodes); ocr-rules-reader (dFzVzAFjdRJHbQqe, new)
Verified from:      exec 151755 (flag=false E2E); nowThai PASS; rules-reader auth tests
Docs synced:        T029C spec DoD, HANDOFF
Remaining limits:   flag=true path not E2E tested; field_format rule_type not fully implemented
```
