# Plan: Production Hardening ตาม `docs/improve.md`

## 1) เป้าหมาย
- ปิดความเสี่ยง production ตาม `P0/P1/P2/P3` โดยไม่ทำให้ OCR regression
- รักษา journey ปัจจุบัน (`/ocr-dev` sync response) และคุณภาพ OCR ที่เทรนไว้
- เพิ่มความเสถียร queue/retry/timeout/validation เพื่อรองรับ scale

## 2) แนวทางดำเนินการ (หลักการ)
- ทำแบบ `Phase + Gate`
- ทุก phase ต้องมี:
  - patch
  - retest (happy path + fail path)
  - KM/Changelog
  - sanitized export
  - push `stable`
- แยกงาน “risk สูง” ออกจาก “refactor/cleanup” เพื่อลด regression

## 3) แผนพัฒนา (Phase-by-Phase)

## Phase 0: Baseline Re-Validation (ก่อนแก้จริง)
### เป้าหมาย
ยืนยันว่า checklist ใน `docs/improve.md` ข้อไหนยังเป็นปัญหาจริงใน live workflow ล่าสุด

### งาน
- Audit live workflow `test-workflow` (`up1n75qEhbsXswii`) เทียบ `docs/improve.md`
- สถานะต่อข้อ: `open / fixed / partially_fixed / not_applicable`
- จัด priority ใหม่ (อิงของจริง ไม่ใช่เอกสารอย่างเดียว)

### Output
- `docs/ocr/improve-audit-status.md`
- ตาราง mapping:
  - issue id (จาก improve.md)
  - status
  - evidence (node/line/execution)

### Gate ผ่าน
- มีรายการ `open` ที่ยืนยันแล้วพร้อมลงมือ patch
- ไม่มีการทำ patch ก่อน audit จบ (ยกเว้น emergency)

## Phase 1: P0/P1 Stabilization (ต้องแก้ก่อน production)
### Status (2026-02-23)
- **Completed by Claude Code (T003/T004/T005)** for all P0/P1 items listed in `docs/improve-by-claude-23-02-2026.md`
- Documentation sync (T006) updates this plan to reflect completion and move focus to Phase 2

### Scope
- P0 + P1 ทั้งหมดใน `docs/improve.md` (เฉพาะที่ audit แล้วว่ายัง open)

### งานหลัก
1. แก้ `round3` undefined (P0)
2. Re-ask result ต้อง normalize+validate ซ้ำ
3. `allHeaders` propagation ให้ log `caller_ip` ได้จริง
4. MIME sniffing memory optimization
5. จำกัดจำนวนไฟล์ต่อ request / queue path
6. เพิ่ม Document Classifier ใน queue path (ให้เทียบคุณภาพ main path)
7. Queue worker failure handling + retry status (`error` ไม่ใช่ `done`)
8. ลบ trailing `\\n\\n` ใน HTTP URLs (ถ้ายังมี)
9. เติม retry + timeout ให้ HTTP nodes ที่ยังขาด โดยเฉพาะ re-ask / queue HTTP nodes

### Test Cases (ขั้นต่ำ)
- OCR success: fuel / electricity / fleet_card
- OCR fail: bad pdf, no pages
- Re-ask success + re-ask fail
- Queue busy / retry path
- Multi-file over limit
- Large file over limit
- caller_ip logged จริง

### Output
- patched workflow (live)
- `exports/workflows/test-workflow.sanitized.json`
- `docs/ocr/loop-learning-log.md` อัปเดต
- KM/changelog entries

### Gate ผ่าน
- ไม่มี P0/P1 open ที่ confirmed และอยู่ใน scope ✅
- smoke tests ผ่านครบ (per HANDOFF/T003-T005 notes) ✅
- OCR regression test set baseline available via T002 matrix ✅

## Phase 2: P2 Scale & Safety (ก่อน scale จริง)
### Scope
P2 ใน `docs/improve.md` + operational safety

### งานหลัก
1. Google Sheets bottleneck mitigation (short-term)
   - ลด `Get All row_key` frequency / cache
   - batch writes เท่าที่ทำได้
   - reconciliation job ถ้า save fail หลัง response
2. ย้าย hardcoded pricing -> env/config
3. file size validation (Webhook layer)
4. sanitize Gemini error message ก่อนส่ง client
5. few-shot truncation แบบ safe boundary
6. review “response before save” strategy และเพิ่ม reconciliation/repair job
7. ลบ disabled legacy nodes (ถ้า audit แล้วยังไม่ใช้จริง)

### Test Cases
- Scale smoke (10/20 concurrent)
- Google Sheets temporary fail simulation
- Gemini error sanitization (client ต้องไม่เห็น internal raw มากเกินไป)
- few-shot prompt integrity (JSON example ไม่ถูกตัดกลาง)

### Output
- hardening patch set
- operation notes / rollback notes
- updated load test evidence

### Gate ผ่าน
- ไม่มี P2 “high impact” ค้างที่เปิด production risk สูง
- error path ทั้งหมดตอบ JSON มาตรฐาน

## Phase 3: P3 Cleanup / Maintainability
### Scope
ปรับโครงสร้างให้ดูแลง่ายขึ้น โดยไม่เปลี่ยน behavior หลัก

### งานหลัก
- ย้าย hardcoded values -> env/config
- workflow rename (จาก `test-workflow` -> production name)
- SLA thresholds / queue batch size env-driven
- hardcoded workflow metadata in Telegram -> dynamic `$workflow.name/$workflow.id`
- shared helper strategy ลด copy-paste (`nowThai()` ฯลฯ)
- electricity validation flexibility (เช่น `electricity_ref` regex ที่แข็งไป)
- MIME support extension (HEIC/TIFF) ถ้าอยู่ใน scope การใช้งานจริง

### Output
- cleaner workflow
- docs update (`cmd.md`, runbook, config keys)

### Gate ผ่าน
- behavior เท่าเดิม (functional parity)
- team maintain ได้ง่ายขึ้น

## Phase 4: Architecture Upgrade (P2/P3 long-term)
### Scope
ข้อเสนอเชิงสถาปัตยกรรมใน `docs/improve.md` (ทำเป็น roadmap แยก)

### งานหลัก
1. ออกแบบย้าย `OCR_RAW / OCR / OCR_QUEUE` จาก Google Sheets -> DB (PostgreSQL/Supabase)
2. รวม pipeline queue path ให้ share logic กับ main path
3. structured logging + metrics + dashboard
4. error rate / latency / cost alerts
5. production naming + deployment topology cleanup

### Output
- `execution-plan-db-migration.md`
- schema / migration plan
- rollout plan แบบ canary

## 4) Risk Management (ปิดความเสี่ยง)

## ความเสี่ยง 1: Patch แล้ว OCR regression
### วิธีปิด
- ใช้ regression set ที่สร้างไว้ (fuel/electricity/fleet_card)
- retest ก่อน/หลังทุก phase
- บันทึกผลใน `OCR_TRAIN_CASES` / KM / changelog

## ความเสี่ยง 2: Patch queue path แล้ว behavior หลุดจาก main path
### วิธีปิด
- สร้าง test matrix เทียบ main vs queue path (same file -> canonical output shape)
- ใช้ shared normalize/validate logic ให้มากที่สุด

## ความเสี่ยง 3: Rate limit / queue tuning ทำให้ throughput แย่ลง
### วิธีปิด
- วัด p95 latency ก่อน/หลัง
- tune ด้วย env/config ไม่ hardcode

## ความเสี่ยง 4: Cleanup legacy nodes ทำให้ path ที่ยังใช้อยู่พัง
### วิธีปิด
- Audit connections + execution history ก่อนลบ
- export sanitized backup ทุกครั้งก่อนลบ

## 5) Definition of Done (สำหรับ improve.md รอบนี้)
ถือว่า “ปิดงาน improve.md รอบ production hardening” เมื่อ:
- P0/P1 ที่ confirmed-open ถูกปิดครบ
- P2 high-impact ถูกปิดหรือมี mitigation ชัดเจน
- มี regression evidence หลัง patch
- มี KM/changelog ครบทุก patch
- workflow export sanitized + push `stable` ทุก phase
- มีเอกสารสถานะ `improve-audit-status.md` ว่าข้อไหนปิดแล้ว/เหลืออะไร

## 6) ลำดับลงมือที่แนะนำ (รอบถัดไป)
1. เริ่ม `Phase 2` ทันที โดยโฟกัส 3 เรื่อง impact สูง:
   - file size validation (Webhook layer)
   - sanitize Gemini error response ก่อนส่ง client
   - few-shot truncation safe boundary
2. วาง short-term mitigation สำหรับ Google Sheets bottleneck (`Get All row_key`, reconciliation job)
3. ใช้ `docs/collab/tasks/regression-test-matrix.md` (T002) รัน regression หลังทุก patch
4. commit + push `stable` พร้อม KM/changelog/update sanitized export
5. เมื่อ P2 high-impact ปิดแล้ว ค่อยเข้ารอบ `Phase 3` cleanup

## 7) Phase 1 Completion Notes (from HANDOFF)
- **T003:** Fixed `round3`, `allHeaders`, MIME sniffing optimization, file-count guard, queue classifier, trailing URL newline cleanup
- **T004:** Re-ask result now re-enters normalize/validate before final decision
- **T005:** Queue worker marks failed items as `error` (not `done`)
