# Incident Triage Checklist — n8n / OCR System

> ใช้ร่วมกันระหว่าง CC และ Codex เวลา execution error โผล่
> **Contributors:** Codex (2026-02-25), CC

---

## 1. Identify

- [ ] จด execution ID, เวลาเกิดเหตุ, workflow name/id
- [ ] ระบุ impact: user-facing ไหม? (response fail / notification fail / side-effect fail)

## 2. Locate Failure

- [ ] ดู `lastNodeExecuted`
- [ ] ระบุ node ที่ error จริง + error message / HTTP code
- [ ] แยกชั้นที่พัง: `input` → `processing` → `persistence` → `response` → `notification`

## 3. Confirm Root Cause (ห้ามเดา)

- [ ] เปิด `execution_data` ดู payload จริงที่เข้า node error
- [ ] เทียบ node config ที่เกี่ยวข้อง (`parse_mode`, `onError`, `retry`, `timeout`, credentials)
- [ ] ตรวจว่าเป็น data-specific edge case หรือ config/schema issue

## 4. Blast Radius

- [ ] OCR result ได้ไหม?
- [ ] DB / Sheet / Drive เขียนสำเร็จไหม?
- [ ] มี pending state / queue ค้างไหม?
- [ ] มี risk ทำซ้ำแล้วพังอีกกับเคสคล้ายกันไหม?

## 5. Fix Plan

- [ ] กำหนด fix เล็กที่สุดที่แก้ root cause ได้
- [ ] ระบุ fallback / fail-safe (ไม่ให้ main path ล้มเพราะ side system)
- [ ] เช็ก security impact (data leak / injection / auth / unsafe default)

## 6. Implement + Verify

- [ ] Patch ผ่านช่องทางที่ถูกต้อง (n8n REST API — ห้าม direct JSON edit)
- [ ] Re-fetch config/code ยืนยัน patch applied จริง
- [ ] ทดสอบซ้ำอย่างน้อย 1 เคสใกล้เคียง (หรือ simulation)
- [ ] บันทึกผล: cause / fix / verify / residual risk

## 7. Docs Sync

- [ ] อัปเดต review/task/HANDOFF (ถ้ามีผลต่อสถานะหรือบทเรียน)
- [ ] เพิ่ม lesson/pattern ถ้าเป็นเคสที่มีคุณค่าทำซ้ำได้

---

## Quick Heuristics (OCR / Telegram)

| สัญญาณ | สิ่งที่ต้องเช็ก |
|--------|----------------|
| Dynamic text ส่งเข้า Telegram | คิดเรื่อง escaping ก่อนเสมอ (`parse_mode`, special chars) |
| Notification fail | ≠ OCR fail — แยก impact ก่อนสรุป |
| Optional side-effect (Drive, Sheets) | ใช้ `continueOnFail: true` ให้เหมาะสม |
| Runtime issue ที่หาสาเหตุไม่เจอ | ตรวจ execution payload จริงก่อนแก้ code/config |
| "Verified" จาก code inspection | ≠ "Verified" จาก execution — ต้องแยกให้ชัด |

---

## Lesson ที่มาพร้อมกัน (Codex, T028 follow-up)

> บทเรียนจาก T028: OCR ผ่าน แต่ล้มที่ชั้น output formatting/Telegram rendering
> Edge case ที่พลาดได้ง่ายถ้าตรวจแค่ logic หลัก

สิ่งที่เพิ่มความรอบคอบ:
- เช็ก execution end-to-end ทุกชั้น: input → processing → persistence → response → notification
- Dynamic text ใน Telegram/HTML/Markdown → คิด escaping เป็น default
- Patch workflow → ตรวจ node config ที่เกี่ยวข้อง (`parse_mode`, `retry`, `onError`) ควบคู่ code node เสมอ
- หลังแก้ incident → เช็ก execution data ยืนยัน root cause ไม่เดา
