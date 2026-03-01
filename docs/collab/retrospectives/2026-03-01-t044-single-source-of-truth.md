# Session Retrospective — 2026-03-01
## Theme: T044 Single Source of Truth

---

## 1. Git Summary

| Commit | Message | What it did |
|--------|---------|-------------|
| `3c2b912` | feat(T044): add VENDOR_MAP to gg-data-gateway + write spec | CC: added Code(VENDOR_MAP) node to gg-data-gateway (5 hardcoded vendors), extended Switch to 6 outputs, wrote T044 spec for Codex |
| `2ad24ea` | chore: update FORWARD checkpoint for T044 | Milestone checkpoint after spec done |
| `2bd7884` | feat(T044): unify OCR feedback source metadata | Codex: Phase 1+2+3 — ocr-km-logger vendor enrichment, ocr-training enrichment, ocr-km-suggest KPI grouping + Telegram text |
| `014ecd0` | chore(T044): HANDOFF update — Codex running | HANDOFF update while Codex executing |
| `2d27652` | Merge branch 'stable' into agents/codex | Merge sync |
| `10f6d58` | chore: resolve HANDOFF merge | Resolved merge conflict on HANDOFF.md |
| `dd83682` | Merge branch 'stable' into agents/codex | Second merge sync |
| `6967c98` | feat(T044): complete — Phase4 dashboard + CC fixes | CC: Phase 4 dashboard switch to TRAIN_CASES + 3 hot-fixes to Codex's buildAccuracyStats |
| `cb9f852` | chore(handoff): T044-Phase4 complete | HANDOFF cleanup — removed T044-Phase4 from Pending |

---

## 2. Tasks Completed

### T044 — Single Source of Truth: Unified OCR Feedback Pipeline

**Problem solved:** ข้อมูล OCR แยก 2 pipeline — TRAIN_CASES (Telegram training) กับ OCR_FEEDBACK (admin feedback) → KPI report และ Dashboard อ่านคนละที่ ภาพรวมผิด (doc_type="other", vendor="unknown", accuracy stats ไม่รวม telegram_train)

**Phases:**

| Phase | Owner | Changes |
|-------|-------|---------|
| A: gg-data-gateway VENDOR_MAP | CC | เพิ่ม `Code (VENDOR_MAP)` node (5 vendors hardcoded); Switch `numberOutputs: 6`; allowed list update |
| 1: ocr-km-logger enrichment | Codex | `Code (Compute Diffs)`: เพิ่ม VENDOR_MAP lookup + `enrichFromVendorMap()` + `ocr_accuracy_pct` computation; `continueOnFail=true` on GSheets nodes |
| 2: ocr-training enrichment | Codex | `Code (Prepare KM Log Payload)`: เพิ่ม vendor enrichment after building payload; `continueOnFail=true` on HTTP node |
| 3: ocr-km-suggest KPI | Codex | `Code (Analyze Patterns)`: เพิ่ม `buildAccuracyStats()`, `accuracy_by_doc_type`, `accuracy_by_vendor`, `overall_accuracy_pct`; `Code (Build Telegram)`: KPI text ใหม่ |
| 4: ocr-dashboard | CC | เปลี่ยน `GSheets (OCR_FEEDBACK)` → `GSheets (TRAIN_CASES)`, sheetName `OCR_TRAIN_CASES`; `Code (Build HTML)`: `row.accuracy_score` → `row.ocr_accuracy_pct`; blank pct skip; label "X scored / Y total bills" |

**CC Hot-fixes (ก่อน merge):**
- `buildAccuracyStats`: `Number('') = 0` bug → explicit empty/null/undefined check ก่อน Number()
- `allWithPct` filter: skip blank strings
- count=0 vendor entries: เพิ่ม `.filter(([, stat]) => stat.total > 0)`

**Outcome:**
- overall_accuracy_pct = **73.2%** (19 scored / 39 total bills)
- by doc_type: fuel=85.0% (4 docs), other=70.0% (15 docs)
- ocr-km-suggest KPI: overall=69%, fuel=50%(1 doc), other=70%(15 docs)
- Dashboard live: `http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!`
- Review: `docs/collab/reviews/T044-review.md` (8/10 APPROVED)

---

## 3. Decisions Made

### 3.1 VENDOR_MAP ใน Code node แทน GSheets sheet
**ตัดสินใจ:** hardcode 5 vendors ใน `Code (VENDOR_MAP)` node แทนที่จะสร้าง GSheets sheet ใหม่

**เหตุผล:** พยายามสร้าง VENDOR_MAP tab ใน GSheets ผ่าน temp workflow แต่ล้มเหลว (exec status=success แต่ sheet ไม่ถูกสร้าง เพราะ `operation: "create"` ไม่มี `resource: "sheet"` อาจสร้าง spreadsheet ใหม่แทน) → Code node เร็วกว่า ไม่มี external dependency

**Trade-off ยอมรับ:** เพิ่ม vendor ใหม่ต้อง patch workflow แทนแก้ Sheet — แต่ vendor เปลี่ยนน้อย

### 3.2 ไม่ล้าง FIELD_DIFFS / TRAIN_CASES แม้ข้อมูลเก่าจะ "dirty"
**ตัดสินใจ:** ปล่อยให้ data สะสมตามธรรมชาติ

**เหตุผล:**
- 158 missing errors มาจาก early training data (OCR ยังไม่รู้จักบิลน้ำมัน) — ไม่ skew production
- 6 KM Rules ที่ได้มาจาก data นี้ยังใช้งานได้จริง
- ล้าง = เสีย accuracy baseline, ต้องสะสมใหม่ตั้งแต่ต้น
- Data ใหม่ที่เข้ามาหลัง T043+T041 จะ clean ขึ้นเองตามเวลา

**Alternative rejected:** Archive rows (archived=true column), Clear FIELD_DIFFS เฉพาะ — user เลือกไม่ทำอะไร

### 3.3 ocr_accuracy_pct formula สำหรับ telegram_train
**ตัดสินใจ:** `(4 - min(diff_count, 4)) / 4 * 100`

**เหตุผล:** diff_count = จำนวน field ที่ user แก้ไข → 0 corrections = perfect (100%), 4+ = fail (0%). เป็น proxy ที่ reasonable สำหรับ training path ที่ไม่มี explicit accuracy score

---

## 4. Issues Found / Deferred

### 4.1 Historical telegram_train rows — blank ocr_accuracy_pct
**Description:** 13 existing telegram_train rows ใน TRAIN_CASES มี `ocr_accuracy_pct` ว่างเปล่า (ก่อน T044)
**Severity:** Low
**Why deferred:** excluded จาก accuracy calc แทนนับเป็น 0 — ไม่กระทบ current KPI; ต้อง backfill ด้วย manual script
**Next action:** เขียน script ดึง diff_count จาก FIELD_DIFFS แล้วคำนวณย้อนหลัง (optional)

### 4.2 Admin Telegram notify — `chat_id is empty`
**Description:** ocr-km-suggest exec `154827` ส่ง Telegram report ล้มเหลว `Bad Request: chat_id is empty`
**Severity:** Medium
**Why deferred:** pre-existing issue ก่อน T044 — ไม่ใช่ regression
**Next action:** ตรวจ `Code (Build Telegram)` ว่า chat_id source มาจากไหน; อาจต้องเพิ่ม fallback env var

### 4.3 FIELD_DIFFS ไม่มี `source` column
**Description:** FIELD_DIFFS ทุก row มี source='' — ไม่รู้ว่า error มาจาก feedback_kpi หรือ telegram_train
**Severity:** Low
**Why deferred:** ไม่ได้ block analysis ปัจจุบัน; ต้องเพิ่ม source field ใน ocr-km-logger ตอน write FIELD_DIFFS
**Next action:** T029A patch — เพิ่ม `source` column ใน FIELD_DIFFS append

### 4.4 gg-data-gateway — `!` in API key ต้อง single quote เสมอ
**Description:** `curl -H "x-api-key: ocm-cabonrecipte!"` ล้มเหลวเพราะ `!` ถูก bash history expand ใน double quotes
**Severity:** Low (gotcha เท่านั้น)
**Next action:** บันทึกไว้ใน MEMORY

---

## 5. What Went Well / What Was Hard

### Went Well ✅
- **Codex execution เร็วมาก** — Phase 1+2+3 เสร็จภายใน session เดียว patch 3 workflows
- **CC hot-fix loop กระชับ** — เจอ bug (Number('') = 0) วิเคราะห์ได้เร็ว fix ได้ตรงจุด
- **Dashboard Phase 4 ราบรื่น** — เปลี่ยน 2 nodes + fix Code node ได้ภายใน 15 นาที
- **FIELD_DIFFS analysis** — ดึงข้อมูลจริงมาวิเคราะห์ root cause ได้ชัด (missing = early training, not OCR bug)

### What Was Hard / Took Longer ⚠️
- **VENDOR_MAP GSheets sheet creation ล้มเหลว** — ใช้เวลา debug ก่อนรู้ว่าต้องเปลี่ยนแนวทางเป็น Code node
- **Shell quoting `!`** — `curl -H "x-api-key: ocm-cabonrecipte!"` ส่ง 401 ตลอดจน verbose test reveal ว่า `!` ถูก expand (session ก่อนหน้า ใน session นี้เจออีกครั้ง)
- **Python requests.Session() + n8n cookie** — ยังเป็นปัญหาเดิม (documented แล้ว)
- **buildAccuracyStats Number('') bug** — Codex ไม่ catch เพราะ JavaScript silently treat '' as 0 — ต้องเจอตอน verify ผล KPI ออกมาผิด

---

## 6. Memory Update

ไม่มี pattern ใหม่ที่ยังไม่ได้บันทึก — อัปเดต 2 entries:

---

## 7. One-Line Session Summary

T044 Single Source of Truth สำเร็จสมบูรณ์ — TRAIN_CASES เป็น single source แล้ว, gg-data-gateway มี VENDOR_MAP, ocr-km-suggest รายงาน accuracy by doc_type/vendor, dashboard แสดง 73.2% จาก 19 scored / 39 total bills

---

_Saved: 2026-03-01_
