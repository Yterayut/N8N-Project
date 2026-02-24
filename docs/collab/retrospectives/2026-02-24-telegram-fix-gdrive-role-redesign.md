# Session Retrospective — 2026-02-24-telegram-fix-gdrive-role-redesign

## 1. Git Summary

| Commit | Message | Accomplished |
|--------|---------|-------------|
| `d99e2b8` | fix(telegram): T023 — fix OCR Notify node + workflowName + TELEGRAM_OCR_CHAT_ID | Round 1: patched Telegram text ref + workflowName from hardcoded 'test-workflow' → $workflow.name |
| `53650f3` | docs(handoff): T023 note for Codex — Telegram fixes summary | Handoff note ให้ Codex รู้ว่าแก้อะไรไป |
| `0b318f0` | fix(telegram): T023 final — direct Code node ref + remove double footer | Round 2+3: explicit node ref + ลบ manual footer ที่ typeVersion 1.2 เพิ่มให้อัตโนมัติอยู่แล้ว |
| `c56d8c7` | docs(handoff): T023 detailed note for Codex with test results | Test results บันทึกใน HANDOFF |
| `e225ef4` | chore(collab): T024 assigned to Codex | Assign T024 ให้ Codex อย่างเป็นทางการ |
| `e8c8cdc` | feat(spec): T024 Google Drive save spec for fast/standard path | สร้าง spec ครบที่ `docs/collab/tasks/T024-gdrive-save-spec.md` |
| `75fac26` | chore(collab): update agent roles — Codex=Executor, Claude=Planner+Manager | อัปเดต CODEX.md + CLAUDE.md + HANDOFF.md สะท้อน role ใหม่ |

---

## 2. Tasks Completed

### T023 — Fix Telegram OCR Notification (3 rounds)
**Problem:** Telegram per-OCR notification ส่งข้อความ "undefined" ทุก field

**Root causes found (layered):**
1. `workflowName` hardcoded = `'test-workflow'` → แก้เป็น `$workflow.name / $workflow.id`
2. `Telegram (OCR Notify)` text = `{{ $json.telegram_text }}` → `$json` ถูก `HTTP Release Admission Slot` overwrite → แก้เป็น `$('Code (Build Telegram Notification OCR)').first().json.telegram_text`
3. Double footer — Code node push manual footer + Telegram typeVersion 1.2 เพิ่มอัตโนมัติ → ลบ manual footer ออก

**Files/nodes changed (via REST API — ไม่ใช่ file edit):**
- Node: `Code (Build Telegram Notification OCR)` — ลบ manual footer, fix workflowName
- Node: `Telegram (OCR Notify)` — เปลี่ยน text expression
- `.env` — เพิ่ม `TELEGRAM_OCR_CHAT_ID=1776637578`

**Outcome:** Tested 3 rounds — ข้อความถูกต้องทุก field ✅

---

### T024 — Google Drive Save Spec (fast/standard path)
**Problem:** Fast/standard path ส่งไฟล์ตรงไป Gemini โดยไม่บันทึก Google Drive → ไม่มี audit trail

**Exploration:** ตรวจ 109 nodes ใน workflow — Heavy/queue path มี Drive save แล้ว, fast path ข้ามไป

**Decision:** Option A — Sequential insert ก่อน Gemini (ไม่ทำ async หรือ unified queue)

**Spec:** `docs/collab/tasks/T024-gdrive-save-spec.md` ครบทุก field:
- Node A: `Google Drive (Upload - Direct)`, inputDataFieldName: `files0`, `onError: continueRegularOutput`
- Node B: `Code (Merge Drive Result)` — merge `drive_file_id` กลับ + preserve binary
- Update: `Append row in OCR_RAW4` เพิ่ม `drive_file_id` column

**Outcome:** Spec committed, assigned Codex review ✅ (Codex ต้อง review + mark Ready ก่อน Claude implement)

---

### Role Redesign — Codex = Executor (Async)
**Problem:** CODEX.md เขียน role เป็น "Planner, Reviewer, QA" แต่ user ยืนยันว่า Codex เข้า n8n REST API / SQLite / bash scripts ได้จริง — role definition ล้าสมัย

**Files changed:**
- `CODEX.md` (root + agents/codex): role → Executor (Async), เพิ่ม DO สำหรับ n8n/SQLite/scripts
- `CLAUDE.md`: เพิ่ม Agent Roles section
- `docs/collab/HANDOFF.md`: อัปเดต role descriptions

**Outcome:** Committed + synced ✅

---

## 3. Decisions Made

### Decision 1: Telegram node ใช้ explicit node reference
**Decided:** `$('Code (Build Telegram Notification OCR)').first().json.telegram_text` แทน `$json.telegram_text`
**Why:** เมื่อ 2+ nodes connect ไปหา node เดียว, `$json` = output ของ node ล่าสุดที่ run — ไม่ predictable
**Rule established:** ใช้ explicit node reference เสมอเมื่อมี multi-input node

### Decision 2: T024 Option A — Sequential insert (ไม่ async)
**Decided:** แทรก Drive upload ก่อน Gemini บน fast/standard path
**Why:** Option B (unified queue) ทำให้ fast path กลาย async → response ช้า; Option C (parallel) race condition ถ้า Drive ช้า
**Trade-off:** เพิ่ม latency เล็กน้อย (Drive upload) แต่ได้ drive_file_id sync กับ OCR result

### Decision 3: Codex role = Executor (Async)
**Decided:** Codex ไม่ใช่แค่ planner — เป็น executor ที่รับ spec ชัดแล้วทำเอง (รวมถึง n8n/SQLite)
**Why:** User corrected assumption — Codex มีสิทธิ์เข้าระบบ live ได้จริง
**Constraint เพิ่ม:** ต้องมี spec ที่ `docs/collab/tasks/T0xx-*.md` ก่อน start เสมอ

---

## 4. Issues Found / Deferred

### Multi-input node `$json` overwrite (documented — not a bug to fix)
**Description:** n8n behavior — เมื่อ 2+ nodes connect เข้า node เดียว, `$json` = output ของ node ล่าสุด
**Severity:** medium (ต้องระวังทุกครั้งที่ออกแบบ flow)
**Status:** Documented ใน MEMORY.md และ FORWARD.md — pattern fix ชัดแล้ว

### T024 — ยังไม่ implement
**Description:** Spec พร้อมแล้ว แต่รอ Codex review 3 decisions ก่อน
**Severity:** low (fast path ยังทำงานปกติ — แค่ไม่บันทึก Drive)
**Next action:** Codex review spec → mark Ready → Claude implement

### `agents/codex/CODEX.md` ไม่ถูก git track บน stable
**Description:** `agents/` directory อยู่ใน `.gitignore` บน stable — การแก้ `agents/codex/CODEX.md` commit ได้เฉพาะบน agents/codex branch
**Severity:** low (ทำงานได้ปกติ — แค่ต้องรู้ว่าแก้จาก agents/codex worktree)
**Status:** ทราบแล้ว, documented

---

## 5. What Went Well / What Was Hard

### Went Well
- **Telegram debug ชัดเจน** — traced execution data ใน SQLite เพื่อระบุ root cause ได้แม่นยำ
- **T024 spec ครบ** — spec มีข้อมูลพร้อม implement เลย: credential ID, folder ID, node params, error handling
- **Role clarification** — user correct ทันที เมื่อ Claude assume Codex ไม่มีสิทธิ์ live system
- **post-commit hook auto-sync** ทำงานได้ดี — ลด overhead sync มาก

### Was Hard
- **Telegram "undefined" มี 3 layers** — ต้องแก้ 3 รอบ (workflowName → $json overwrite → double footer) แต่ละรอบต้อง test ใหม่
- **curl: Argument list too long** — workflow 109 nodes ทำให้ไม่สามารถ pass JSON เป็น arg ได้ → workaround: `--data-binary @file`
- **Claude assume role ของ Codex ผิด** — อ่าน CODEX.md แล้ว assume ว่า "DO NOT access live n8n" ยังใช้อยู่ ทั้งที่ user ยืนยันว่า outdated → **lesson: อ่าน doc ก่อน assume เสมอ**

---

## 6. Memory Update

อัปเดต MEMORY.md:
- Collaboration section: อัปเดต role ของ Codex จาก "planner (docs, specs)" → "executor (async)"
- เพิ่ม n8n multi-input node pattern

---

## 7. One-Line Session Summary

Fixed Telegram OCR notifications (3-layer bug), wrote T024 Google Drive spec, and corrected Codex role from Planner → Executor (Async) with live n8n/SQLite access.
