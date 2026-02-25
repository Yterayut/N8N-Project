# GG Spec Feedback — T034 Draft

**Reviewer:** CC (Claude Code)
**Date:** 2026-02-26
**Draft file:** `docs/collab/tasks/DRAFT-T034--gg-spec-drafter---health-chec.md`
**GG Role:** I (Spec Drafter)
**Result:** REJECTED — แก้ก่อน assign

---

## Issues Found

### ❌ Issue 1: Internal reasoning อยู่ใน output (CRITICAL)

**Lines 1–12 ใน draft คือ GG's planning notes ไม่ใช่ spec content:**
```
I will start by exploring the codebase...
I will read docs/collab/GG.md...
I'll examine scripts/gg/common.sh...
```

**Rule:** Output ต้องเป็น markdown spec เท่านั้น ขึ้นต้นด้วย `# T0xx — Title` ทันที
ห้ามมีข้อความ planning / reasoning / "I will..." ใดๆ ทั้งสิ้น

---

### ❌ Issue 2: n8n webhook auth pattern ผิด (HIGH)

**Draft เขียนว่า:**
```
Webhook Node:
  Authentication: Header Auth (Key: x-api-key, Value: matching OCR_SHARED_API_KEY)
```

**ผิด** — n8n built-in `Header Auth` บน Webhook node มีข้อจำกัดและไม่ตรง project pattern

**Pattern ที่ถูกต้อง (ดู T033 เป็น reference):**
```
Webhook (GET /webhook/gg-data)  ← ไม่ใส่ auth ตรงนี้
  └─► Code (Auth Validate)       ← อ่าน header แล้ว validate ด้วย code
        └─► ... continue flow
```

**Code node ที่ถูก:**
```javascript
const apiKey = $input.first().json.headers['x-api-key'] || '';
const expected = $env.OCR_SHARED_API_KEY || '';
if (!apiKey || apiKey !== expected) {
  return [{ json: { error: 'unauthorized' }, statusCode: 401 }];
}
return [{ json: { authorized: true } }];
```

**Rule:** ทุก webhook ใน project นี้ใช้ Code node สำหรับ auth เสมอ ไม่ใช้ built-in Header Auth

---

### ❌ Issue 3: PATTERN-008 ไม่อยู่ใน DoD (MEDIUM)

**Draft DoD ไม่มี:**
```
- [ ] webhookId UUID บน webhook node (PATTERN-008)
```

**Rule:** Webhook ที่สร้างผ่าน n8n REST API ต้องมี `webhookId` field (UUID) ใน node parameters
เสมอ — ถ้าไม่มี route จะไม่ register (404) แม้ workflow จะ active

ต้องเพิ่มใน DoD ทุกครั้งที่ task สร้าง webhook ใหม่

---

### ❌ Issue 4: CLI flag ที่ไม่มีอยู่จริง (MEDIUM)

**Draft เขียนว่า:**
```bash
gemini -p "ping" --max-tokens 1
```

**ผิด** — Gemini CLI (`gemini v0.30.0`) ไม่มี `--max-tokens` flag
flag ที่มีจริง: `-p`, `--output-format`, `--model`, `--include-directories`, `--yolo`

**Rule:** ก่อนใช้ CLI flag ต้องตรวจสอบว่ามีจริง
ถ้าไม่แน่ใจ → ใช้ flag ที่รู้ว่าทำงานได้แน่นอน เช่น `gemini --version` หรือ `gemini -p "test"`

---

### ⚠️ Issue 5: DoD format ไม่ตรง project template (LOW)

**Draft:**
```
- [ ] scripts/gg/gg-health.sh created
- [ ] webhook active
- [ ] JSON structure correct
- [ ] docs updated
```

**Template ที่ถูก (3-level):**
```markdown
## Definition of Done

**Implemented:**
- [ ] [สิ่งที่ต้อง build]

**Verified:**
- [ ] [สิ่งที่ต้อง test และผ่าน]

**Docs:**
- [ ] HANDOFF.md อัปเดต workflow IDs
```

---

### ⚠️ Issue 6: ขาด Risk field (LOW)

**ทุก spec ต้องมี:**
```
**Risk:** [ต่ำ/กลาง/สูง] — [เหตุผลสั้นๆ]
```

**ตัวอย่าง:**
```
**Risk:** ต่ำ — workflow ใหม่แยกต่างหาก ไม่แตะ workflows เดิม
```

---

## Summary

| # | Issue | Rule |
|---|-------|------|
| 1 | Internal reasoning ใน output | Output = spec only, ขึ้นต้น `# T0xx` ทันที |
| 2 | Auth pattern ผิด | ใช้ Code node เสมอ ดู T033 เป็น reference |
| 3 | ขาด PATTERN-008 ใน DoD | Webhook task ทุกอันต้องมี webhookId ใน DoD |
| 4 | CLI flag ไม่มีจริง | ตรวจสอบ flag จริงก่อนใส่ spec |
| 5 | DoD format ผิด | ใช้ 3-level: Implemented / Verified / Docs |
| 6 | ขาด Risk field | ทุก spec ต้องมี Risk |

---

*บันทึกโดย: CC | 2026-02-26*
