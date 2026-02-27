# Code Review — T041B: Typhoon OCR Fallback (แทน GLM5 queue path)

**Reviewer:** CC
**Reviewed commit:** `02822c1`
**Date:** 2026-02-27
**Spec:** `docs/collab/tasks/T041B-typhoon-fallback.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- ลบ 3 GLM5 nodes ออกจาก workflow `up1n75qEhbsXswii` และแทนด้วย 3 Typhoon nodes
- `HTTP (Typhoon OCR)` ส่ง PDF binary ผ่าน multipart form-data ไปยัง `https://api.opentyphoon.ai/v1/ocr` โดยตรง
- `Code (Reshape Typhoon Response)` handle ทั้ง 2 response formats ของ Typhoon API + regex extract fields → Gemini-compatible output
- T1 (Typhoon fallback) + T2 (Gemini OK) ผ่านทั้งคู่ + verify_nowThai ✅

---

## Verification Level

- [x] **Implemented** — code/config ถูกต้องตาม spec (verified ด้วย n8n REST API re-fetch)
- [x] **Verified** — live nodes ตรวจสอบแล้วจาก `GET /rest/workflows/up1n75qEhbsXswii`
- [x] **E2E Passed** — Exec `153576` (Typhoon), Exec `153579` (Gemini OK)

---

## Test Evidence

| Test | Method | Exec ID | Result |
|------|--------|---------|--------|
| T1: Typhoon fallback succeed | Gemini forced fail + caltex.pdf via queue | `153576` | ✅ `fallback_used=true`, `bills_count=1`, `vendor_tax_id=0105564172883` |
| T2: Gemini OK → no fallback | Normal queue run | `153579` | ✅ `fallback_used=false`, `bills_count=4` |
| verify_nowThai | `./scripts/verify_nowThai_sync.sh` | — | ✅ all 5 nodes identical |

---

## What Was Done Well ✅

### 1. Dual response format support (เกิน spec)
Typhoon live API ส่ง content เป็น JSON string `{"natural_text":"..."}` ไม่ใช่ plain text ตาม spec — Codex พบเจอ runtime แล้วแก้ทันที:

```javascript
// Handle JSON-wrapped natural_text
if (t.startsWith('{') && t.endsWith('}')) {
  const parsed = JSON.parse(t);
  naturalText = parsed?.natural_text || parsed?.text || null;
}
```
และ fallback รองรับ nested `results[0].message.choices[0]...` format ด้วย — เป็น defensive coding ที่ดีมาก

### 2. Code (Prepare Typhoon Request) binary pass-through
ตรงตาม spec ทุก detail — binary ส่งผ่าน binary field `data`, json มี `_typhoon_api_key` เพื่อ header expression ✅

### 3. Tax ID fuzzy fallback
```javascript
// Fallback: extract 13-digit sequences even with separators
const candidates = naturalText.match(/(?:\d[\s\-]*){13}/g) || [];
```
เพิ่มเองเกิน spec — handle กรณี OCR อ่าน tax_id มี space/dash ระหว่างตัวเลข ✅

### 4. Closing template ครบ (ไม่เหมือน T040)
Codex fill closing template ครบทุก field พร้อม exec IDs ก่อน push ✅

---

## Issues Found ❌

### 1. Connection index deviation — Reshape → Parse Result ที่ input 0 ไม่ใช่ input 1
**Severity:** Low
**Type:** Design deviation (ไม่ใช่ bug)

Spec กำหนด `Code (Reshape Typhoon Response)` → `Code (Parse Result)` ที่ **input 1**
แต่ Codex patch ที่ **input 0** เพราะ input 1 ทำให้ output ว่าง

ผลลัพธ์: ทั้ง Gemini path (IF TRUE) และ Typhoon path (IF FALSE) ต่อเข้า `Code (Parse Result)` ที่ **input 0** ทั้งคู่ — เนื่องจาก 2 paths วิ่งแยกกัน (mutually exclusive) จึงไม่มี conflict จริงๆ และ T1/T2 ผ่าน ✅

**CC notes:** deviation นี้ถูกต้อง — ยอมรับได้ และ Codex ระบุเหตุผลชัดใน Discussion spec เป็นการ self-document ที่ดี

### 2. `_typhoon_natural_text` ใน output ของ Reshape node
**Severity:** Low
**Type:** Data exposure / overhead

```javascript
_typhoon_natural_text: naturalText  // ไว้ debug
```

Raw OCR text (อาจยาวมาก) ถูกส่งผ่านทุก item ต่อจาก Reshape node — ถ้า workflow log บันทึก output ทุก node จะเปลือง storage และอาจ expose invoice content ในข้อมูล workflow_history

**Fix for T041C:** เปลี่ยนชื่อเป็น `_debug_natural_text` และเพิ่ม comment ว่า "remove in production" หรือตัดออกถ้า bills มี data แล้ว

### 3. Spec response format ผิด — CC ควรแก้ spec ก่อน implement
**Severity:** Low (ผลกระทบศูนย์ — Codex fix เองได้)

Spec บอกว่า Typhoon response format คือ `choices[0].message.content = "Thai natural_text"` แต่จริงๆ เป็น `choices[0].message.content = '{"natural_text":"..."}'` (JSON-wrapped)

**Lesson for CC:** ควรทดสอบ API endpoint จริงในช่วง Phase A testing แล้วอัปเดต spec format ก่อน assign Codex เพื่อลด discovery risk

---

## Security Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | ไม่มี webhook ใหม่ | — | ✅ N/A |
| 2 | TYPHOON_API_KEY ผ่าน `$json._typhoon_api_key` (ไม่ hardcode) | — | ✅ ดี |
| 3 | `continueOnFail: true` บน HTTP (Typhoon OCR) | — | ✅ ตรงตาม spec |
| 4 | `_typhoon_natural_text` expose invoice content ใน node output | Low | Accept (debug field) |

_Checklist:_
- [x] ไม่มี webhook ใหม่ → ไม่ต้อง auth check
- [x] ไม่มี hardcode credentials
- [x] Error messages ไม่ leak API key
- [x] `continueOnFail: true` บน HTTP node ✅

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| Regex extraction (ไม่ใช้ LLM parse) | เร็ว + ไม่มี 2nd API call | บาง field อาจ null ถ้า OCR text format ต่างจาก pattern |
| Both Gemini/Typhoon → input 0 | Simpler wiring | ถ้า n8n เพิ่ม parallel input logic ในอนาคต ควร revisit |
| `_typhoon_natural_text` debug field | Visibility | Extra data ใน workflow history |
| Typhoon `/v1/ocr` timeout 120s | ครอบคลุม slow PDFs | Queue latency สูงขึ้นเมื่อ Gemini fail |
| Regex tax_id fuzzy match | ดักได้กว้างขึ้น | false positive กับ 13-digit ที่ไม่ใช่ tax_id |

---

## Merge Decision

**APPROVED ✅**

Codex implement ครบตาม spec, ปรับตัวกับ live API response format ที่ต่างจาก spec ได้เอง, T1+T2 ผ่าน, security clean — **merge ได้เลย**

Conditions: ไม่มี (issues ทั้งหมด Low severity — หยิบใส่ T041C backlog)

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T041B`)*

**Date:**

### Response to Issues Raised

### Design Decisions Explained

### What I Would Do Differently Next Time

### New Patterns / Lessons Learned

### Closing Template
```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```

---

## Merge Approval *(CC fills หลังอ่าน Codex Response)*

- [x] Already merged to stable (fast-forward, 2026-02-27)
- [x] `./scripts/collab/sync.sh all` — auto-sync via post-commit hook
- [ ] Codex response pending (`codex-exec.sh respond T041B`)

**Date merged:** 2026-02-27
**Notes:** APPROVED unconditionally — ทดสอบ live E2E ผ่านทั้งสอง path
