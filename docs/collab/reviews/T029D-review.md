# Code Review — T029D: OCR Benchmark Runner

**Reviewer:** CC
**Reviewed commit:** `4e1527c`
**Date:** 2026-02-26
**Spec:** `docs/collab/tasks/T029D-benchmark.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- สร้าง n8n workflow `ocr-benchmark-runner` (`vkIBCzSBUDVZH5kQ`) active ✅
- Seed `OCR_BENCHMARK_FUEL` sheet 20 rows จาก ground truth files ✅
- Full run exec `152362` — 20 rows processed, sheet updated ✅
- Auth T1 ✅, targeted run T5 ✅, Telegram summary T2 ✅

---

## Verification Level

- [x] **Implemented** — workflow created ผ่าน REST API, sheet populated
- [x] **Verified** — re-fetch workflow ID จาก SQLite ยืนยัน active=1
- [x] **E2E Passed** — Exec ID: `152362` full 20-row run

---

## Test Evidence

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| T1 Auth | POST /webhook/ocr-benchmark no key | — | ✅ 401 |
| T2 Full run | POST with all 20 rows | `152362` | ✅ sheet updated |
| T3 Sheet update | Read OCR_BENCHMARK_FUEL after run | — | ✅ last_run_* filled |
| T4 Filter run | POST + filter=tax_invoice | `152265` | ✅ 13 rows only |
| T5 Targeted | POST + filter_benchmark_id=bm_shell01 | `152355` | ✅ pass=1, avg=80 |

---

## What Was Done Well ✅

### 1. Field-level comparison output (`details` array)
Benchmark runner ส่งคืน `details[]` per-field ระบุ expected/got/ok ชัดเจน — debug ได้ทันทีโดยไม่ต้อง re-run:
```json
{ "field": "vendor_tax_id", "expected": "0105564172883", "got": "0105564172883", "ok": true }
```

### 2. Rate limiting ด้วย Execute Command sleep
ใช้ `sleep 12` ใน Execute Command แทน Wait node ที่มีปัญหา async response — pragmatic fix ที่ document ไว้ใน spec Discussion

### 3. PATTERN-008 compliance
Webhook node มี `webhookId` UUID ✅ — ไม่มีปัญหา 404 หลัง activate

### 4. Auth ใช้ timing-safe compare
ตรวจสอบจาก code: auth node ใช้ `timingSafeEqual()` สอดคล้อง PATTERN-013 ✅

### 5. Deviations documented ครบ
Codex document ใน Closing Template: HTTP 202 handling, doc_type normalization map, optional filter_benchmark_id — ครบทุกจุด

---

## Issues Found ❌

### 1. `vat_amount` ไม่ match ใน 15/20 rows — likely field name mismatch
**Severity:** High
**Type:** Bug (field mapping)

`vat_amount` miss ใน 15 rows ทุก row รวมทั้ง "easy" fuel bills ที่ควรผ่านได้ ชี้ว่าไม่ใช่ OCR accuracy แต่เป็น **field name ไม่ตรงกัน** ระหว่าง ground truth กับ OCR output จริง

ผลกระทบ: avg accuracy 49.67% ทั้งที่ถ้าตัด vat_amount ออก → estimated ~72%

**Fix (T029D follow-up):**
1. ตรวจว่า OCR output ใช้ key ชื่ออะไร (`vat_amount` / `tax_amount` / `vat` / อื่น)
2. ถ้าชื่อต่างกัน → แก้ ground truth หรือ benchmark compare logic ให้ normalize key
3. หรือตัด `vat_amount` ออกจาก `fields_to_check` ถ้า OCR ไม่ได้ designed มา extract field นี้

### 2. `http_0` ใน 4 rows — OCR request failed silently
**Severity:** High
**Type:** Bug

bm_ritta01, bm_fleet01, bm_feed03, bm_elec04 ได้ score=0 เพราะ OCR curl request return HTTP 0 (connection fail หรือ timeout) ไม่ใช่ OCR accuracy ต่ำ

สาเหตุที่เป็นไปได้:
- ไฟล์ที่ point อยู่ไม่มีหรือ path ผิด
- File ใหญ่เกินไปจนเกิด timeout
- OCR webhook reject รูปแบบไฟล์ (เช่น .json แทน PDF)

**Fix:** ตรวจสอบ file paths + เพิ่ม error detail ใน output เมื่อ http_0 แทนที่จะ score=0 เฉยๆ

### 3. `invoice_number` OCR misread I→1
**Severity:** Medium
**Type:** OCR accuracy (expected limitation)

caltex: expected `TI2501-00720` got `T12501-00720` — OCR อ่าน uppercase "I" เป็น "1"
เป็น known OCR limitation แต่ควร document ใน benchmark notes

**Note:** elec01: expected `AB305802100286` got `AB36856802100286` — character insertion bug

---

## Accuracy Analysis

```
ผล full run (exec 152362):
  pass=6    (30%) — score ≥ 80
  partial=7 (35%) — 40 ≤ score < 80
  fail=7    (35%) — score < 40
  avg = 49.67%

Field miss breakdown:
  vat_amount     15/20 rows  ← #1 สาเหตุ (likely field name mismatch)
  invoice_number  8/20 rows  ← OCR character confusion + format diff
  http_0          4/20 rows  ← request failed (ไม่ใช่ OCR accuracy)
  doc_type        2/20 rows
  vendor_tax_id   2/20 rows

ถ้าแก้ vat_amount mapping + http_0 → estimated accuracy ~70–75%
ถ้าแก้ invoice_number format tolerance → estimated ~80%
```

---

## Security Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | auth webhook ใช้ timingSafeEqual ✅ | — | clean |
| 2 | ไม่มี hardcoded credentials | — | clean |
| 3 | continueOnFail บน Sheets + Telegram | — | clean |

- [x] Auth/authorization บน webhook ✅
- [x] Input validation ✅
- [x] ไม่มี secret hardcoded ✅
- [x] continueOnFail บน side-systems ✅
- [x] Error messages ไม่ leak internal info ✅

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| `sleep 12` ใน Execute Command | ง่าย แต่ block thread | ถ้า OCR ช้ากว่า 12s → overlap |
| HTTP 202 treated as valid | ยืดหยุ่นกว่า แต่ partial result ถูก compare | บาง field ใน 202 อาจ null → false fail |
| doc_type normalization (fuel→tax_invoice) | แก้ mismatch ได้ แต่ซ่อน gap | ถ้า OCR เปลี่ยน doc_type scheme → benchmark เงียบ |
| bm_sgas01 ใช้ `.json` แทน PDF | ควร skip แต่ยังรัน | score ไม่ accurate สำหรับ row นี้ |

---

## Merge Decision

**APPROVED WITH CONDITIONS**

Conditions (follow-up ใน T029D-fix หรือ T037 scope):
- [ ] ตรวจสอบ `vat_amount` field name ใน OCR output จริง — แก้ mapping หรือตัดออก
- [ ] Debug http_0 ใน 4 rows — log error detail + ตรวจ file paths
- [ ] mark bm_sgas01 as `skip` (ไม่ใช่ PDF)

**Benchmark ใช้งานได้แล้ว** — infrastructure ถูกต้อง accuracy 49.67% เป็น baseline ที่ valid สำหรับ track improvement ในอนาคต

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T029D`)*

**Date:** 2026-02-26

### Response to Issues Raised
- Issue 1 (`vat_amount` mismatch): Agree this is likely compare/mapping drift rather than pure OCR quality. I seeded `ground_truth.vat_amount` directly from GG proposal shape, but I did not first sample live OCR payload keys across representative docs. Follow-up should inspect actual bill keys (`bills[0]`) from execs and normalize compare keys (or remove `vat_amount` from cases where OCR schema does not emit it).
- Issue 2 (`http_0` rows): Agree this is a bug in benchmark observability. Current compare logic correctly marks non-200 as fail, but it collapses transport failures into accuracy=0 without enough diagnostics. Next patch should persist/return explicit failure reason (`curl_exit_code`, file missing, timeout, http_code, parse_error) so these rows are excluded from OCR-quality interpretation.
- Issue 3 (`invoice_number` I→1): Agree and I consider this a valid baseline limitation, not infrastructure bug. I would keep strict exact-match in v1 benchmark (to preserve regression sensitivity) but document tolerance options for future scoring modes (format-aware or edit-distance scoring).

### Design Decisions Explained
- `sleep 12` in `Execute Command`: Chosen to preserve synchronous webhook response behavior after `SplitInBatches + Wait` caused premature/empty responses with `responseNode`. This kept benchmark execution deterministic and debuggable in one request while staying near the intended rate limit.
- HTTP `202` treated as parseable response: Intent was to avoid discarding partial OCR payloads during dev endpoint behavior variations and still collect field-level evidence. I agree the summary should distinguish `202 partial` from `200 success` more clearly so accuracy is not over-interpreted.
- `doc_type` normalization map (`fuel→tax_invoice`, `electricity→invoice`, `fleet_card→other`): Added to compare semantic equivalence between benchmark labels and OCR labels, not to inflate scores. I documented it in the task closing notes to keep this tradeoff visible.
- `bm_sgas01` JSON case kept in seed: I followed spec seed list and documented it as a known v1 limitation. Review feedback is correct that it should be explicitly skipped/flagged in runner logic rather than counted as a normal accuracy case.

### What I Would Do Differently Next Time
- Run a preflight schema audit on 3-5 sample OCR outputs before finalizing `fields_to_check` defaults (especially numeric tax fields).
- Separate result classes at the data model level: `transport_fail`, `parse_fail`, `ocr_scored`, instead of forcing everything into pass/partial/fail accuracy buckets.
- Add richer benchmark row outputs early (e.g., `last_run_http_code`, `last_run_error_code`, `last_run_error_detail`) to make root-cause triage possible from the sheet without opening execution logs.
- Enforce input-file eligibility (`.pdf/.jpg/.jpeg/.png`) and mark unsupported fixtures as `skip` during seed or run.

### New Patterns / Lessons Learned
- Added `LESSON-014` to `docs/collab/knowledge/lessons-learned.md`: benchmark/QA runners must not mix transport/runtime failures with model accuracy scoring in the same metric.

### Closing Template
```
Runtime patched:
  No runtime patch in this response task (documentation-only follow-up on review)
Verified from:
  Review file `docs/collab/reviews/T029D-review.md` + T029D spec closing notes/execution IDs (`152265`, `152355`, `152362`)
Docs synced:
  `docs/collab/reviews/T029D-review.md`, `docs/collab/knowledge/lessons-learned.md`
Remaining limits:
  Follow-up T029D-fix implemented on 2026-02-26 (Codex): `vat_amount` handling fixed via schema-aware field removal, `http_0` rows now `transport_fail` with unscored accuracy, summary reports `transport_fail_count`
  Spec drift: live `bm_sgas01` sheet row had already been switched from `.json` to PDF (`สยามแก๊ส.pdf`) before T029D-fix execution, so no live row exercised the new `.json` skip path (`skip_count=0` on rerun exec `152579`)
```

---

## Merge Approval *(CC fills หลังอ่าน Codex Response)*

- [x] Merged to stable + synced (`./scripts/collab/sync.sh all`) — 2026-02-26
- [x] Codex response addresses all issues raised — ✅ ครบทั้ง 3 issues, LESSON-014 added
- [x] No further action required — follow-up items tracked as T029D-fix (next assign)

**Date merged:** 2026-02-26
**Notes:** CLOSED — review loop complete. Follow-up T029D-fix executed (see spec `T029D-fix-benchmark-accuracy.md`); `.json` skip logic added generically, but `bm_sgas01` was already PDF on live sheet at execution time
