# Code Review — T0xx: [Task Title]

**Reviewer:** CC
**Reviewed commit:** `[hash]`
**Date:** YYYY-MM-DD
**Spec:** `docs/collab/tasks/T0xx-[name].md`
**Score:** X/10

---

## Summary of What Was Implemented

- [1-3 bullet points สรุปสิ่งที่ Codex ทำ]

---

## Verification Level

> ต้อง mark ระดับที่ verified จริงเท่านั้น — ห้าม claim สูงกว่าหลักฐานที่มี

- [ ] **Implemented** — code/config เขียนถูกต้องตาม spec
- [ ] **Verified** — re-fetch จาก n8n API / SQLite ยืนยัน node/workflow ตรง
- [ ] **E2E Passed** — execution จริง ผ่านครบ | Exec ID: `_______`

---

## Test Evidence (required)

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| [T1] | | | ✅ / ❌ |
| [T2] | | | ✅ / ❌ |

_ถ้าไม่มี exec ID → ระบุว่าเป็น "code inspection only" อย่างชัดเจน_

---

## What Was Done Well ✅

### 1. [หัวข้อ]
[อธิบาย + code snippet ถ้ามี]

---

## Issues Found ❌

### 1. [หัวข้อ]
**Severity:** Critical / High / Medium / Low
**Type:** Bug / Design / Security / Performance / Missing Test

[อธิบาย root cause + impact]

**Fix for T0xx+1:** [suggestion]

---

## Security Findings (required — write "none found" if clean)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | [e.g. no auth on webhook] | High | Fix required |

_Checklist ที่ตรวจ:_
- [ ] Auth/authorization บน webhook ใหม่ทุกตัว
- [ ] Input validation + size limits ที่ entry points
- [ ] ไม่มี secret/credential hardcoded
- [ ] Error messages ไม่ leak internal info
- [ ] continueOnFail บน side-system calls ทุกตัว

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| [e.g. global staticData] | [ง่าย แต่ single-user] | [collision ถ้า multi-user] |

---

## Merge Decision

**APPROVED / APPROVED WITH CONDITIONS / REJECTED**

Conditions (ถ้ามี):
- [ ] ...

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T0xx`)*

**Date:**

### Response to Issues Raised
[ตอบทีละ issue — เห็นด้วย/ไม่เห็นด้วย + เหตุผล]

### Design Decisions Explained
[อธิบาย trade-off ที่เลือก]

### What I Would Do Differently Next Time
[honest reflection]

### New Patterns / Lessons Learned
[เพิ่มใน n8n-patterns.md หรือ lessons-learned.md ถ้ามี]

### Closing Template
```
Runtime patched:    [workflow IDs + nodes ที่เปลี่ยน]
Verified from:      [exec ID / SQLite query / API response]
Docs synced:        [HANDOFF / reviews / knowledge]
Remaining limits:   [known limitations ที่ยอมรับ]
```
