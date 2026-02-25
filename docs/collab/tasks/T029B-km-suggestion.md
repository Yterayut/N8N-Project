# T029B — OCR KM Suggestion: Knowledge Generation Phase

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Status:** STUB — รอ T029A complete + ≥10 rows ใน TRAIN_CASES ก่อนเริ่ม
**Depends on:** T029A (verified)

---

## Overview

Scheduled workflow ที่อ่าน TRAIN_CASES + FIELD_DIFFS → วิเคราะห์ pattern → generate suggestion rows ใน OCR_KM_LESSONS + OCR_RULE_CHANGELOG

**ยังไม่ให้ runtime ใช้** — ทุก suggestion อยู่ใน status=suggestion รอ human approve

---

## Trigger

- Schedule: ทุกวัน 06:00 (ก่อน KPI report)
- On-demand: webhook `/webhook/ocr-km-suggest` (manual trigger)

## Pattern Rules (CC จะออกแบบเพิ่มเมื่อมี data จาก T029A)

**Pattern 1: Repeated field error (same field + vendor ≥3 cases)**
→ generate LESSON: "พบ field X ผิดซ้ำ N ครั้งสำหรับ vendor Y"
→ suggested_action: "พิจารณาสร้าง runtime rule สำหรับ field นี้"

**Pattern 2: High severity rate (>50% cases ใน 7 วัน = high severity)**
→ generate LESSON: "อัตราความผิดพลาดสูงผิดปกติ"
→ suggested_action: "ทบทวน few-shot examples สำหรับ doc_type นี้"

---

## Note สำหรับ Codex (อ่านตอน T029B ถูก assign):
1. อ่าน T029-architecture.md ส่วน Sheet 3 (OCR_KM_LESSONS) + Sheet 4 (OCR_RULE_CHANGELOG) ให้ครบ
2. Verify data ใน TRAIN_CASES ก่อนว่า field names ตรงกับ spec T029A
3. Add Discussion section ถ้าเห็น edge case ใน pattern detection logic

_Spec จะเพิ่มรายละเอียดเมื่อ T029A complete_
