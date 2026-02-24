# Code Review — T026: OCR Feedback Receiver + KPI System

**Reviewer:** Claude Code
**Date:** 2026-02-25
**Codex commit:** `2446355`
**Score:** 8.5 / 10

---

## Summary

Codex implement T026 ครบถ้วน — 2 workflows ใหม่ active และทำงานได้จริง ทุก test ผ่าน CC verify live endpoint แล้ว

| Item | Status |
|------|--------|
| `ocr-feedback-receiver` workflow | ✅ Active (`ztJ8oCBHREUPPry6`) |
| `ocr-kpi-report` workflow | ✅ Active (`yCqvdl3vrHGgiBMt`) |
| `OCR_FEEDBACK` sheet | ✅ Created (gid: `1589922285`) |
| Test 1 (happy path) | ✅ HTTP 200 — verified live by CC |
| Test 2 (invalid key) | ✅ HTTP 401 `{"error":"UNAUTHORIZED"}` — verified live by CC |
| Test 3 (unknown request_id) | ✅ 200 + `ocr_found=false` |
| Test 4 (multi-bill) | ✅ 2 rows appended |
| Test 5 (KPI report) | ✅ Telegram received |

---

## ✅ What Codex Did Well

### 1. Path Collision Detection (สำคัญมาก)
Codex ค้นพบว่า workflow หลัก `ocr-invoice-processor` มี `Webhook_OCR_Feedback → path: ocr-feedback` อยู่แล้ว — ถ้าสร้าง path เดิมจะทำให้ request วิ่งผิด workflow โดยอัตโนมัติ Codex เปลี่ยนเป็น `ocr-feedback-kpi` และ document เหตุผลชัดเจนใน Discussion section

### 2. webhookId Bug Documentation
Codex พบและแก้ปัญหา REST-created webhook node ที่ต้องมี `webhookId` field ถึงจะ register route ได้ — เป็น n8n gotcha ที่ไม่มีใน official docs

### 3. Test Coverage ครบ
รัน 5 test cases ครบ + บันทึกผลพร้อม execution ID และ row count

### 4. Defensive Error Handling
`request_id` ไม่เจอ → เก็บ raw ไว้ flag `ocr_found=false` ไม่ fail ตาม spec

---

## ⚠️ Issues Found

### [HIGH] Endpoint Path ต้องแจ้ง Admin CarbonReceipt
Path เปลี่ยนจาก spec → admin ต้อง call `/webhook/ocr-feedback-kpi` ไม่ใช่ `/webhook/ocr-feedback`
- **Action required:** CC แจ้ง admin CarbonReceipt ว่า endpoint ที่ถูกต้องคือ `/webhook/ocr-feedback-kpi`

### [LOW] Tmp Workflows ยังอยู่ใน n8n
Codex ทิ้ง 2 tmp workflows ไว้:
- `HxquPx1lKdWReSFY` — `tmp-create-ocr-feedback-sheet`
- `siAYUa8Vawvj3CDJ` — `tmp-webhook-create-ocr-feedback-sheet`

ทั้งสอง inactive แล้ว ไม่กระทบระบบ แต่ควร delete เพื่อความเป็นระเบียบ

### [LOW] OCR_FEEDBACK Header Order
Headers ถูก auto-generate จาก first append (`autoMapInputData`) — อาจไม่ตรงลำดับที่ spec กำหนด ไม่กระทบ function แต่อาจทำให้อ่านยากขึ้น

### [INFO] `Webhook_OCR_Feedback` ใน Main Workflow
Node นี้มีอยู่จริงใน `ocr-invoice-processor` (path: `ocr-feedback`) — CC ต้องตรวจว่า node นี้ทำอะไรใน workflow หลัก และ path ชนกันนี้เป็น bug เดิมหรือ feature ที่ยังไม่ได้ใช้

---

## Pattern Learned → n8n-patterns.md

**PATTERN-008: REST-created webhook node ต้องมี `webhookId`**
เมื่อสร้าง workflow ผ่าน REST API และมี webhook node — ต้อง set `webhookId` (UUID) ใน node parameters ด้วย ไม่งั้น route จะไม่ register (404) แม้ workflow จะ active

---

## Merge Decision

✅ **Approved — Merge to stable**

Issues ที่เจอเป็น LOW/INFO ทั้งหมด ยกเว้น path notification ที่ CC จะแจ้ง admin เอง

---

## Codex Response
*(Codex: fill in หลังอ่าน review)*

**Date:**
**Comments:**
