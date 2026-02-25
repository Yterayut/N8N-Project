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
| flag=true path | T031 live smoke (forced IF=true via REST patch, no restart) | exec `151793`: IF true branch + `HTTP GET ocr-rules-reader` ran + `rules_engine='applied'`; restore exec `151800` flag=false bypass. Note: `field_default` mutation not observed because `Code (Apply Runtime Rules)` received `bills=[]` while `bills_count=3` | ✅ |

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
| flag=true path E2E smoke done (T031) | REST patch IF=true avoids restart | Rule-read/apply path verified; separate follow-up needed for `bills=[]` vs `bills_count` runtime payload inconsistency |

---

## Merge Decision

**APPROVED**

หมายเหตุ:
- flag=false path ทำงานถูกต้อง 100% — zero risk ต่อ production ปัจจุบัน
- flag=true path smoke test ถูกทำแล้วใน T031 (forced IF=true via REST patch + restore)
- field_format incomplete แต่ไม่ crash และยังไม่มี use case จริง

**ก่อน enable `OCR_RUNTIME_RULES_ENABLED=true` ในอนาคต ต้องทำ:**
- [x] Manual test flag=true path + verify `rules_engine: 'applied'` ใน output *(T031 exec `151793`; forced IF=true via REST patch)*
- [ ] มี ≥1 approved rule ใน RUNTIME_RULES sheet
- [ ] Implement field_format ถ้ามี rule type นี้

---

## Codex Response
*(Codex fill ใน section นี้ — ใช้ `codex-exec.sh respond T029C`)*

**Date:** 2026-02-25

### Response to Issues Raised

- `flag=true` E2E coverage: agreed on the gap at review time. I later completed a non-disruptive live smoke in T031 by forcing the IF node true via REST patch (no env restart), then restored it. Verified `HTTP GET ocr-rules-reader` ran and `rules_engine='applied'` in exec `151793`, then restore exec `151800` confirmed bypass path again.
- `field_format` incomplete: intentional defer. I kept the parser/apply pipeline tolerant (skip unsupported/invalid rules, no crash) because there was no approved `field_format` use case yet. This reduced rollout risk for T029C while preserving room to implement the transform/check semantics later.

### Design Decisions Explained

- Separate `ocr-rules-reader` workflow + HTTP call from main OCR was deliberate to avoid adding Sheets credential coupling into `ocr-invoice-processor`, and to make auth/rules filtering testable independently.
- IF gate before HTTP reader was chosen specifically to guarantee zero extra latency/network calls when `OCR_RUNTIME_RULES_ENABLED=false`.
- `continueOnFail` on both reader Sheets node and main workflow HTTP node was a resilience choice: fail-open with `rules=[]` keeps OCR production path available.
- Extra `x-api-key` on `ocr-rules-reader` (beyond spec) was added because localhost-only assumptions can drift; this keeps the endpoint safe if exposure changes later.

### What I Would Do Differently Next Time

- Add a tiny synthetic test hook (or fixture payload logger) for the `Code (Apply Runtime Rules)` input shape earlier, so the `bills=[]` vs `bills_count` inconsistency is detected before flag=true smoke.
- Implement `field_format` as a no-op-capable stub with explicit `warnings` output from day one, so unsupported rule types are visible in telemetry instead of silently skipped.
- Capture a small before/after execution-data sample in the task notes when patching mid-flow logic; it makes review/debug faster.

### New Patterns / Lessons Learned

- Forced IF routing via REST patch is a practical way to smoke-test a dormant branch in live n8n without env restart, as long as you immediately restore and verify the original path.
- Runtime payload shape can differ from summary counters (`bills_count` vs actual `bills` array), so branch smoke tests should inspect the exact Code node input, not only top-level execution success.

### Closing Template
```
Runtime patched:    ocr-invoice-processor (up1n75qEhbsXswii, +3 nodes); ocr-rules-reader (dFzVzAFjdRJHbQqe, new)
Verified from:      exec 151755 (flag=false E2E); exec 151793 (forced flag=true smoke); exec 151800 (restore verify); nowThai PASS; rules-reader auth tests
Docs synced:        T029C spec DoD, HANDOFF
Remaining limits:   `field_format` rule_type not fully implemented; `Code (Apply Runtime Rules)` runtime input showed `bills=[]` vs `bills_count` mismatch in T031 smoke
```
