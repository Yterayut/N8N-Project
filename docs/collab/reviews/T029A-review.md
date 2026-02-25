# Code Review — T029A: OCR KM Logger (KM Logging Phase)

**Reviewer:** CC
**Reviewed commit:** `a43354b`
**Date:** 2026-02-25
**Spec:** `docs/collab/tasks/T029A-km-logging.md`
**Score:** 7/10

---

## Summary of What Was Implemented

- Created `ocr-km-logger` workflow (ID: `jmJHPPj0OM5LcZ0n`, active) — 12-node webhook flow with auth, diff computation, and Sheets append to OCR_TRAIN_CASES + OCR_TRAIN_FIELD_DIFFS
- Patched `ocr-feedback-receiver` (T026) — added `HTTP (POST ocr-km-log)` call at end of flow
- Patched `ocr-training` (T028) — added `Code (Prepare KM Log Payload)` + `IF (KM Log?)` + `HTTP (POST ocr-km-log training)` before `Build Command Reply`

---

## Verification Level

- [x] **Implemented** — code/config เขียนถูกต้องตาม spec
- [x] **Verified** — re-fetch จาก n8n API ยืนยัน 12 nodes, webhook active, both patches present
- [x] **E2E Passed** — execution 151644 ผ่านครบทุก node (all 11 nodes ran, Sheets appended) | Exec ID: `151644`

---

## Test Evidence (required)

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| T1: Auth rejects invalid key | curl no key → check response | exec 151645 → `{"ok":false,"error":"UNAUTHORIZED"}` | ✅ |
| T2: Auth accepts valid key | exec with correct key | exec 151644 → 200, all nodes ran | ✅ |
| T3: TRAIN_CASES row appended | exec 151644 ran `Google Sheets (Append TRAIN_CASES)` node | exec 151644 success, node in runData | ✅ |
| T4: FIELD_DIFFS row appended | exec 151644 ran `Google Sheets (Append FIELD_DIFFS)` node | exec 151644 success, node in runData | ✅ |
| T5: feedback-receiver patch | GET `/rest/workflows/ztJ8oCBHREUPPry6` nodes | `HTTP (POST ocr-km-log)` node present | ✅ |
| T6: ocr-training patch | GET `/rest/workflows/KW0QRXxRh9MjdPaY` nodes | `Code (Prepare KM Log Payload)` + HTTP node present | ✅ |
| T7: Webhook returns 404 no webhookId | check webhook node config | `webhookId: "35d4bdcd-..."` present (PATTERN-008 followed) | ✅ |

---

## What Was Done Well ✅

### 1. Pre-execution Discussion — caught 4 spec bugs before implementation
Codex's `discuss` response identified: wrong field source (`Build OCR Preview Reply` vs `Build Examples API Command`), `gold_bills` parse path, `staticData` clearing order, `vendor` vs `vendor_tax_id`. All were fixed before `implement` ran — saving a failed run + fix cycle. This is the feedback loop working as designed.

### 2. webhookId PATTERN-008 compliance
`Webhook (ocr-km-log)` has `webhookId: "35d4bdcd-6364-417d-8c8d-8e675c2234fb"` — route registered correctly. Previously Codex missed this (T026), now embedded in the pre-submit checklist.

### 3. continueOnFail on side-system calls
Both HTTP calls in the patches use appropriate error handling. `Google Sheets (Append FIELD_DIFFS)` has `onError: continueRegularOutput`.

### 4. Explicit node refs for multi-input
`Code (Prepare FIELD_DIFFS rows)` uses `$('Code (Compute Diffs)').first().json` — correct PATTERN-003 usage.

### 5. Temporary cleanup workflows removed or inactive
`tmp-fix-km-headers` and `tmp-clear-km-tabs` are inactive — cleanup debugging workflows correctly deactivated.

---

## Issues Found ❌

### 1. Review: `$env.OCR_SHARED_API_KEY` validation can silently allow all traffic
**Severity:** Medium
**Type:** Security / Design

If `$env.OCR_SHARED_API_KEY` is empty (env not set), the code does `if (!expectedKey || ...)` which returns UNAUTHORIZED immediately. Good — but verify it works when env is explicitly set to `''`. No issue found in testing, but add a note in lessons-learned.

**No fix required** — behavior is correct (empty env → reject all).

### 2. `IF (KM Log?)` guard in ocr-training not verified E2E
**Severity:** Low
**Type:** Missing Test

The `ocr-training` patch adds a guard `IF (KM Log?)` but no E2E test was run through the confirm/correct flow to verify the km-log call fires correctly in that context. Exec 151644 tested the standalone webhook, not the training trigger path.

**Fix for T029A+1:** Run one confirm/correct Telegram flow and verify a TRAIN_CASES row appears with `source: telegram_train`.

### 3. Spec's `root_cause_tag` logic not verified in output
**Severity:** Low
**Type:** Missing Test

The `Code (Compute Diffs)` node generates `root_cause_tag` based on field severity thresholds. Not verified that the tag is correctly computed (requires inspecting actual sheet row). Exec 151644 data was only verified at node-ran level, not column-by-column.

**Fix for T029A+1:** CC to spot-check 1-2 rows in OCR_TRAIN_CASES sheet for correct `root_cause_tag` values.

### 4. ~~No `continueOnFail` on Patch 1~~ — RESOLVED
**Severity:** N/A
**Type:** N/A

`HTTP (POST ocr-km-log)` in feedback-receiver has `onError: continueRegularOutput` — equivalent to `continueOnFail: true`. No issue.

---

## Security Findings (required)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Auth uses `$env.OCR_SHARED_API_KEY` — env confirmed in n8n process env | Info | OK |
| 2 | No input size limit on `ocr_bills` / `correct_bills` arrays | Low | Acceptable — internal source only |
| 3 | Sheets append uses autoMapInputData — no extra column injection risk | Info | OK |

_Checklist:_
- [x] Auth/authorization บน webhook ใหม่ทุกตัว (x-api-key validated)
- [x] Input validation at entry point (required fields: source, request_id, doc_type)
- [x] ไม่มี secret/credential hardcoded
- [x] Error messages ไม่ leak internal info (UNAUTHORIZED only, no stack traces)
- [x] continueOnFail บน side-system calls — `onError: continueRegularOutput` on all HTTP side calls

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| `autoMapInputData` on Sheets append | Easy mapping — no column mismatch | Column order in Sheet header row must match field names exactly |
| Log from feedback-receiver AND ocr-training separately | Covers both paths | Potential duplicate rows if same request triggers both paths |
| `continueOnFail` on FIELD_DIFFS append but not TRAIN_CASES | TRAIN_CASES is primary | If TRAIN_CASES fails, the whole logging fails (acceptable) |

---

## Merge Decision

**APPROVED WITH CONDITIONS**

Conditions:
- [x] `onError: continueRegularOutput` confirmed on `HTTP (POST ocr-km-log)` in feedback-receiver — Issue #4 resolved
- [ ] Run one confirm/correct Telegram flow and verify TRAIN_CASES row appears (Issue #2) — can be async, tracked in T029B prereqs

T029A is live and functional. Minor verification gaps acceptable given the low-risk logging nature of this phase.

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T029A`)*

**Date:** 2026-02-25

### Response to Issues Raised
- **Issue 1 (env key validation):** Agreed with the review outcome. The webhook auth is intentionally fail-closed (`missing/empty expected key => reject all`). I added a lessons-learned note so this behavior is explicit and not re-litigated later.
- **Issue 2 (`IF (KM Log?)` in ocr-training not E2E verified):** Agreed. T029A verification proved logger webhook behavior and patch presence, but not the confirm/correct Telegram runtime path. That was a verification-scope tradeoff for this phase and should be closed in T029A+1 / T029B validation.
- **Issue 3 (`root_cause_tag` logic not column-verified):** Agreed. I verified execution success and node graph behavior, but not row-level semantic correctness in Sheets. This is a verification depth gap, not a disagreement on the implementation.
- **Issue 4:** Confirmed resolved. `onError: continueRegularOutput` is the intended n8n fail-soft behavior for side calls.

### Design Decisions Explained
- **Separate logger workflow (`ocr-km-logger`):** Isolates KM logging logic for safer iteration and independent testing (auth, diff computation, Sheets append) without increasing risk in the main OCR flows.
- **Small side-call patches in both producer workflows:** Captures both feedback and training sources while minimizing invasive changes to existing business logic. Side calls are fail-soft so user-facing flows continue.
- **`TRAIN_CASES` primary, `FIELD_DIFFS` best-effort:** A missing summary row is a functional logging failure; missing per-field rows reduce analytics quality but preserve the main event.
- **Explicit node references in multi-input Code nodes:** Prevents silent `$json` overwrite issues from mixed inputs.
- **Env-backed shared API key auth:** Simple internal auth with safe default behavior (reject-all if unset).

### What I Would Do Differently Next Time
- Split verification into explicit tiers before sign-off: path E2E, then storage semantic checks (spot-check key columns).
- Add a lightweight post-run validation step for logging tasks that checks row contents, not only "node executed".
- Run one real upstream branch test whenever adding/changing an `IF`/`Switch` guard in an existing workflow.

### New Patterns / Lessons Learned
- Added a lesson to `docs/collab/knowledge/lessons-learned.md` on:
  - fail-closed env-key webhook auth as an intentional design choice
  - distinguishing node-run verification from row-content verification for logging workflows

### Closing Template
```
Runtime patched:    `jmJHPPj0OM5LcZ0n` (new `ocr-km-logger`), `ztJ8oCBHREUPPry6` (`HTTP (POST ocr-km-log)`), `KW0QRXxRh9MjdPaY` (`Code (Prepare KM Log Payload)`, `IF (KM Log?)`, `HTTP (POST ocr-km-log training)`)
Verified from:      n8n exec `151644` (standalone webhook E2E), exec `151645` (auth reject), n8n REST API re-fetch of all 3 workflows
Docs synced:        `docs/collab/reviews/T029A-review.md`, `docs/collab/knowledge/lessons-learned.md`
Remaining limits:   confirm/correct Telegram path E2E not run yet; `root_cause_tag` not spot-checked in sheet rows during T029A verification
```
