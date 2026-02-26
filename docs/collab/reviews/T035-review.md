# T035 Code Review — Fix bills=[] in Apply Runtime Rules + Enable Flag

**Reviewer:** Claude Code (CC)
**Date:** 2026-02-26
**Commit:** `57e36dd feat(T035): fix runtime-rules bills parsing and enable flag`
**Score:** 9/10 — APPROVED

---

## Summary

Codex แก้ `Code (Apply Runtime Rules)` ให้อ่าน bills จาก `base.raw_json` แทน `base.bills` ที่ไม่มี และ enable `OCR_RUNTIME_RULES_ENABLED=true` ใน `.env`

---

## Code Review

### ✅ Fix ถูกต้อง — bills parsing

```javascript
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

- Fallback chain ถูกต้อง: ลอง `base.bills` ก่อน → fallback `raw_json` → fallback `[]`
- try/catch ครอบ JSON.parse — ปลอดภัย
- ไม่มี new input จาก user — ไม่มี injection risk

### ✅ Rule engine logic ครบ

- รองรับ `field_default`, `field_format`, `skip_validation`
- `blockedField()` ป้องกัน field ที่ไม่ควรแก้ (gemini_raw, request_id, file_*)
- `isEmpty()`, `toBool()` helpers ชัดเจน
- Output: `applied[]`, `skipped[]` — ตรวจสอบได้

### ✅ Golden Rules ผ่านทุกข้อ

| Rule | ผล |
|------|----|
| nowThai() sync (5 nodes) | ✅ OK — all 5 identical |
| `.env` flag | ✅ `OCR_RUNTIME_RULES_ENABLED=true` |
| Patch ผ่าน REST API | ✅ ไม่ได้แก้ JSON ตรง |
| HANDOFF.md | ต้องอัปเดต (CC จะทำ) |

### ✅ E2E Smoke Test (exec 151931)

- `bills_count=1` (ไม่ใช่ 0 แล้ว)
- `rules_engine='no_rules'`, `rules_applied=[]` — ถูกต้อง เพราะยังไม่มี rule ใน sheet ที่ match

---

## Issues

### Minor (ไม่ block merge)

- `rules_applied=[]` เพราะ `OCR_KM_RUNTIME_RULES` sheet ยังไม่มี rule ที่ active และ match → pipeline พร้อมแล้ว รอ rule จริงเพิ่มในภายหลัง

---

## Merge Approval

| Check | Status |
|-------|--------|
| Code correct | ✅ |
| Security | ✅ |
| Golden Rules | ✅ |
| Smoke test | ✅ |
| **MERGE** | ✅ **APPROVED** |

---

## Codex Response
*(Codex fill ที่นี่ถ้ามีข้อสังเกต)*
