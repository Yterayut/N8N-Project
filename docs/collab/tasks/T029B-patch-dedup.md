# T029B-patch — Fix P2/P3 Dedup Key Fragility

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** Medium (must fix before production data enters TRAIN_CASES)
**Risk:** ต่ำ — แก้แค่ dedup key string ใน Code (Analyze Patterns) ของ ocr-km-suggest
**Depends on:** T029B reviewed (APPROVED WITH CONDITIONS)

---

## Problem

Workflow `ocr-km-suggest` (ID: `NkKd02QyzLRcpIJM`) มี dedup key ใน P2 และ P3 ที่รวม count/percentage ไว้ด้วย:

**P2 (ปัจจุบัน — ผิด):**
```js
const patternText = `high_severity_rate:${pct}pct_7d`;
// dedup key = "receipt|*|high_severity_rate:67pct_7d"
// ถ้ารอบถัดไป pct=75 → key ต่าง → สร้าง lesson ซ้ำ
```

**P3 (ปัจจุบัน — ผิด):**
```js
const patternText = `full_ocr_failure:${ids.length}x`;
// dedup key = "receipt|0123456789|full_ocr_failure:3x"
// ถ้ารอบถัดไป count=4 → key ต่าง → สร้าง lesson ซ้ำ
```

## Fix Required

**P2 (ถูกต้อง):**
```js
const patternText = `high_severity_rate`;  // ตัด :${pct}pct_7d ออก
// lesson_text และ evidence_count ยังมีค่าจริงอยู่ (ไม่เปลี่ยน)
```

**P3 (ถูกต้อง):**
```js
const patternText = `full_ocr_failure`;  // ตัด :${ids.length}x ออก
// lesson_text และ evidence_count ยังมีค่าจริงอยู่ (ไม่เปลี่ยน)
```

`pattern_observed` field ใน lesson row ยังเก็บ version ที่มี count ได้ — เพียงแต่ **dedup key ต้องไม่รวมค่าที่เปลี่ยนแปลงได้**

---

## Scope

1. **Patch** `Code (Analyze Patterns)` node ใน workflow `NkKd02QyzLRcpIJM`
   - แก้ P2: `patternText = \`high_severity_rate\`` (ลบ `:${pct}pct_7d`)
   - แก้ P3: `patternText = \`full_ocr_failure\`` (ลบ `:${ids.length}x`)
   - `pattern_observed` field ใน makeLesson() ยังส่ง full string ได้ (optional) หรือเปลี่ยนเป็น stable string ก็ได้

2. **Verify** re-fetch node code หลัง patch ยืนยัน string ถูกเปลี่ยน

3. **Test** รัน webhook `POST /webhook/ocr-km-suggest` ด้วย `include_manual: true` → verify ได้ execution success

---

## Definition of Done

- [ ] `Code (Analyze Patterns)` node patched — P2 patternText = `high_severity_rate`, P3 patternText = `full_ocr_failure`
- [ ] Re-fetch node code ยืนยัน patch applied
- [ ] ≥ 1 execution success หลัง patch
- [ ] HANDOFF.md updated

---

## Discussion
*(Codex fill ก่อน implement)*

