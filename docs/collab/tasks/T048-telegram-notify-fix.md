# T048 — Fix Telegram Notify chat_id ใน ocr-km-suggest

**Owner:** Codex (Executor)
**Reviewer:** Claude Code
**Priority:** 🟠 Medium — KM learning loop ขาดขา notify

---

## Problem

`ocr-km-suggest` (`NkKd02QyzLRcpIJM`) รันทุกวัน 06:00 BKK วิเคราะห์ pattern → สร้าง lessons
แต่ **Telegram ไม่ส่ง** เพราะ `chat_id` ว่างเสมอ

**Root cause** (CC diagnosed):
```javascript
// Code (Build Telegram) node — บรรทัดสุดท้าย:
telegram_chat_id: process.env.TELEGRAM_OCR_CHAT_ID || '',
```
- `.env` (root): `TELEGRAM_OCR_CHAT_ID=1776637578` ✅
- `.n8n-dev/.env` (n8n env): ไม่มี `TELEGRAM_OCR_CHAT_ID` ❌
- n8n Code node เห็นแค่ `.n8n-dev/.env` → `process.env.TELEGRAM_OCR_CHAT_ID` = undefined → `''`

---

## Solution

### Fix 1 — เพิ่ม env var ใน `.n8n-dev/.env`

```bash
echo 'TELEGRAM_OCR_CHAT_ID=1776637578' >> /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.env
```

**หมายเหตุ:** n8n ต้อง restart เพื่อ pick up env var ใหม่
แต่เนื่องจาก restart อาจ disrupt งาน → ใช้ Fix 2 แทน (ไม่ต้อง restart)

### Fix 2 — Hardcode fallback ใน Code (Build Telegram) node (ไม่ต้อง restart)

Patch `Code (Build Telegram)` ใน `NkKd02QyzLRcpIJM` ผ่าน n8n REST API:

**เปลี่ยนบรรทัด:**
```javascript
// เดิม
telegram_chat_id: process.env.TELEGRAM_OCR_CHAT_ID || '',

// ใหม่
telegram_chat_id: process.env.TELEGRAM_OCR_CHAT_ID || '1776637578',
```

**ทำทั้ง Fix 1 AND Fix 2:**
- Fix 1 = ถาวร (env var ถูกต้อง)
- Fix 2 = safety net (fallback ในกรณี env ไม่โหลด)

---

## Implementation Steps

1. Append `TELEGRAM_OCR_CHAT_ID=1776637578` ต่อท้าย `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.env`
2. Patch `Code (Build Telegram)` node ใน workflow `NkKd02QyzLRcpIJM` ผ่าน REST API
   - Login → GET workflow → แก้ jsCode บรรทัด `telegram_chat_id:` → PATCH workflow
3. Verify: อ่าน workflow กลับ ตรวจว่า `'1776637578'` อยู่ใน Code (Build Telegram)
4. Trigger ทดสอบ: `POST /webhook/ocr-km-suggest?key=ocm-cabonrecipte!` แล้วตรวจ execution log ว่า Telegram node ได้รับ chat_id ถูกต้อง

## Discussion

- Live `Code (Auth + Config)` currently accepts webhook auth from `x-api-key` header only, not `?key=` query param. Verification used `POST /webhook/ocr-km-suggest` with header `x-api-key: $OCR_SHARED_API_KEY`.

---

## Verification

```python
import sqlite3, json
DB = '/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite'
conn = sqlite3.connect(DB)
row = conn.execute("""
    SELECT id, startedAt FROM execution_entity
    WHERE workflowId='NkKd02QyzLRcpIJM'
    ORDER BY startedAt DESC LIMIT 1
""").fetchone()
print(f"Latest exec: {row}")
conn.close()
```

ตรวจว่า `Telegram (Admin Notify)` node รันและ status ไม่ใช่ error
(ถ้าไม่มี lesson ใหม่ → Telegram จะไม่ถูกเรียก แต่ chat_id ควรถูกแล้ว)

---

## Important Notes

- **Telegram credential**: `rauiF9qBRW8iVrsU` (OCM-Chatbot) — ไม่ต้องแก้
- **chat_id**: `1776637578` (ยุท personal / admin chat)
- **ห้าม restart n8n** โดยไม่ได้รับอนุญาตจาก CC
- **ห้ามแก้ค่า** `TELEGRAM_OCR_CHAT_ID` เป็นค่าอื่น

---

## Definition of Done

- [x] `TELEGRAM_OCR_CHAT_ID=1776637578` ต่อท้าย `.n8n-dev/.env`
- [x] `Code (Build Telegram)` node ใน `NkKd02QyzLRcpIJM` มี fallback `|| '1776637578'`
- [x] Workflow fetch verify: `'1776637578'` อยู่ใน jsCode
- [x] Trigger test execution สำเร็จ (current data window returned `new_lessons=0`, so Telegram branch was skipped by design and no Telegram node error occurred)
- [x] `./scripts/verify_nowThai_sync.sh` ผ่าน (ถ้า patch Code node)
- [x] HANDOFF.md updated

## Closing Template

```
Runtime patched: Created `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.env` with `TELEGRAM_OCR_CHAT_ID=1776637578`; patched live workflow `NkKd02QyzLRcpIJM` via n8n REST API so `Code (Build Telegram)` now uses `telegram_chat_id: process.env.TELEGRAM_OCR_CHAT_ID || '1776637578'`.
Verified from: workflow re-fetch shows `process.env.TELEGRAM_OCR_CHAT_ID || '1776637578'` in `Code (Build Telegram)` ✅; live `POST /webhook/ocr-km-suggest` with `x-api-key` returned `{"ok":true,"new_lessons":0,"analyzed_cases":45,"overall_accuracy_pct":97,...}` and latest execution is `155890` (`2026-03-02 22:51:58.314`, success) ✅; `./scripts/verify_nowThai_sync.sh` passed ✅.
Docs synced: This spec updated with Discussion, DoD checks, and Closing Template, and `docs/collab/HANDOFF.md` moved T048 to Recently Completed.
Remaining limits: The verification run produced `new_lessons=0`, so the Telegram notify branch did not execute in exec `155890`; chat_id correctness is therefore verified from the patched node source rather than a fresh Telegram delivery attempt in this run.
```

---

*Created by CC 2026-03-03 — T048 Telegram notify fix*
