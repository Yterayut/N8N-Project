# T029C — OCR Runtime Rules: Dynamic Rules Integration

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Status:** STUB — รอ T029B + T029D complete ก่อนเริ่ม
**Depends on:** T029B (≥1 approved lesson) + T029D (benchmark baseline exists)
**Risk:** สูงมาก — กระทบ main OCR workflow ทุก request

---

## Overview

Patch `ocr-invoice-processor` (main workflow) ให้อ่าน OCR_KM_RUNTIME_RULES (active rules เท่านั้น) และ apply ที่ post_normalize / validation_exception scope

**Default: Feature flag `OCR_RUNTIME_RULES_ENABLED=false`**
**จะ enable เฉพาะหลัง:**
1. มี benchmark baseline จาก T029D
2. มี ≥1 approved rule ใน RUNTIME_RULES
3. Human review + approve การ enable

---

## Fail-safe Requirements (mandatory, ไม่ negotiate)

- ถ้า Sheets ล่ม → ใช้ empty rules (ไม่ fail)
- ถ้า rule parse error → skip rule นั้น log warning
- ถ้า OCR_RUNTIME_RULES_ENABLED=false → skip ทั้งหมด
- ห้าม rule type `vendor_hint` (prompt injection) ใน v1 ของ T029C

---

## Note สำหรับ Codex (อ่านตอน T029C ถูก assign):
1. ต้องผ่าน benchmark T029D ก่อน — ห้าม implement โดยไม่มี baseline
2. อ่าน T029-architecture.md ส่วน Risk Assessment T029C ให้ครบ
3. เพิ่ม Discussion section ทุก concern ก่อน start — CC ต้อง approve

_Spec จะเพิ่มรายละเอียดเมื่อ T029B verified_
