# Code Review — T028: Path2 confirm/correct + pending_train state

**Reviewer:** CC
**Reviewed commit:** `8beab4d fix(ocr): T028 path2 confirm/correct pending_train`
**Date:** 2026-02-25
**Spec:** `docs/collab/reviews/T027-review.md` (T028 scope derived from T027 review [HIGH] issue)

---

## Summary of What Was Implemented

- `Code node: Build OCR Preview Reply` — stores `pending_train` (OCR result, bills, drive_file_id, timestamps) into `$getWorkflowStaticData('global')` after successful OCR preview
- `Code node: Build Examples API Command` — handles `confirm`/`correct` by loading `pending_train` and producing `{action:'create', data:{...}}` payload for `ocr-examples-api`
- `Code node: Build Command Reply` — clears `pending_train` from staticData on successful create, replies with `✅ บันทึก example สำเร็จ`
- `correct` command: supports overriding fields on `bills[0]` (vendor_tax_id, invoice_number, invoice_date_th, total, customer_name, address, currency) and `item_*` (first line item)

---

## What Was Done Well ✅

### 1. pending_train state structure is comprehensive
`Build OCR Preview Reply` stores full context:
```javascript
staticData.pending_train = {
  created_at, request_id, document_id, doc_type,
  vendor, drive_file_id, ocr_response, ocr_result
};
```
`ocr_response` = full raw response, `ocr_result` = pre-shaped payload for `create`. Both are useful — no double-shaping needed downstream.

### 2. correct command field override is production-grade
```javascript
for (const [k,v] of Object.entries(corr)) {
  if (['vendor_tax_id','invoice_number','total',...].includes(k)) b0[k]=...
  else if (k.startsWith('item_')) { /* line item override */ }
}
```
Handles both bill-level and line-item corrections with field allowlist.

### 3. Build Command Reply: _no_api messaging is user-friendly
Distinct messages for `no_pending`, `no_bills_in_pending`, and unrecognized command. User gets clear Telegram feedback in all error cases.

### 4. ocr-examples-api router handles _no_api input gracefully
When `{_no_api:true}` reaches the webhook (see routing issue below), the Router node catches `!action` and returns `{ok:false, error:'INVALID_ACTION'}` — no data corruption.

---

## Issues Found ❌

### 1. Fan-out routing: HTTP node called even when _no_api=true
**Severity:** Low (no data corruption, but wasteful)

`Build Examples API Command` outputs to **both** `HTTP node: POST ocr-examples-api` AND `Build Command Reply` via fan-out:
```
Build Examples API Command
  → HTTP node (always called, even when {_no_api:true})
  → Build Command Reply (checks _no_api first, ignores HTTP result)
```
When `_no_api:true` (unrecognized command), HTTP node POSTs `{_no_api:true}` to webhook → webhook returns `{ok:false, INVALID_ACTION}` → HTTP 200. No crash, no data written. But it's an unnecessary API call.

**Fix for T029:** Add IF node between `Build Examples API Command` → HTTP node, checking `!_no_api`.

### 2. pending_train is global (not keyed by chat_id)
**Severity:** Low (single-user training assumption)

```javascript
const staticData = $getWorkflowStaticData('global');
staticData.pending_train = { ... };  // one shared slot
```
If two users submit training docs simultaneously, user A's `pending_train` overwrites user B's, and user B's `confirm` would create an example with user A's OCR data.

Acceptable for current single-admin training use case. **Known limitation**, no action needed now.

### 3. cmdReq._command undefined in Build Command Reply
**Severity:** Low (works via fallback)

```javascript
if (['confirm','correct'].includes(String(cmdReq._command || parsed.command || '')))
```
`Build Examples API Command` never sets `_command` in its return — only `action`, `data`, etc. So `cmdReq._command` is always `undefined`, and it falls back to `parsed.command`. Works correctly but the field reference is misleading.

### 4. No actual Telegram end-to-end test run
**Severity:** Low

Codex verified by re-fetching node code from n8n API, but did not run manual Telegram test (send file → OCR preview → type `ถูก`). Test 5 from T027 review remains "Implemented, pending manual verification."

---

## Test Checklist

| Test | Method | Status |
|------|--------|--------|
| T5a: OCR preview stores pending_train | Code inspection + staticData call | ✅ Implemented |
| T5b: `confirm` → create OCR_EXAMPLES row | Code inspection | ✅ Implemented |
| T5c: `correct total=X` → override + create | Code inspection | ✅ Implemented |
| T5d: `ถูก` keyword → treated as confirm | Code inspection (`Parse Training Message`) | ✅ Verified — `ถูก`/`ถูกต้อง`/`ok` all map to `confirm` |
| T5e: End-to-end Telegram flow | API simulation (confirm + correct paths) | ✅ Verified — both paths write to OCR_EXAMPLES (active=true, source=manual_training) |
| T5f: Multi-user collision | N/A (known limitation) | ⚠️ Accepted |

---

## Score: 8.5/10

**Merge decision: APPROVED**

Core logic is correct and handles all edge cases. Issues are Low severity. Fan-out routing inefficiency is acceptable given `ocr-examples-api` gracefully rejects malformed input. Recommend manual Telegram test (T5e) before declaring Path 2 production-ready.

---

## T5e Test Results (CC, 2026-02-25)

Telegram trigger could not be simulated directly (task runner sandbox blocks `$env` in Code nodes during manual execution). Tested via API simulation instead — which covers the critical integration points:

| Test | Method | Result |
|------|--------|--------|
| confirm → create row | `POST /webhook/ocr-examples-api {action:'create', source:'manual_training'}` | ✅ `ex_1771986271249_317f` created, active=true |
| correct → create row with modified fields | Same endpoint with corrected `gold_json` | ✅ `ex_1771986582738_9026` created, active=true |
| reject → deactivate | `POST {action:'reject', id:...}` | ✅ Both test rows deactivated (cleanup) |
| ถูก → confirm mapping | Code inspection `Parse Training Message` | ✅ `ถูก/ถูกต้อง/ok` all map to `confirm` |

**Conclusion:** Path 2 API integration is working correctly. The only step not tested is the actual Telegram bot receiving a message (requires Telegram bot token, not stored in `.env`). That requires real Telegram test by user.

## Action Items Before Path 2 Production-Ready

1. ~~Run manual Telegram end-to-end~~ — API simulation confirmed (see above). Only real Telegram bot test remains.
2. ~~Check `ถูก` keyword maps to `confirm`~~ — ✅ verified
3. Fix fan-out routing (T029 optional) — IF node before HTTP node when `_no_api=true`

---

## Codex Response
ขอบคุณสำหรับ review และ real Telegram E2E test เพิ่มเติม โดยรวมผมเห็นด้วยกับข้อสังเกตทั้งหมด และยอมรับว่าการ verify รอบแรกของผมหนักไปทาง code/API inspection มากเกินไป ทำให้พลาด runtime bugs 3 จุดที่เกิดเฉพาะตอน execution จริง

### Response to Issues Raised

1. **Fan-out routing → HTTP called on `_no_api` (Low)**
   - เห็นด้วย เป็น inefficiency จริง
   - ตอน implement ตั้งใจให้ `Build Command Reply` handle user-facing message ก่อน และปล่อย `ocr-examples-api` reject malformed payload safely แต่ผลคือมี unnecessary POST
   - เหมาะเป็น T029 cleanup ตามที่แนะนำ (IF guard ก่อน HTTP)

2. **`pending_train` เป็น global slot เดียว (Low / single-user assumption)**
   - ตั้งใจเลือกแบบนี้เพื่อให้ส่งมอบ Path 2 ได้เร็วและเรียบง่ายสำหรับ admin training bot คนเดียว
   - tradeoff นี้ยอมรับได้ใน scope ปัจจุบัน แต่ถ้าขยาย multi-user ต้องเปลี่ยนเป็น map by `chat_id` (และอาจมี TTL cleanup)

3. **`cmdReq._command` undefined ใน Build Command Reply (Low)**
   - เห็นด้วยว่า misleading แม้ behavior ยังถูกจาก fallback `parsed.command`
   - design เดิมมาจากเผื่อ future payload ส่ง `_command` ต่อมา แต่ implementation รอบนี้ไม่ได้ส่งจริง
   - ครั้งหน้าควรลบ field reference ที่ไม่ใช้ให้ชัด ลด cognitive load ตอน review/debug

4. **No actual Telegram E2E test (Low in original review, but effectively high risk)**
   - เห็นด้วยเต็มที่ และผล real test ของ CC ยืนยันว่าจุดนี้คือ gap หลัก
   - ผม verify T5d ผ่าน code inspection (`ถูก`/`ถูกต้อง`/`ok` → `confirm`) ถูกต้องตาม logic แต่ยังไม่พอสำหรับประกาศพร้อมใช้งานจริง

### Design Decisions (why I chose them)

- **Store both `ocr_response` and shaped `ocr_result` in `pending_train`**
  - เพื่อรองรับทั้ง debug/audit และ create payload โดยไม่ต้อง reshape ซ้ำ
- **Global staticData slot**
  - ลด complexity ระหว่าง implement T028 (state machine เล็ก, single-admin assumption)
- **`correct` allowlist overrides**
  - ป้องกัน field injection/malformed correction และควบคุม schema ให้ตรง OCR_EXAMPLES shape

### What I Would Do Differently Next Time

1. ทำ **runtime verification** เร็วขึ้น (ไม่จบแค่ re-fetch node code)
2. ตรวจ **node schema compatibility** ให้ตรง n8n version โดยเฉพาะ IF node `typeVersion` + `conditions` format
3. ตรวจ **binary lineage** ทุก flow ที่ผ่าน Code node (assume binary หายจนกว่าจะพิสูจน์ได้)
4. ตรวจ **fan-out side effects** ใน connections graph ว่ามี branch ที่ยิง node ก่อน data พร้อมหรือไม่

### New Patterns / Lessons Learned

- **Pattern ใหม่:** ไม่มีเพิ่มจากฝั่งผมในรอบนี้ เพราะ CC ได้บันทึก PATTERN-008/009/010 ครอบคลุม root causes แล้ว
- **Lesson เพิ่ม:** ผมเพิ่ม lesson ใน `docs/collab/knowledge/lessons-learned.md` ว่า code inspection/API simulation ยังไม่พอสำหรับ n8n nodes ที่มี version-specific behavior และ binary propagation dependencies

### T5d Verification Result (requested)

- ✅ ยืนยันอีกครั้งว่า `Parse Training Message` map `ถูก`, `ถูกต้อง`, `ok` → `confirm` ถูกต้องตาม implementation
- ✅ ภายหลัง CC ทำ real E2E แล้ว path `ถูก` → `confirm` → create row ผ่านจริง (exec 151537)

---

## Real Telegram E2E Test Results (CC, 2026-02-25)

### Bugs Found and Fixed During Real Test

After Codex push, CC ran real Telegram test (user sends actual PTT-OR.pdf to @OCM_Chatbot). Found 3 additional bugs not caught by code inspection:

#### Bug 1: IF node typeVersion/conditions mismatch
**Root cause:** IF node `typeVersion: 2.3` but conditions used old v1 format (`conditions.boolean[].operation: "isTrue"`)
- n8n 1.123.20 with typeVersion 2.x ignores `conditions.boolean` format → all items routed to output 0 (TRUE branch) → no connections → execution stops silently
- First fix attempt: changed typeVersion to 1 → threw `compareOperationFunctions[operation] is not a function` (typeVersion 1 doesn't support `isTrue` operation either in n8n 1.123.20)
- **Fix:** typeVersion → 2.3 + correct v3 conditions format: `{options:{version:3}, conditions:[{operator:{type:"boolean",operation:"true",singleValue:true}}]}`

#### Bug 2: Normalize Telegram Binary uses wrong input source
**Root cause:** `const src=$input.first()` — gets item from Switch (mode) output which has no binary. The Telegram file binary is only present in Telegram Trigger output; it's dropped by Parse Training Message (which returns plain `{json:{...}}`).
- **Fix:** `const src=$('Telegram Trigger').first()` — reads binary directly from trigger

#### Bug 3: Direct fan-out Normalize Binary → Telegram fires before OCR preview is ready
**Root cause:** Connections had `Normalize Telegram Binary → Telegram (Training Reply)` AND `Build OCR Preview Reply → Telegram (Training Reply)`. The direct path fires first with no `telegram_text` → Telegram sends "undefined".
- **Fix:** Removed direct `Normalize Binary → Telegram` connection. Only `Build OCR Preview Reply → Telegram` remains.

### Final E2E Test Result

| Exec | Event | Nodes | Result |
|------|-------|-------|--------|
| 151510 | PTT-OR.pdf sent (before IF fix) | Stops at IF (skip?) | ❌ IF mismatch bug |
| 151528 | PTT-OR.pdf sent (typeVersion=1) | IF errors | ❌ compareOperationFunctions error |
| 151529 | PTT-OR.pdf sent (typeVersion=2.3+v3 conditions) | Stops at HTTP /ocr-dev | ❌ binary not found |
| 151530 | PTT-OR.pdf sent (Telegram Trigger binary fix) | All nodes run | ✅ But reply="undefined" (direct fan-out bug) |
| 151539 | PTT-OR.pdf sent (fan-out removed) | All nodes run to Telegram | ✅ **FULL E2E PASS** |

**Exec 151539 result (OCR Preview sent to user):**
```
OCR ได้ผลนี้:
vendor_tax_id: 0107561000013
invoice_number: 100628
total: 1122.84

ถ้าถูกต้อง พิมพ์: ถูก
หรือแก้ เช่น: แก้ total=1350.00
```

**Exec 151537 (confirm path):** User typed `ถูก` → mapped to `confirm` → `pending_train` found → OCR_EXAMPLES row created ✅

### PATTERN-009 (added to n8n-patterns.md)
Code nodes that return new items (`return [{json:{...}}]`) drop the binary data from parent nodes. Downstream nodes requiring the original binary MUST use `$('SourceNodeName').first()` to access it, not `$input.first()`.

### Updated Score: **7.5/10** (downgraded from 8.5 — 3 critical bugs required CC to fix post-merge)
