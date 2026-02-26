# GG Spec Guidelines — Project Rules for Role I (Spec Drafter)

ไฟล์นี้ GG ต้องอ่านทุกครั้งก่อน draft spec
CC อัปเดตไฟล์นี้เมื่อพบ pattern ใหม่จาก feedback

**Last updated:** 2026-02-26 (from T034 feedback + Don't Trust policy)

---

## ⚠️ Agent Policy — DON'T TRUST, VERIFY ONLY (GG และ Codex)

> Output จาก GG และ Codex ทุกชิ้น = **ข้อเสนอ / draft เท่านั้น** — CC ต้อง verify ก่อน accept / merge เสมอ — ไม่มีข้อยกเว้น

**หลักการ:** ไม่มี agent output ใดที่ "trust by default" — CC คือ single point of verification ทุกครั้ง

ดูรายละเอียด verify checklist ที่ `docs/collab/knowledge/lessons-learned.md` **LESSON-010**

### GG Self-Verification Rule (บังคับ)

> ถ้า GG ไม่แน่ใจข้อมูลใด → **ต้องค้นหาความจริงก่อน** output — ห้าม guess หรือ hallucinate

- ถ้าไม่แน่ใจ entity data (Tax ID, ชื่อบริษัท) → ค้นหาจาก web หรือ document ที่มีก่อน
- ถ้าไม่พบข้อมูลจากแหล่งน่าเชื่อถือ → **ระบุว่า "ไม่แน่ใจ / ต้องการ user confirm"** อย่างชัดเจนใน output
- ห้าม output ข้อมูลที่ไม่แน่ใจโดยไม่มี disclaimer

---

## N8N Patterns — Single Source of Truth

**อ่าน `docs/collab/knowledge/n8n-patterns.md` ก่อนเขียน spec เสมอ** — มี PATTERN-001 ถึง PATTERN-012

Patterns ที่สำคัญที่สุดสำหรับ spec writing:

| Pattern | หัวข้อ | กฎ |
|---------|--------|-----|
| PATTERN-001 | Multi-input node | ใช้ `$('NodeName').first().json.field` ไม่ใช่ `$json` |
| PATTERN-008 | Webhook webhookId | ทุก webhook node สร้างผ่าน REST ต้องมี `webhookId` UUID ใน DoD |
| PATTERN-010 | IF node conditions | ใช้ typeVersion 2.3 + v3 format เสมอ |
| PATTERN-011 | Webhook path collision | ตรวจ path ซ้ำก่อน activate |

ถ้า spec มี webhook ใหม่ → ต้องมีทั้ง RULE-SG-004 (Code node auth) + PATTERN-008 (webhookId) ใน DoD เสมอ

---

## OUTPUT FORMAT RULES

### RULE-SG-001: Output คือ markdown spec เท่านั้น
- ขึ้นต้นด้วย `# T0xx — Title` ทันที บรรทัดแรก
- ห้ามมีข้อความ planning, reasoning, "I will...", "I'll...", "Let me..." ใดๆ
- ห้าม explain ว่าจะทำอะไร — ให้ output ผลลัพธ์โดยตรง

**Wrong:**
```
I will explore the codebase first...
I'll examine common.sh...
# T034 — Title
```

**Correct:**
```
# T034 — Title
**Author:** ...
```

---

## SPEC STRUCTURE RULES

### RULE-SG-002: Required fields ทุก spec
```markdown
**Author:** Claude Code (CC) — DRAFT by GG
**Date:** YYYY-MM-DD
**Assignee:** [Codex / CC / GG]
**Priority:** [High/Medium/Low]
**Risk:** [ต่ำ/กลาง/สูง] — [เหตุผลสั้นๆ]
**Depends on:** [task IDs หรือ 'none']
```
Risk field บังคับเสมอ — ห้ามลืม

### RULE-SG-003: DoD ต้องเป็น 3-level เสมอ
```markdown
## Definition of Done

**Implemented:**
- [ ] [สิ่งที่ต้อง build — specific]

**Verified:**
- [ ] [test ที่ต้องผ่าน — specific]

**Docs:**
- [ ] HANDOFF.md อัปเดต workflow IDs (ถ้ามี workflow ใหม่)
- [ ] [docs อื่นที่ต้องอัปเดต]
```

---

## N8N PATTERNS (บังคับ)

### RULE-SG-004: Webhook auth ต้องใช้ Code node เสมอ
ห้ามใช้ built-in "Header Auth" หรือ "Basic Auth" บน Webhook node

**Pattern ที่ถูก (ดู T033 เป็น reference):**
```
Webhook (GET /webhook/xxx)  ← ไม่มี auth setting
  └─► Code (Auth Validate)  ← validate ด้วย code
        └─► ... continue
```

**Code node สำหรับ auth:**
```javascript
const apiKey = $input.first().json.headers['x-api-key'] || '';
const expected = $env.OCR_SHARED_API_KEY || '';
if (!apiKey || apiKey !== expected) {
  return [{ json: { error: 'unauthorized' }, statusCode: 401 }];
}
return [{ json: { authorized: true } }];
```

### RULE-SG-005: PATTERN-008 — webhookId UUID บังคับ
ทุก task ที่สร้าง webhook ใหม่ต้องมีใน DoD:
```
- [ ] webhookId UUID บนทุก webhook node (PATTERN-008)
```

**เหตุผล:** Webhook ที่สร้างผ่าน REST API โดยไม่มี `webhookId` จะ active แต่ 404 เสมอ

### RULE-SG-006: Auth header key ของ project นี้
- Header name: `x-api-key`
- Value: ดูจาก `$env.OCR_SHARED_API_KEY`
- ใช้เหมือนกันทุก workflow ใน project นี้

### RULE-SG-007: Spreadsheet ID ของ project
```
12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0
```
Tabs ที่มี: TRAIN_CASES, FIELD_DIFFS, OCR_KM_RUNTIME_RULES, OCR_FEEDBACK, OCR_EXAMPLES

---

## CLI / TOOL RULES

### RULE-SG-008: ตรวจสอบ CLI flags ก่อนใส่ spec
ห้าม invent flags ที่ไม่แน่ใจ

**Gemini CLI flags ที่รู้ว่าทำงานได้ (v0.30.0):**
- `-p "prompt"` — run prompt
- `--output-format text` — plain text output
- `--model gemini-2.5-pro` — specify model
- `--include-directories` — include files
- `--yolo` — skip confirmation prompts
- `--version` — version check

**ห้ามใช้:** `--max-tokens`, `--temperature`, `--stream` (ไม่มีใน v0.30.0)

---

## WORKFLOW CONTEXT

### RULE-SG-009: Main workflow
- Name: `ocr-invoice-processor`
- ID: `up1n75qEhbsXswii`
- ห้าม task ใดแตะ workflow นี้โดยไม่ explicit ระบุใน spec

### RULE-SG-010: Existing GG workflows
- `gg-data-gateway` — ID: `XtaSg9pLDuPERtI8` (GET /webhook/gg-data)
- `gg-notify-gateway` — ID: `YZTJwkh25isaLKHo` (POST /webhook/gg-notify)
ถ้า task เกี่ยวกับ GG ให้ reference workflows นี้

---

## FEEDBACK HISTORY

| Task | Issues | Key Rule Added |
|------|--------|----------------|
| T034 | Internal reasoning ใน output, auth pattern ผิด, ขาด webhookId DoD, flag ผิด, DoD format ผิด, ขาด Risk | SG-001 ถึง SG-008 |

---

*CC อัปเดตไฟล์นี้หลังทุก feedback cycle*
