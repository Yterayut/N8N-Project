# Reconciliation Runbook: PAY

## วัตถุประสงค์
runbook นี้ใช้เมื่อข้อมูล PAY ไม่ตรงกันระหว่าง:
- LINE reply
- Google Sheet
- Apps Script
- n8n execution
- Android app

เป้าหมายคือให้ตรวจตามลำดับเดียวกันทุกครั้ง และลดการเดา

## Incident Types ที่รองรับ
- LINE บอก duplicate แต่หาใน sheet ไม่เจอ
- n8n execution สำเร็จ แต่ data ไม่ลง sheet
- Apps Script ตอบ `ok` แต่ app ยังไม่เห็นรายการ
- app เห็นข้อมูลไม่ตรงกับ sheet
- workflow หรือ deployment เปลี่ยนแล้ว behavior แปลก

## กฎก่อนเริ่ม
- ห้ามเริ่มจาก backup file ก่อน
- ห้ามเชื่อ screenshot อย่างเดียว
- ห้ามใช้ mobile cache เป็นตัวตัดสินสุดท้าย
- ต้องเริ่มจาก `ref_id` หรือ `transaction_id` ถ้ามี

## สิ่งที่ต้องเตรียม
- `ref_id` หรือ `transaction_id`
- execution id ของ n8n ถ้ามี
- timestamp โดยประมาณ
- Apps Script deployment URL ที่คิดว่าใช้อยู่
- workflow ชื่อ/ID ที่รันจริง

## ขั้นตอนการตรวจ

### Step 1: ตรวจ canonical sheet ก่อน
คำถาม:
- มีแถวนี้ใน `Sheet1` หรือไม่
- ถ้ามี อยู่ row ไหน
- status คืออะไร
- transaction_id คืออะไร

สิ่งที่ต้องใช้:
- ค้น `ref_id`
- หรือใช้ Apps Script debug function เช่น `findByRefId`

ถ้าพบ:
- บันทึก `rowIndex`, `status`, `transaction_id`, `created_at`, `updated_at`

ถ้าไม่พบ:
- ไป Step 2

### Step 2: ตรวจ Apps Script behavior
คำถาม:
- request ที่ควรยิงเข้า backend ไป deployment URL ไหน
- deployment นั้นเป็นตัวล่าสุดจริงไหม
- response status คืออะไร

ค่าที่ต้องดู:
- `status`
- `error_code`
- `error`
- `matched_row_index`
- `matched_reason`

Interpretation:
- `ok` = ควรมีแถวใหม่ใน canonical sheet
- `duplicate` = ควร trace ไปแถวที่มีอยู่แล้ว
- `unauthorized` = ห้ามตอบ duplicate
- `validation_error` = ห้ามตอบ duplicate
- `internal_error` = ตรวจ backend/log ต่อ

### Step 3: ตรวจ n8n execution node-by-node
ลำดับ node ที่ต้องดู:
1. webhook / input
2. OCR / parse node
3. payload mapping node
4. node ที่ยิง Apps Script
5. node ตัดสิน branch (`If` / `Switch`)
6. node reply กลับ LINE

ต้องตอบให้ได้:
- payload ที่ส่งจริงคืออะไร
- backend ตอบจริงว่าอะไร
- branch ไหนถูกเลือก
- reply ที่ส่งออกอิงจาก status จริงหรือไม่

สิ่งที่ต้องระวัง:
- execution `Succeeded` ไม่ได้แปลว่า save สำเร็จ
- reply อาจสำเร็จทั้งที่ backend ไม่ได้ save

### Step 4: ตรวจ workflow live ว่าตรงกับ patch หรือไม่
ห้ามดูแต่ backup JSON

ตรวจ:
- live workflow id ที่รันจริง
- node config ใน n8n live DB / active runtime
- endpoint URL
- method
- query/body contract
- condition node
- reply node

คำถาม:
- workflow live ยังใช้ URL เก่าหรือไม่
- เช็ก `status == ok` แล้วหรือยัง
- duplicate reply ยัง hardcode อยู่หรือไม่

### Step 5: ตรวจ mobile app cache / sync
ถ้า sheet ถูกแต่ app ยังไม่ตรง

ตรวจ:
- last sync time
- stale/cached state
- pending sync queue
- last API error
- endpoint ที่ app ชี้อยู่

คำถาม:
- app อ่านข้อมูลจาก endpoint เดียวกับ backend จริงไหม
- app ยังใช้ cached state เก่าอยู่หรือไม่

### Step 6: ถ้ายังไม่ชัด ค่อยย้อนดู snapshot / backup
ใช้เพื่อ compare เท่านั้น

ตรวจ:
- `backups/workflow-freeze/`
- `workflow_patches/server-export2/workflows/`
- `archive/apps-script/code_backup.js`
- `.tmp/gas-my-finance/`

คำถาม:
- patch ที่เคยทำอยู่ใน snapshot ไหน
- live runtime diverge จาก backup ตั้งแต่เมื่อไร

## Decision Table

### เคส A: LINE บอก duplicate แต่ sheet ไม่มี
ตรวจตามนี้:
1. หา `ref_id` ใน canonical sheet
2. เปิด Apps Script response
3. ถ้า response ไม่ใช่ `duplicate` แสดงว่า workflow reply ผิด
4. เปิด n8n branch node และ reply node

### เคส B: n8n สำเร็จ แต่ data ไม่ลง
ตรวจตามนี้:
1. เปิด `HTTP Request` node ที่ยิง Apps Script
2. ดู response status
3. ถ้า `ok` แต่ sheet ไม่มี ให้ตรวจ deployment URL / spreadsheet ID
4. ถ้า `unauthorized` หรือ `validation_error` แสดงว่า success ของ workflow ไม่ใช่ success ของธุรกรรม

### เคส C: duplicate จริงหรือไม่
ตรวจตามนี้:
1. response ต้องมี `status=duplicate`
2. ต้องมี `matched_row_index` หรือ `matched_ref_id`
3. ต้องหา row นั้นเจอใน canonical sheet
4. ถ้าเจอไม่ได้ ให้เช็ก filter / hidden rows / status

### เคส D: app ไม่ตรง sheet
ตรวจตามนี้:
1. sheet คือ business truth
2. ตรวจ app sync state
3. ตรวจ endpoint ที่ app ใช้
4. ตรวจ cache / queue

## Output Template สำหรับสรุป incident

ใช้รูปแบบนี้ทุกครั้ง:

```text
Incident:
Observed by user:
Business truth result:
Apps Script response:
n8n execution result:
Branch chosen:
Reply sent:
Root cause:
Fix applied:
Evidence:
```

## Evidence ที่ต้องแนบ
- execution id
- ref_id / transaction_id
- Apps Script response body
- row index ใน sheet ถ้ามี
- screenshot เฉพาะจุดที่จำเป็น

## ข้อห้าม
- ห้ามสรุปว่า duplicate โดยไม่มี matched evidence
- ห้ามเชื่อ backup workflow ว่าเป็น live
- ห้ามแก้ workflow live ก่อน backup
- ห้าม rollback ข้าม layer โดยไม่บันทึก evidence
