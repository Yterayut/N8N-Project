# PAY Release Manifest

## วัตถุประสงค์
ไฟล์นี้เป็น manifest กลางสำหรับ release และ incident verification ของระบบ PAY

ใช้ตอบคำถามว่า:
- ตอนนี้ production-like runtime ชี้ไปไหน
- รอบแก้ล่าสุดใช้ backend / workflow / endpoint อะไร
- smoke evidence ล่าสุดอยู่ที่ไหน
- rollback ควรย้อนชั้นไหนก่อน

## Current Release Baseline

### Business truth
- Canonical Apps Script source:
  - `apps-script/pay-finance/Code.js`
- Canonical Apps Script manifest:
  - `apps-script/pay-finance/appsscript.json`
- Canonical storage:
  - Spreadsheet ID `1ptHPEg2d_19vbecMjzZga2ETJu3ARfuS6LLomYhyIds`
  - Sheet `Sheet1`

### Runtime truth
- n8n workflow name:
  - `PAY`
- n8n workflow ID:
  - `L1NnDsCnLgUsKMgK`
- n8n webhook path:
  - `PAY-HISTORY`
- n8n live DB:
  - `.n8n-dev/.n8n/database.sqlite`

### Apps Script runtime endpoint
- Live endpoint used by workflow:
  - `https://script.google.com/macros/s/AKfycbz1_NiIQDVcEHE-byhCCifZ7mxuuJgQCWWWUyHrZoSi920APhRviGkLEBwMzYN9Kt1qKQ/exec`
- Current provenance schema version in canonical source:
  - `2026-03-17.v1`

### Secret / auth contract
- Shared secret env key:
  - `PAY_API_SHARED_SECRET`
- Runtime caller:
  - n8n `HTTP Request1`
- Consumer contract:
  - `GET endpoint=ingestSlip`
  - `api_key`
  - payload query parameters

## Release Discipline

### Deploy order
1. Update canonical Apps Script source
2. Deploy Apps Script
3. Patch / verify n8n live workflow
4. Run smoke tests
5. Update consumers if contract changed
6. Record evidence in docs

### Rollback order
1. n8n workflow contract
2. Apps Script deployment
3. Android / web consumer

## Release Evidence

### Smoke checklist
- `docs/pay-smoke-test-checklist.md`

### Smoke evidence
- `docs/pay-smoke-evidence-2026-03-17.md`

### Write-path enforcement evidence
- `docs/pay-write-path-audit-2026-03-17.md`

### Source of truth declaration
- `docs/source-of-truth.md`

### Reconciliation procedure
- `docs/reconciliation-runbook.md`

## Known Non-Canonical Artifacts
- `PAY/`
- `archive/apps-script/`
- `archive/apps-script/pay-root-legacy/`
- `.tmp/gas-my-finance/`
- `backups/workflow-freeze/`
- `workflow_patches/server-export2/workflows/`
- `workflow_patches/live/`

สิ่งเหล่านี้ใช้เพื่อ compare / restore / forensic เท่านั้น

## Release Exit Criteria
ถือว่ารอบ release นี้พร้อมใช้งานเมื่อ:
- add success ผ่าน
- duplicate ผ่าน
- unauthorized ผ่าน
- validation error ผ่าน
- search by ref_id ผ่าน
- write-path audit ไม่เจอ writer ใหม่ที่ bypass canonical Apps Script
