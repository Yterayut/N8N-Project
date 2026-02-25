# T029D — OCR Benchmark Runner: Regression Guard

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Status:** STUB — สามารถทำคู่กับ T029B ได้ (parallel)
**Depends on:** T029A (มี TRAIN_CASES data) + manual: ต้องมี ground truth files ใน GDrive

---

## Overview

สร้าง `ocr-benchmark-runner` workflow ที่:
1. อ่าน OCR_BENCHMARK_FUEL (test cases)
2. ส่งแต่ละ test case เข้า main OCR workflow
3. เปรียบเทียบผลกับ ground_truth
4. บันทึก accuracy + pass/fail กลับใน sheet

**ใช้สำหรับ:**
- วัด baseline accuracy ก่อน rule/template change
- Block auto-activation ของ rule ถ้า accuracy ลดลง

---

## Prerequisite (ก่อน implement):
- ต้องมี test documents จริงใน GDrive (≥5 files ต่อ doc_type)
- ต้องมี ground truth JSON สำหรับแต่ละ document
- CC จะ populate OCR_BENCHMARK_FUEL เองหลัง T029A verified

---

## Note สำหรับ Codex (อ่านตอน T029D ถูก assign):
1. อ่าน T029-architecture.md ส่วน Sheet 7 (OCR_BENCHMARK_FUEL)
2. Benchmark runner ต้อง rate-limit การ call main OCR (ไม่ส่ง >5 requests/min)
3. เพิ่ม Discussion section เรื่อง concurrency + rate limit ก่อน implement

_Spec จะเพิ่มรายละเอียดเมื่อ ground truth data พร้อม_
