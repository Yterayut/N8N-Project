# Session Retrospective — 2026-03-12 (health-kpi-analysis)

## 1. Git Summary

No new commits this session. Only system change was a REST API call to rename workflow.

Previous session ended at: `d48508b docs(retro): session retrospective 2026-03-08-data-quality-push`

---

## 2. Tasks Completed

### KPI Report Analysis (2026-03-09 08:00 report)
- **Problem:** KPI showed 94% audited accuracy — down from 100% (T053 result)
- **Finding:** 94% = only 8 `status=audited` cases counted; 1 SCG Prawet case at 50% drags result
- **Root cause of discrepancy:** Dashboard uses `status=audited` filter only → 25 `user_accepted` cases not counted
- **Formula verified:** (6×100 + 1×100 + 1×50) / 8 = 93.75% ≈ 94% ✓

### tc_1772897090067_kdtmr2 Deep Investigation
- **Problem:** Is the 50% score accurate or a measurement artifact?
- **Method:** Read execution data from km-logger exec 158905 → decoded flat-array JSON
- **Finding:** 6 genuine field diffs — total=650→970, invoice_number=304751→304734, invoice_date_th wrong, customer_name=missing, currency wrong, item_unit_price wrong
- **Decision:** 50% is LEGITIMATE historical data — do NOT change
- **Also found:** request 1772976773470 (new 100% SCG Prawet test) — NOT in TRAIN_CASES (no km-logger trigger = no formal admin feedback submitted)

### Daily Health Report Triage (2026-03-11/12)
- **Analyzed:** 4 issues flagged: OCM-Chat-BOT errors, POC/PAY OAuth, GG Health, RUNTIMERULES
- **OCR-specific check:** All OCR workflows healthy (see below)
- **Outcome:** Correctly isolated OCR system from non-OCR issues

### OCR System Health Check
- **Checked:** `up1n75qEhbsXswii`, `jmJHPPj0OM5LcZ0n`, `NkKd02QyzLRcpIJM`, `dFzVzAFjdRJHbQqe`, `XtaSg9pLDuPERtI8`, `LzYmwkdRfOxbCrwB`
- **Result:** ✅ All healthy. 182 success / 0 errors since 2026-03-07. nowThai sync OK.
- **2026-03-06 errors:** `SyntaxError: Identifier 'inferredType' has already been declared [line 569]` in `Code (Normalize + Validate)` — fixed, no recurrence
- **RUNTIMERULES=true:** Intentional (currency→THB rule active, 1 rule confirmed)

### Workflow Rename Fix
- **Problem:** `up1n75qEhbsXswii` was renamed to `ocr-training` on 2026-03-06 — caused confusion with `KW0QRXxRh9MjdPaY` (also `ocr-training`)
- **Fix:** REST PATCH → name restored to `ocr-invoice-processor`
- **Files changed:** n8n DB (via REST API)

---

## 3. Decisions Made

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| Don't change tc_1772897090067_kdtmr2 50% score | 6 genuine diffs confirmed — historical failure is accurate data | Updating to 100% would falsify historical record |
| Don't add 1772976773470 to TRAIN_CASES manually | No formal km-logger trigger = not from real feedback flow | Manual add as source=manual (deferred, lower priority) |
| Don't fix OCM-Chat-BOT typeValidation this session | Not OCR system; deferred to separate session | Fix immediately (not urgent enough) |
| POC/PAY OAuth: action deferred to Yut | Requires manual re-authorization in n8n UI — cannot automate | CC attempting to reconnect OAuth programmatically (not possible) |

---

## 4. Issues Found / Deferred

| Issue | Severity | Why Deferred | Suggested Next Action |
|-------|----------|--------------|----------------------|
| POC + PAY Google OAuth expired (EAUTH) | High | Needs Yut to manually reconnect in n8n UI | Yut: n8n Settings → Credentials → Google Sheets account 2 → reconnect |
| OCM-Chat-BOT `typeValidation: "strict"` — 17% error rate | Medium | Not OCR; chronic since 2026-02-26 | Fix: change to `"loose"` in Master Router Switch node |
| request 1772976773470 (SCG Prawet 100%) not in TRAIN_CASES | Low | No formal admin feedback submitted | Next time admin tests SCG Prawet — ensure feedback submitted via OCM chatbot |
| KPI metric gap: 25 `user_accepted` not counted in "audited" score | Medium | Architecture question needs discussion | Consider: dashboard show both "audited" AND "user_accepted" metrics side by side |
| Two workflows named `ocr-training` (`up1n75qEhbsXswii` restored, `KW0QRXxRh9MjdPaY` still same name) | Low | `up1n75qEhbsXswii` restored — `KW0QRXxRh9MjdPaY` is separate training workflow, name is fine | Consider renaming `KW0QRXxRh9MjdPaY` to `ocr-training-logger` for clarity |

---

## 5. What Went Well / What Was Hard

**Went well:**
- n8n execution data analysis: identified 6 field diffs precisely from flat-array SQLite storage
- Health triage: correctly isolated OCR (clean) from non-OCR issues (OAuth, chatbot)
- Fast workflow rename via REST API — 1 command

**Was hard:**
- n8n flat-array execution data format: indices like `d[4]` → actual error, `d[18]` → message — requires multiple round trips to decode
- Temp workflow for GSheets read returned empty body (200 but no JSON) when no rows found — hard to distinguish from error
- Webhook URL pattern: `/webhook/{WF_ID}/webhook/{path}` — still requires careful construction

---

## 6. Memory Update

Updated:
- `Key Workflow IDs`: added note about rename history for `up1n75qEhbsXswii`

No new stable patterns discovered this session (existing patterns confirmed).

---

## 7. One-Line Session Summary

Diagnosed 94% KPI as a sample-size artifact (legitimate 50% historical case + small audited set), confirmed OCR system fully healthy, and restored workflow name from erroneous rename.

---
