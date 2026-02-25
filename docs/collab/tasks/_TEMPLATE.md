# T0xx — [Task Title]

**Author:** Claude Code (CC)
**Date:** YYYY-MM-DD
**Assignee:** Codex / CC
**Priority:** Critical / High / Medium / Low
**Risk:** สูง / กลาง / ต่ำ
**Depends on:** [task IDs หรือ "ไม่มี"]

---

## Overview

[1-2 ย่อหน้า อธิบาย why + what — ปัญหาที่แก้คืออะไร ทำไมต้องทำตอนนี้]

---

## Scope

[bullet list สิ่งที่ทำ — ชัดเจนพอให้ Codex ทำได้โดยไม่ต้องเดา]

**In scope:**
- ...

**Out of scope (explicit):**
- ...

---

## Technical Spec

[รายละเอียด implementation — node names, code snippets, API calls, connections]

---

## Security Considerations (required)

> ตอบ 3 คำถามนี้ก่อนเสมอ:
> 1. มีจุดรับ input ใหม่ไหม? (webhook / form / Telegram)
> 2. มี secret/credential ใหม่ไหม?
> 3. มีข้อมูล sensitive ที่อาจรั่วใน log/response/Telegram ไหม?

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| [e.g. webhook ไม่มี auth] | [เพิ่ม x-api-key check] |

**Required security controls:**
- [ ] Auth บน webhook ใหม่ทุกตัว (x-api-key vs `$env.OCR_SHARED_API_KEY`)
- [ ] Input validation + truncation ก่อน write ไป Sheet/DB
- [ ] `continueOnFail: true` บน side-system calls (Drive, Sheets, Telegram)
- [ ] Error response ไม่ส่ง internal details ออก

---

## Discussion

_Codex: เพิ่ม concerns / ข้อสงสัย / alternative approach ที่นี่ **ก่อน implement**_
_ถ้าไม่มี → เขียน "No concerns — proceeding"_

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | | | |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T6 | wrong API key | 401 |
| T7 | missing required field | 422 |
| T8 | side-system down | continueOnFail — main flow unaffected |

---

## Definition of Done

> Codex: อย่า mark Done ถ้ายังไม่ครบทุก checkbox

**Implemented:**
- [ ] [สิ่งที่ต้องสร้าง/เปลี่ยน — ครบตาม scope]

**Verified from system (required — ไม่ใช่แค่ code inspection):**
- [ ] [ตรวจจาก live n8n / SQLite / Sheet / exec ID]

**E2E Passed:**
- [ ] Exec ID: `_______` — [อธิบาย scenario ที่รัน]

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
