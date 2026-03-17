# PAY Environments Manifest

## วัตถุประสงค์
ไฟล์นี้เก็บ mapping ของ environment ที่ใช้กับระบบ PAY เพื่อให้ตอบได้ว่า production ตอนนี้ชี้ไปไหน และแต่ละชั้นใช้ artifact อะไร

> หมายเหตุ:
> ค่านี้คือ manifest เชิงปฏิบัติจากสิ่งที่ตรวจพบในเครื่องและใน repo นี้ ณ เวลาที่เขียน
> ถ้ามีการเปลี่ยน deployment / workflow / endpoint ต้องแก้ไฟล์นี้ทันที

## Production-like Runtime ที่ตรวจพบ

### n8n live instance
- Host:
  - `https://rapturously-streamlined-king.ngrok-free.dev`
- Local port:
  - `http://127.0.0.1:5678`
- User folder:
  - `.n8n-dev`
- Live DB path:
  - `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite`
- Service:
  - `systemd --user n8n.service`

### PAY workflow live
- Workflow name:
  - `PAY`
- Workflow ID:
  - `L1NnDsCnLgUsKMgK`
- Webhook path:
  - `PAY-HISTORY`
- Runtime truth:
  - n8n live DB / loaded workflow

### Apps Script backend
- Source path:
  - `apps-script/pay-finance/Code.js`
- Manifest path:
  - `apps-script/pay-finance/appsscript.json`
- Spreadsheet ID:
  - `1ptHPEg2d_19vbecMjzZga2ETJu3ARfuS6LLomYhyIds`
- Main sheet:
  - `Sheet1`
- Current deployment URL used by live PAY workflow:
  - `https://script.google.com/macros/s/AKfycbz1_NiIQDVcEHE-byhCCifZ7mxuuJgQCWWWUyHrZoSi920APhRviGkLEBwMzYN9Kt1qKQ/exec`
- Current canonical provenance schema version:
  - `2026-03-17.v1`

### Shared secrets / runtime env
- PAY API shared secret env key:
  - `PAY_API_SHARED_SECRET`
- Current runtime value source:
  - n8n process environment

## Source of Truth Mapping

### Transaction truth
- Authoritative:
  - Apps Script-managed canonical sheet

### Workflow truth
- Authoritative:
  - n8n live DB / runtime

### Code truth
- Authoritative:
  - Git repo

### Backup truth
- Authoritative status:
  - snapshot only

## Artifact Map

### Canonical / Active Source
- `apps-script/pay-finance/Code.js`
- `apps-script/pay-finance/appsscript.json`

### Live Runtime Artifacts
- n8n live DB:
  - `.n8n-dev/.n8n/database.sqlite`
- active process env
- loaded workflow in running instance

### Backup / Snapshot Artifacts
- `backups/workflow-freeze/`
- `workflow_patches/server-export2/workflows/`
- `workflow_patches/live/*.json`
- `archive/apps-script/code_backup.js`
- `archive/apps-script/pay-root-legacy/`
- `.tmp/gas-my-finance/`

### Temporary / Forensic Artifacts
- `.tmp/gas-my-finance/`
- patch scripts under `scripts/`

## Deploy Order

### ถ้าแก้ contract backend
1. update Apps Script source
2. deploy Apps Script
3. patch / verify n8n workflow
4. smoke test
5. update app consumer ถ้าจำเป็น
6. update `docs/pay-release-manifest.md`

### ถ้าแก้ workflow branch logic
1. backup workflow live
2. patch live workflow
3. reload n8n runtime
4. smoke test `ok / duplicate / unauthorized / validation_error`

### ถ้าแก้ mobile app
1. verify endpoint manifest
2. build / run smoke test
3. release app

## Rollback Order
- Workflow incident:
  1. rollback n8n workflow
  2. retest
- Backend contract incident:
  1. rollback Apps Script deployment
  2. retest n8n
- Consumer-only incident:
  1. rollback app/web consumer

## ข้อมูลที่ควรเติมต่อ
รายการต่อไปนี้ควรถูกดูแลให้ครบในอนาคต:
- Apps Script project ID ที่ใช้ deploy production
- Android default endpoint path ใน repo app
- owner / maintainer ต่อ environment
- exact release tags ต่อ backend / workflow / app
- smoke evidence document path ต่อรอบ deploy
