# PAY Write-Path Audit: 2026-03-17

## วัตถุประสงค์
บันทึกผล audit ว่า write path ของ PAY ถูกจัดชั้นแล้วหรือยัง และมี artifact ไหนยังดูเหมือน writer ที่ไม่ควรถูกใช้เป็น production truth

## Tool
- `scripts/pay/audit_pay_write_paths.sh`
- `scripts/pay/enforce_pay_write_path.sh`
- Run result:
  - canonical writer = `apps-script/pay-finance/Code.js`
  - non-canonical PAY candidates = `archive/apps-script/pay-root-legacy/code.js`, `.tmp/gas-my-finance/Code.js`
  - enforcement result = `PAY write-path enforcement passed`

## Result Summary

### Canonical writer
writer ที่ได้รับอนุญาตสำหรับธุรกรรม PAY คือ:
- `apps-script/pay-finance/Code.js`

### Non-canonical candidates ที่พบ
- `archive/apps-script/pay-root-legacy/code.js`
- `.tmp/gas-my-finance/Code.js`

สองไฟล์นี้ยังมี direct Google Sheet writes แต่ถูกจัดเป็น:
- legacy snapshot
- temporary clone
- not canonical

### Other spreadsheet writers found outside PAY canonical source
- `scripts/gas-prompts-crud/Code.js`

สถานะ:
- เป็น Apps Script utility อื่น
- ไม่ใช่ canonical writer ของ PAY
- ต้องไม่ถูกผูกเข้ากับ PAY transaction flow

## Enforcement Actions Completed
- ย้าย `code_backup.js` ไป `archive/apps-script/code_backup.js`
- ย้าย legacy PAY Apps Script files ไป `archive/apps-script/pay-root-legacy/`
- เพิ่ม warning header ใน `.tmp/gas-my-finance/Code.js`
- เพิ่ม README ใน `PAY/`
- เพิ่ม README ใน `.tmp/gas-my-finance/`
- เพิ่ม README ใน `archive/apps-script/pay-root-legacy/`
- ออก policy:
  - `docs/pay-write-path-policy.md`

## Enforcement Rule
สำหรับ PAY business transactions:
- allowed writer: `apps-script/pay-finance/Code.js`
- all other hits = snapshot / temp / patch / non-PAY utility / violation

## Open Follow-up
- ถ้าจะเข้มขึ้นอีก ต้องเพิ่ม CI step รัน `scripts/pay/enforce_pay_write_path.sh`
- ถ้าจะลด noise ใน audit ให้แยก `.tmp/gas-my-finance/` ออกจากเครื่อง production-maintainer
