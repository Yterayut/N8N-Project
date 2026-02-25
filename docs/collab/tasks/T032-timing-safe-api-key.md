# T032 — Timing-Safe API Key Comparison

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** Low
**Risk:** ต่ำ — เปลี่ยนเฉพาะ comparison function, logic เหมือนเดิมทุกอย่าง
**Depends on:** ไม่มี

---

## Overview

ปัจจุบัน Code nodes ที่ validate `x-api-key` ใช้ `===` operator ซึ่งเป็น **non-constant-time comparison** — JavaScript VM อาจ exit loop เร็วเมื่อพบ character ที่ต่าง ทำให้ผู้โจมตีสามารถ brute-force ค่า API key ได้โดย measure response time (timing attack)

ความเสี่ยงใน practice: **ต่ำมาก** — key ส่งผ่าน HTTPS + localhost only สำหรับบาง endpoint แต่เป็น security best practice ที่ควรทำให้ถูก

Fix: เปลี่ยนเป็น constant-time XOR comparison ใน 3 workflows ที่ validate API key

---

## Scope

**In scope:**
- Patch 3 Code nodes ใน 3 workflows:
  1. `ocr-feedback-receiver` (`ztJ8oCBHREUPPry6`) — node: `Code node: Validate Auth + Schema`
  2. `ocr-km-logger` (`jmJHPPj0OM5LcZ0n`) — node: `Code (Validate + Auth)`
  3. `ocr-rules-reader` (`dFzVzAFjdRJHbQqe`) — node: `Code (Auth + Query)`

**Out of scope:**
- ไม่แตะ logic อื่นนอกจาก comparison expression
- ไม่เปลี่ยน error response format
- ไม่แตะ `If` nodes ที่ใช้ expression check (ไม่ใช่ Code node)

---

## Technical Spec

### Timing-Safe Helper Function

ใส่ function นี้ **ด้านบน** ของทุก Code node ที่ patch:

```javascript
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
```

**หมายเหตุ:** `length` check ก่อน return false ยังคงเป็น constant-time สำหรับ key length เดิม — API key ของเรามีความยาวคงที่จาก env var ดังนั้น length leak ไม่เพิ่ม attack surface

### Patch ทีละ Workflow

#### Workflow 1: `ocr-feedback-receiver` (ztJ8oCBHREUPPry6)
Node: `Code node: Validate Auth + Schema`

เปลี่ยน:
```javascript
if (!receivedKey || receivedKey !== API_KEY) {
```
เป็น:
```javascript
if (!receivedKey || !timingSafeEqual(receivedKey, API_KEY)) {
```

#### Workflow 2: `ocr-km-logger` (jmJHPPj0OM5LcZ0n)
Node: `Code (Validate + Auth)`

เปลี่ยน condition `===` / `!==` ที่ compare กับ expected key เป็น `timingSafeEqual()`

#### Workflow 3: `ocr-rules-reader` (dFzVzAFjdRJHbQqe)
Node: `Code (Auth + Query)`

เปลี่ยน:
```javascript
if (!expected || key !== expected) {
```
เป็น:
```javascript
if (!expected || !timingSafeEqual(key, expected)) {
```

### Patch Method

ใช้ `PATCH /rest/workflows/{id}` — ห้ามแก้ไฟล์โดยตรง

ทำทีละ workflow — GET → แก้ jsCode ของ node นั้น → PATCH กลับ

---

## Security Considerations

1. มีจุดรับ input ใหม่ไหม? → **ไม่มี**
2. มี secret/credential ใหม่ไหม? → **ไม่มี**
3. มีข้อมูล sensitive ที่อาจรั่วไหม? → **ไม่มี**

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| Regression: logic เปลี่ยนจากเดิม | ใช้ function ที่ return false ในทุก invalid case เหมือนเดิม — แค่ replace comparison |

---

## Discussion

_Codex: เพิ่ม concerns ที่นี่ก่อน implement_

---

## Test Plan

### Happy Path

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | correct key → 200 | curl ส่ง correct x-api-key ไปยัง 3 endpoints | 200 / valid response ทุก workflow |
| T2 | wrong key → 401 | curl ส่ง wrong key | 401 UNAUTHORIZED ทุก workflow |
| T3 | missing key → 401 | curl ไม่ส่ง header | 401 UNAUTHORIZED ทุก workflow |

### Edge Cases

| # | Test | Expected |
|---|------|----------|
| T4 | key ยาวเท่ากัน แต่ต่าง 1 char | 401 |
| T5 | empty string key | 401 |

---

## Definition of Done

**Implemented:**
- [x] `timingSafeEqual` เพิ่มใน `Code node: Validate Auth + Schema` (ztJ8oCBHREUPPry6)
- [x] `timingSafeEqual` เพิ่มใน `Code (Validate + Auth)` (jmJHPPj0OM5LcZ0n)
- [x] `timingSafeEqual` เพิ่มใน `Code (Auth + Query)` (dFzVzAFjdRJHbQqe)
- [x] `===` / `!==` comparison เปลี่ยนเป็น `timingSafeEqual()` ทุกที่

**Verified from system:**
- [x] correct key → 200 ทั้ง 3 endpoints
- [x] wrong key → 401 ทั้ง 3 endpoints

**Docs synced:**
- [x] HANDOFF.md updated

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:    3 workflows (ztJ8oCBHREUPPry6, jmJHPPj0OM5LcZ0n, dFzVzAFjdRJHbQqe) — timing-safe comparison
Verified from:      correct-key 200 + wrong-key 401 (all 3 endpoints)
Docs synced:        HANDOFF.md
Remaining limits:   Length mismatch still returns early by design (acceptable here because API key length is fixed); auth smoke created test executions/rows in KM/feedback flows
```
