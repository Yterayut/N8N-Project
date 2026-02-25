# Lessons Learned — Shared Knowledge Base

> บันทึกสิ่งที่ผิดพลาด ตัดสินใจผิด หรือเรียนรู้จากประสบการณ์จริง
> ทั้ง CC และ Codex เพิ่มได้ — ใส่ชื่อ contributor + task ref + date

---

## LESSON-001: อย่า assume permissions/capabilities ของ agent อื่น

**Contributor:** CC | **Session:** 2026-02-24 | **Ref:** Role redesign

### เกิดอะไรขึ้น
CC อ่าน CODEX.md เดิมที่บอก "DO NOT deploy or test against live n8n" แล้ว assume ว่า Codex ทำไม่ได้จริง → ออกแบบ workflow ให้ CC ทำทุกอย่าง

### ความเป็นจริง
User ยืนยันว่า Codex CAN: patch n8n REST API, read/write SQLite, run bash scripts
CODEX.md เดิมล้าสมัย — ไม่ได้ update ตาม actual capabilities

### Lesson
> ถ้าไม่แน่ใจเรื่อง capabilities ของ agent อื่น → **อ่าน doc ที่ update ล่าสุด หรือถาม user** อย่าเดาจาก doc เก่า

---

## LESSON-002: Spec ที่เขียนโดย Planner มี bug ได้ — Reviewer ต้องจับ

**Contributor:** CC | **Session:** 2026-02-24 | **Ref:** T024

### เกิดอะไรขึ้น
CC เขียน spec ใส่ `$now.format('YYYY-MM')` → Codex execute ตาม spec → ไฟล์ได้ชื่อ `YYYY-02_...`
CC ต้องมา fix ทีหลัง

### Lesson
> **Codex ควร review spec ก่อน execute** — ถ้าเห็น potential issue (เช่น token format) ให้ comment ใน Discussion section ก่อน ไม่ใช่ execute ตาม spec ที่ผิด

> **CC ควร test expression ใน n8n sandbox ก่อนเขียนลง spec** สำหรับ n8n-specific syntax

---

## LESSON-003: Claude Code ห้าม execute งานที่ assign ให้ Codex แล้ว

**Contributor:** CC | **Session:** 2026-02-24

### เกิดอะไรขึ้น
CC patch filename bug (`YYYY-MM` → `yyyy-MM`) เองโดยตรง ทั้งที่ควรเขียน spec แล้วให้ Codex ทำ

### Flow ที่ถูกต้อง
```
CC พบ bug → เขียน task/spec → assign Codex → Codex fix → CC review
```

### Exception
CC execute เองได้ เฉพาะเมื่อ **user สั่งโดยตรง** เท่านั้น

---

## LESSON-004: curl `--data-binary @file` แทน `-d` สำหรับ large payload

**Contributor:** CC | **Session:** 2026-02-24 | **Ref:** T023

### เกิดอะไรขึ้น
`subprocess.run(['curl', '-d', json_string, ...])` → `OSError: Argument list too long`
workflow 109 nodes → JSON ~500KB → เกิน shell arg limit

### Fix
```python
with open('/tmp/patch.json', 'w') as f:
    json.dump(payload, f)
subprocess.run(['curl', '--data-binary', '@/tmp/patch.json', ...])
```

---

## LESSON-005: n8n workflow_entity.nodes อาจว่างเปล่า

**Contributor:** CC | **Session:** ก่อนหน้า

### เกิดอะไรขึ้น
Query `SELECT nodes FROM workflow_entity WHERE id=?` → ได้ `[]` ทั้งที่ workflow มี 109 nodes

### ความเป็นจริง
n8n version ใหม่เก็บ nodes ใน `workflow_history` ไม่ใช่ `workflow_entity`

### Correct Query
```sql
SELECT nodes FROM workflow_history
WHERE workflowId = ? ORDER BY createdAt DESC LIMIT 1
```

---

## LESSON-006: Code inspection ไม่พอสำหรับ n8n node behavior ที่ขึ้นกับ runtime/version

**Contributor:** Codex | **Session:** 2026-02-25 | **Ref:** T028 review response

### เกิดอะไรขึ้น
T028 รอบแรก verify โดยเน้น code inspection + API simulation และ re-fetch workflow จาก n8n API ทำให้ logic หลักดูถูกต้อง แต่พลาด runtime bugs ที่เกิดตอน Telegram E2E จริง:
- IF node `typeVersion` กับ `conditions` format ไม่ match (silent routing/error)
- Code node ทำ binary หล่น แต่ inspection มองไม่เห็น data lineage จริงตอน run
- fan-out connection ยิง Telegram ก่อน `telegram_text` พร้อม

### Lesson
> งาน n8n ที่มี Trigger + Binary + IF/Switch routing ต้องมี **runtime/E2E smoke test อย่างน้อย 1 รอบ** ก่อนสรุปว่า "verified"

> API simulation ช่วยยืนยัน business payload ได้ แต่ **ทดแทน execution graph behavior จริงไม่ได้** (node version schema, connection timing, binary propagation)

---

*อัปเดตล่าสุด: 2026-02-25 by Codex*

---

## LESSON-007: Helper/Tmp Workflows ต้อง cleanup ใน task เดียวกัน

**Contributor:** Codex | **Session:** 2026-02-25 | **Ref:** T026 review response

### เกิดอะไรขึ้น
ระหว่างทำ T026 ใช้ tmp workflows เพื่อ create/seed Google Sheet และ verify step-wise ได้เร็ว แต่ปิดงานแล้วลืมลบออกจาก n8n (inactive แต่ยังค้าง)

### Impact
- ไม่กระทบ production flow โดยตรง
- เพิ่ม operational clutter และทำให้ review มี low-severity follow-up ที่ไม่จำเป็น

### Lesson
> งานที่สร้าง helper resources ชั่วคราว (tmp workflow / temp webhook / seed node) ต้องมี **cleanup checklist** และทำก่อนส่ง review
