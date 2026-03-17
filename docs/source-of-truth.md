# Source of Truth: PAY System

## วัตถุประสงค์
เอกสารนี้ใช้ประกาศอย่างเป็นทางการว่าในระบบ PAY:
- ข้อมูลอะไร authoritative ที่ไหน
- ระบบใดเป็น runtime truth
- artifact ใดเป็น backup/snapshot เท่านั้น
- เวลา conflict ต้องเชื่ออะไรก่อน

ถ้าข้อมูลขัดกัน ให้ยึดเอกสารนี้ก่อนการตีความจากความจำหรือจากไฟล์ snapshot

## สรุประดับระบบ

### 1. Business Truth
ใช้สำหรับตอบคำถามว่า “ธุรกรรมจริงคืออะไร”

- Authoritative system:
  - `apps-script/pay-finance/Code.js`
  - Google Sheet canonical schema (`Sheet1`) ที่ Apps Script ดูแล
- ครอบคลุม:
  - `transactions`
  - `categories`
  - `status`
  - `transaction_id`
- `created_at`
- `updated_at`
- `source`
- `request_id`
- `last_writer`
- `schema_version`
- `classification_version`
- `reconciliation_status`

ข้อสำคัญ:
- `Google Sheet` ไม่ใช่ truth แบบลอย ๆ
- truth ที่ถูกต้องคือ `Apps Script-managed canonical sheet`
- ถ้ามีการแก้ชีตตรง ต้องถือว่าเป็น manual intervention และต้องตรวจซ้ำด้วย runbook

### 2. Runtime / Integration Truth
ใช้สำหรับตอบคำถามว่า “workflow รันอะไร” และ “request นี้ผ่าน node ไหน”

- Authoritative system:
  - n8n live instance
  - n8n live DB
- ครอบคลุม:
  - active workflow definition ที่ instance โหลดอยู่
  - execution history
  - node-level response / errors
  - webhook runtime path

ข้อสำคัญ:
- n8n runtime truth ไม่ใช่ business truth
- execution `Succeeded` ไม่ได้แปลว่าบันทึกธุรกรรมสำเร็จ ต้อง cross-check กับ backend status และ canonical sheet

### 3. Code Truth
ใช้สำหรับตอบคำถามว่า “source code ปัจจุบันควรเป็นอะไร”

- Authoritative system:
  - Git repository
- ครอบคลุม:
  - Apps Script source
  - Android app source
  - patch scripts
  - docs / runbooks / manifests

ข้อสำคัญ:
- Git เป็น truth ของ source code
- ไม่ใช่ truth ของ production runtime state

### 4. Snapshot / Backup Truth
ใช้สำหรับ restore, compare, audit, forensic

- Authoritative status:
  - snapshot only
- ตัวอย่าง:
- `backups/workflow-freeze/*.json`
- `workflow_patches/server-export2/workflows/*.json`
- `workflow_patches/live/*.before.json`
- `workflow_patches/live/*.after.json`
- `archive/apps-script/code_backup.js`
- `.tmp/gas-my-finance/*`

ข้อสำคัญ:
- ห้ามใช้ snapshot file เพียงอย่างเดียวเพื่อตัดสิน runtime ปัจจุบัน
- ต้องยืนยันกับ live DB / deployed Apps Script / active runtime เสมอ

## Canonical Decisions

### Transactions
- System of record:
  - `Apps Script API + canonical Sheet1 schema`
- Final authority:
  - row ที่อยู่ใน canonical sheet หลังผ่าน Apps Script validation / classification / duplicate guard

### Categories
- System of record:
  - canonical sheet category field + Apps Script classification rules

### Workflow Runtime
- System of record:
  - n8n live DB / loaded workflow in active instance

### Mobile App Cache
- Status:
  - cache only
- ห้ามใช้เพื่อตัดสิน final transaction truth

### Backup / Export Files
- Status:
  - snapshot only
- ใช้ restore / compare / audit เท่านั้น

## Write Path

### Allowed write path สำหรับ transaction
1. Mobile app -> Apps Script API
2. n8n workflow -> Apps Script API
3. Web app -> Apps Script function/API

### ห้าม
- ห้ามมีระบบอื่น append/modify `Sheet1` ตรง ๆ นอก layer Apps Script
- ห้ามถือว่าไฟล์ export JSON ใด ๆ เป็น live workflow โดยอัตโนมัติ

## Read Path

### ถ้าถามว่า “รายการนี้บันทึกหรือยัง”
1. ตรวจ canonical sheet ด้วย `ref_id` หรือ `transaction_id`
2. ตรวจ Apps Script response status
3. ถ้าจำเป็นค่อยย้อนดู n8n execution

### ถ้าถามว่า “workflow ส่งอะไรมาจริง”
1. ตรวจ n8n execution data
2. ตรวจ live workflow definition ใน DB / active instance
3. backup JSON ใช้ compare เท่านั้น

## Precedence Rules เมื่อข้อมูลขัดกัน

### กรณี transaction ขัดกันระหว่างหลายระบบ
ลำดับความเชื่อ:
1. Apps Script-managed canonical sheet
2. Apps Script response ที่ execution นั้นได้รับ
3. n8n execution data
4. mobile cache
5. backup/export JSON

### กรณี workflow configuration ขัดกัน
ลำดับความเชื่อ:
1. active workflow ใน n8n live DB / loaded runtime
2. patch script ที่ใช้ apply ล่าสุด
3. exported workflow JSON
4. backup freeze

## Artifact Classification

### Canonical
- `apps-script/pay-finance/Code.js`
- `apps-script/pay-finance/appsscript.json`
- `docs/pay-sheet-schema.md`
- `docs/pay-release-manifest.md`

### Runtime
- n8n live DB at runtime
- deployed Apps Script web app URL
- environment variables used by the running instance

### Code
- tracked source in Git

### Backup / Snapshot
- `backups/workflow-freeze/`
- `workflow_patches/server-export2/workflows/`
- `workflow_patches/live/*.json`
- `archive/apps-script/code_backup.js`
- `archive/apps-script/pay-root-legacy/`
- `PAY/`
- `.tmp/gas-my-finance/`

## สิ่งที่ห้ามใช้เป็น Source of Truth
- `archive/apps-script/code_backup.js`
- `.tmp/gas-my-finance/Code.js`
- backup workflow JSON ใด ๆ
- mobile cached list
- success/failure badge ของ n8n execution เพียงอย่างเดียว

## Rollback Order
เวลาระบบ PAY เพี้ยนและต้อง rollback:
1. ยืนยันว่าปัญหาอยู่ที่ Apps Script, n8n, หรือ consumer
2. ถ้าเป็น workflow contract:
   - rollback workflow live ใน n8n ก่อน
3. ถ้าเป็น backend schema/logic:
   - rollback Apps Script deployment
4. ถ้าเป็น consumer issue:
   - rollback Android/web app
5. หลัง rollback ต้อง smoke test:
   - add
   - duplicate
   - unauthorized
   - validation error

## Owner Checklist
ก่อน deploy หรือ debug ใด ๆ ต้องตอบให้ได้:
- Apps Script deployment URL ปัจจุบันคืออะไร
- Spreadsheet ID ปัจจุบันคืออะไร
- n8n workflow ID ที่ live คืออะไร
- Android default endpoint ชี้ไปไหน
- patch ล่าสุดถูก apply เข้า live หรือยัง

## สถานะการจัดระเบียบปัจจุบัน
- เอกสารนี้คือ declaration กลางรอบแรก
- ยังมี artifact กระจัดกระจายอยู่จริง
- การย้าย/ลบ snapshot file ควรทำหลังยืนยัน manifest และ rollback path ครบแล้ว
