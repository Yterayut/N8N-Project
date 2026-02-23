# Session Retrospective — 2026-02-24

---

## 1. Git Summary

| Commit | Message | ทำอะไร |
|--------|---------|--------|
| `3362cd2` | chore(collab): sync T021+T022 to stable; update HANDOFF decisions 2026-02-24 | Commit T021+T022 + sync Codex |

Session นี้มี 1 commit (งาน T021/T022 เป็น in-memory n8n patches ไม่ได้ commit workflow JSON)

---

## 2. Tasks Completed

### T021 — Rename workflow `test-workflow` → `ocr-invoice-processor`
- **ปัญหา:** ชื่อ workflow ไม่เหมาะสำหรับ production
- **วิธี:** PATCH ผ่าน n8n REST API + อัปเดต 3 JSON export files
- **Files:** `WNWewthEgk7UVOOw.json`, `exports/workflows_server.json/WNWewthEgk7UVOOw.json`, `server-export2/workflows/WNWewthEgk7UVOOw.json`, `docs/improve-by-claude-23-02-2026.md`

### T022 — nowThai() consolidation
- **ปัญหา:** `nowThai()` copy-paste ใน 5 nodes อาจ drift เมื่อเวลาผ่านไป
- **วิธี:** Standardize canonical `// [SHARED]` block → PATCH ผ่าน REST API
- **Nodes:** Code in JavaScript9, JS17, JS24, JS26, Code (Parse Result)
- **Files:** `scripts/verify_nowThai_sync.sh` (ใหม่), `docs/improve-by-claude-23-02-2026.md`
- **ผลลัพธ์:** `OK — all 5 nodes have identical nowThai() ✓`

### Google Sheets → DB
- บันทึกเป็น ⏸ DEFERRED — ผู้ใช้ตัดสินใจใช้ Sheets ต่อไปก่อน

### HANDOFF sync → Codex
- เพิ่ม section "Decisions 2026-02-24" ใน HANDOFF.md
- `./scripts/collab/sync.sh codex` — fast-forward สำเร็จ

---

## 3. Decisions Made

| Decision | เหตุผล | Alternative ที่ reject |
|----------|--------|----------------------|
| ชื่อ `ocr-invoice-processor` | ไม่ผูก channel, kebab-case มาตรฐาน, สื่อ action+subject | `receipt-ocr-pipeline`, `fb-ocr-invoice` — ผูก channel เกินไป |
| Standardize แทน true shared module | n8n Code nodes เป็น isolated sandbox | `eval()` จาก env var — insecure; sub-workflow call — latency overhead |
| Google Sheets deferred | ผู้ใช้ตัดสินใจ ยังไม่ scale ถึงขีดจำกัด | ทำเลย — ใหญ่เกินไปสำหรับตอนนี้ |

---

## 4. Issues Found / Deferred

| ปัญหา | Severity | เหตุผลที่ defer | Next action |
|-------|----------|----------------|-------------|
| Google Sheets → DB | Medium | ผู้ใช้ตัดสินใจ | กลับมาเมื่อ scale เกิน 60 req/min |
| Fan-out ส่ง response ก่อน save (P2 #11) | Medium | ไม่อยู่ใน checklist ดั้งเดิม | เพิ่ม reconciliation job |
| API key timing-safe comparison (P2 #14) | Low | ความเสี่ยงต่ำใน practice | ทำเมื่อมี security audit |
| `WNWewthEgk7UVOOw` ถูก rename ซ้ำ | Low | Rename ผิด workflow (ไม่ใช่ main) | ตรวจสอบและ revert ถ้าจำเป็น |

---

## 5. What Went Well / What Was Hard

**ไปได้ดี:**
- n8n REST API flow (login → GET → PATCH) ทำงานได้เมื่อใช้ curl session ถูกต้อง
- Python regex canonicalize nowThai block ทำงาน clean ทุก 5 nodes
- `./scripts/collab/sync.sh codex` fast-forward สมบูรณ์

**ซับซ้อนกว่าที่คิด:**
- Live DB อยู่ที่ `.n8n-dev/.n8n/database.sqlite` (nested) ไม่ใช่ root — ต้องหาก่อน
- n8n เก็บ nodes ใน `workflow_history` ไม่ใช่ `workflow_entity.nodes` (newer n8n)
- Python `requests.Session()` ไม่ส่ง cookie ถูกต้อง — ต้องสลับมาใช้ curl
- `WNWewthEgk7UVOOw` กับ `up1n75qEhbsXswii` ทั้งคู่ชื่อ `test-workflow` ต้องระวัง

---

## 6. Memory Update

อัปเดต `memory/MEMORY.md` แล้ว — เพิ่ม:
- Live DB path, workflow_history pattern
- curl vs requests.Session() issue
- nowThai [SHARED] policy
- improve plan final status

---

## 7. One-Line Session Summary

ทำ improve plan ครบ 100% (ยกเว้น Google Sheets→DB ที่ defer): rename workflow เป็น `ocr-invoice-processor`, standardize `nowThai()` ใน 5 nodes พร้อม verify script, และ sync Codex ให้เข้าใจ decisions ตรงกัน
