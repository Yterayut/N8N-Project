# archive/apps-script

โฟลเดอร์นี้ใช้เก็บไฟล์ Apps Script ที่เป็น legacy snapshot หรือ backup reference

สถานะ:
- `archive`
- `snapshot`
- ไม่ใช่ runtime source of truth

canonical source ปัจจุบันอยู่ที่:
- `apps-script/pay-finance/Code.js`
- `apps-script/pay-finance/appsscript.json`

ห้ามใช้ไฟล์ในโฟลเดอร์นี้เพื่อตัดสิน production behavior โดยไม่ cross-check กับ:
- deployed Apps Script
- canonical sheet
- n8n live runtime
