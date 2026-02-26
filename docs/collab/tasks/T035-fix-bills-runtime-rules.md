# T035 — Fix bills=[] in Code (Apply Runtime Rules) + Enable OCR_RUNTIME_RULES_ENABLED

**Author:** Claude Code (CC)
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง — แก้ node ใน main OCR workflow (`up1n75qEhbsXswii`) + เปลี่ยน env flag; ต้อง smoke test ก่อน-หลัง
**Depends on:** T029C ✅, T031 ✅ (root cause identified)

---

## Overview

T031 smoke test พบว่า `Code (Apply Runtime Rules)` ใน main OCR workflow คืน `bills=[]` เสมอ แม้ว่า OCR จะ extract bills ได้ถูกต้อง ทำให้ Runtime Rules ไม่มีผลใดๆ

Root cause ที่ CC สืบสวนแล้ว (2026-02-26):

| Node | เก็บ bills ที่ไหน |
|------|-----------------|
| `Code (Normalize + Validate)` | `x.raw_json = JSON.stringify({ bills: canonicalBills })` — เป็น **JSON string** ใน `raw_json` field |
| `Code (Apply Runtime Rules)` | อ่านจาก `base.bills` (top-level) — **ไม่มี field นี้** → `bills = []` เสมอ |

---

## Scope

**In scope:**
- Patch `Code (Apply Runtime Rules)` ใน workflow `up1n75qEhbsXswii` — แก้การอ่าน bills จาก `base.raw_json`
- Set `OCR_RUNTIME_RULES_ENABLED=true` ใน `.env` หลัง patch ผ่าน smoke test
- E2E smoke test: ส่ง OCR request จริง → ตรวจว่า rules ถูก apply

**Out of scope:**
- แก้ `Code (Normalize + Validate)` (ไม่จำเป็น — `raw_json` เป็น interface ที่ถูกต้อง)
- แก้ logic ของ rules เอง

---

## Technical Spec

### Part 1: Patch `Code (Apply Runtime Rules)`

**Node ที่ต้องแก้:** `Code (Apply Runtime Rules)` ใน workflow `up1n75qEhbsXswii`

**เปลี่ยนจาก:**
```javascript
const base = $('Code (Normalize + Validate)').first().json || {};
const bills = Array.isArray(base.bills) ? base.bills : [];
```

**เป็น:**
```javascript
const base = $('Code (Normalize + Validate)').first().json || {};
let bills = [];
if (Array.isArray(base.bills)) {
  bills = base.bills;
} else if (base.raw_json) {
  try {
    const parsed = JSON.parse(base.raw_json);
    bills = Array.isArray(parsed.bills) ? parsed.bills : [];
  } catch (e) {
    bills = [];
  }
}
```

**วิธี patch:** ใช้ n8n REST API `PATCH /rest/workflows/up1n75qEhbsXswii` — ห้ามแก้ไฟล์ JSON โดยตรง

**หลังแก้ code:** รัน `./scripts/verify_nowThai_sync.sh` เพื่อตรวจ nowThai() sync (Golden Rule)

---

### Part 2: Set OCR_RUNTIME_RULES_ENABLED=true

หลัง smoke test ผ่าน ให้อัปเดต `.env`:
```bash
OCR_RUNTIME_RULES_ENABLED=true
```

**หมายเหตุ:** `.env` อยู่ที่ `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.env`
n8n โหลด env ตอน start — ถ้า flag อ่านจาก `$env.OCR_RUNTIME_RULES_ENABLED` ใน n8n node ไม่ต้อง restart แต่ถ้าอ่านตอน startup ต้องตรวจก่อน

ตรวจสอบก่อน set: `grep OCR_RUNTIME_RULES_ENABLED .env`

---

## Test Plan

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Smoke before patch | POST /webhook/ocr กับ receipt จริง → ดู `bills_count` | bills_count > 0 (ยืนยัน OCR ทำงาน) |
| T2 | Patch applied | re-fetch workflow node → ดู jsCode | code ใหม่มี `base.raw_json` |
| T3 | smoke after patch (flag=true) | POST /webhook/ocr กับ receipt จริง | `runtime_rules_applied` > 0 หรือ `runtime_rules_checked: true` ใน response |
| T4 | Rule actually applied | มี rule ใน OCR_KM_RUNTIME_RULES ที่ match → ดู apply log | `applied` array ไม่ว่าง หรือ field ถูกแก้ |
| T5 | Restore check | ถ้า T3/T4 fail → flag กลับ false ทันที | OCR ตอบ 200 ปกติ ไม่มี regression |

**Prerequisite:** ต้องมี rule อย่างน้อย 1 row ใน sheet `OCR_KM_RUNTIME_RULES` ที่ active และ scope=`post_normalize`
ตรวจ: `curl -sf http://localhost:5678/webhook/gg-data?sheet=OCR_KM_RUNTIME_RULES -H "x-api-key: $OCR_SHARED_API_KEY"`

---

## Security Considerations

- ไม่มี input ใหม่ที่รับจาก user — แก้เฉพาะ internal data flow
- `JSON.parse(base.raw_json)` อาจ throw ถ้า raw_json malformed → try/catch แล้ว fallback `bills=[]` ปลอดภัย

---

## Definition of Done

**Implemented:**
- [ ] `Code (Apply Runtime Rules)` ใน workflow `up1n75qEhbsXswii` อ่าน bills จาก `base.raw_json` แล้ว
- [ ] `verify_nowThai_sync.sh` ผ่าน (Golden Rule)

**Verified:**
- [ ] T2 ผ่าน (code ใหม่อยู่ใน node จริง)
- [ ] T3 ผ่าน (OCR response มี runtime_rules evidence)
- [ ] T5 ผ่าน หรือ flag=false restore ถ้า T3 fail

**Docs:**
- [ ] `.env` อัปเดต `OCR_RUNTIME_RULES_ENABLED=true` (หลัง T3 ผ่าน)
- [ ] HANDOFF.md อัปเดต — T035 complete + flag status

---

## Discussion
*(Codex pre-execution questions ใส่ที่นี่)*
