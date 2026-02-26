# OCR Workflow Lesson Learned + Action Standard

## 1) วัตถุประสงค์
- ป้องกันปัญหาซ้ำจากการแก้ workflow/code patch
- บังคับมาตรฐานเดียวกันทุก action: แก้, ทดสอบ, deploy, rollback
- เก็บบทเรียนให้ใช้ได้จริงในรอบถัดไป

## 2) กติกาหลัก (Non-Negotiable)
1. ห้าม deploy โดยไม่ทำ pre-check + smoke test
2. 1 request ต้องได้ 1 response เสมอ
3. ห้ามปล่อย code node ที่ compile ไม่ผ่าน
4. ต้องมี rollback point ทุกครั้งก่อน patch
5. ทุก incident ต้องมี lesson learned และ action ป้องกันซ้ำ
6. ทุก incident ต้องบันทึกลง KM (`OCR_KM_LESSONS`) ภายในรอบแก้เดียวกัน
7. ถ้ามี rule ป้องกันซ้ำ/normalize ใหม่ ต้องลง `OCR_KM_RUNTIME_RULES` หรือ `OCR_RULE_CHANGELOG`

## 3) Standard Flow ต่อ 1 Action
1. `Define`: ระบุเป้าหมาย, node ที่กระทบ, risk
2. `Backup`: export/freeze เวอร์ชันก่อนแก้
3. `Patch`: แก้แบบ atomic (จุดเดียวชัดเจน)
4. `Static Verify`: ตรวจ syntax/structure ก่อนรันจริง
5. `Runtime Verify`: ทดสอบจริงอย่างน้อย 3 เคส
6. `Observe`: เช็ก execution ล่าสุด + log + response schema
7. `Record`: บันทึกผล + lesson learned + next guardrail

## 4) Checklists ตามประเภท Action

## 4.1 Workflow Patch (Code/If/Respond)
1. ยืนยัน workflow id ถูกต้อง (`up1n75qEhbsXswii`)
2. backup ก่อนแก้ทุกครั้ง
3. update ทั้ง `workflow_entity` และ `workflow_history(activeVersionId)`
4. รันตัวตรวจ code node:
   - `node scripts/ocr/verify_code_nodes_newlines.js`
5. ตรวจ response contract:
   - `Content-Type: application/json`
   - JSON parse ได้ 100%
6. ตรวจ execution ล่าสุดต้อง `success`

## 4.2 Logic Change (Classifier/Validation/Dedupe/Re-ask)
1. ระบุ input/output contract ของ node ที่เปลี่ยน
2. เพิ่ม fallback path เสมอ (ไม่ให้ flow ตายเงียบ)
3. ตรวจ edge cases:
   - missing field
   - parse fail
   - empty bills
   - duplicate
4. ยืนยันว่า decision (`auto_pass/needs_review/hard_fail`) ไม่หลุดเงื่อนไข

## 4.3 Security/Config Change
1. secret ต้องอยู่ใน env/credentials เท่านั้น
2. ห้าม hardcode key ใน node jsCode/http node
3. ทดสอบ `unauthorized` ต้องได้ 401 เสมอ

## 4.4 Release Verification (ขั้นต่ำ)
1. Unauthorized case -> 401
2. Parse/invalid case -> error JSON ตาม contract
3. Success case -> JSON schema canonical
4. ตรวจ `execution_entity` ล่าสุดไม่ error

## 5) Incident Template (บันทึกทุกเคส)
```md
## Incident: <short-title>
- Date/Time:
- Workflow/Version:
- Trigger:
- Impact:
- Root cause:
- Detection gap:
- Immediate fix:
- Preventive action:
- Validation after fix:
- Owner:
```

## 5.1 KM Sheets (Operational KM + Runtime KM)
ใช้ Google Sheet เดิมของ OCR เป็นแหล่ง KM กลาง (human + runtime-ready)

### `OCR_KM_LESSONS` (Human-readable + audit)
- ใช้บันทึก incident/lesson learned ทุกเคส
- minimum required:
  - `lesson_id`
  - `created_at`
  - `category`
  - `symptom`
  - `root_cause`
  - `fix_applied`
  - `prevention`
  - `validation_after_fix`
  - `affected_workflow`
  - `status`

### `OCR_KM_RUNTIME_RULES` (Machine-readable)
- ใช้เก็บ rule ที่ OCR runtime/query service อ่านไปใช้ได้ในอนาคต
- เก็บเป็น JSON string ในคอลัมน์:
  - `match_condition_json`
  - `transform_action_json`
- เชื่อมกลับ lesson ด้วย `source_lesson_id`

## 5.2 PDCA Loop (OCR Improvement)
1. `Plan` - ระบุ incident + impact + expected prevention
2. `Do` - patch/workaround/rule change
3. `Check` - smoke test + execution evidence + regression spot checks
4. `Act` - บันทึก KM + promote rule/monitor + rollback plan

หมายเหตุ: ห้ามจบรอบแก้โดยไม่มี `Check` และ `Act`

## 6) Lesson Learned ล่าสุด (Case จริง)
## Incident: Code Node compile error จาก newline encoding
- Date/Time: 2026-02-19
- Workflow/Version: `up1n75qEhbsXswii` (active version ณ เวลานั้น)
- Trigger: patch script เขียน jsCode ด้วย `\\n` literal
- Impact: execution `#149755` ล้มที่ `Code (Normalize + Validate)` ด้วย `SyntaxError`
- Root cause: สร้างสตริงหลายบรรทัดด้วย `.join('\\n')` แล้วถูกส่งเข้ารันไทม์เป็นอักขระ literal
- Detection gap: ไม่มี static guard ก่อน deploy
- Immediate fix:
  - แก้เป็น `.join('\n')`
  - apply patch ใหม่เข้า active workflow
- Preventive action:
  - เพิ่ม script `scripts/ocr/verify_code_nodes_newlines.js`
  - บังคับรันก่อนจบทุก patch
- Validation after fix:
  - execution ถัดไป `#149756` เป็น `success`
  - webhook `/ocr-dev` ตอบกลับได้ปกติ

## 7) Operational Definition of Done (ต่อ 1 Action)
1. มี backup อ้างอิงได้
2. static check ผ่าน
3. smoke test 3 เคสผ่าน
4. execution ล่าสุด success
5. บันทึก lesson learned (ถ้ามี incident)

## 8) Lesson Learned ล่าสุด (Case เพิ่มเติม)
## Incident: Execution = success แต่ OCR business result = error
- Date/Time: 2026-02-19 (ช่วง 13:45-13:56 เวลาไทย)
- Symptom:
  - n8n execution status หลายรอบเป็น `success`
  - แต่ `OCR_RAW.raw_text` เป็น error `Unsupported MIME type: application/octet-stream`
- Root cause:
  - Workflow ถูกออกแบบให้ HTTP node ส่ง error object ต่อไป (ไม่ throw)
  - ทำให้ execution จบสำเร็จเชิงระบบ แต่ล้มเหลวเชิงธุรกิจ
  - MIME fallback เดิมอิง header/extension ไม่พอสำหรับไฟล์ที่ถูกส่งเป็น `octet-stream + .bin`
- What we learned:
  1. ห้ามใช้ execution status อย่างเดียวเป็นตัวชี้วัดคุณภาพ OCR
  2. ต้องแยก `system success` กับ `business success` ออกจากกันเสมอ
  3. ingestion ต้องมี MIME normalization แบบหลายชั้น (mime -> extension/fileName -> magic bytes)
- Permanent actions:
  1. เพิ่ม content-sniffing (PDF/JPEG/PNG) ใน `Code in JavaScript22`
  2. บังคับ monitor error pattern ใน OCR_RAW (`Unsupported MIME type`)
  3. เพิ่ม regression test เคส `application/octet-stream` ใน pre-release gate
 4. สรุปสถานะรายวันด้วย 2 metric:
     - execution success rate
     - OCR business success rate (ไม่มี error object)

## Incident: บิลซ้ำในหน้าเดียวกัน (duplicate bills in one response)
- Date/Time: 2026-02-19
- Symptom:
  - `raw_text` จากโมเดลมี bills ซ้ำ 2 รายการข้อมูลเดียวกัน
  - `raw_text_pretty` และ downstream เห็นบิลซ้ำ
- Root cause:
  - Normalize layer ยัง canonicalize อย่างเดียว ไม่มี dedupe ในรอบเดียวกัน
- What we learned:
  1. Duplicate สามารถเกิดได้จาก LLM แม้ parse ถูก schema
  2. ต้อง dedupe ที่ normalize stage ก่อนเขียน `raw_json`/`raw_text_pretty`
- Permanent actions:
  1. เพิ่ม `dedupeBills()` ใน `Code (Normalize + Validate)`
  2. ตั้ง `x.duplicate_collapsed_count` เพื่อ audit จำนวนที่ถูกตัดซ้ำ
  3. ใช้ canonical-bill key (critical fields + list_detail normalized) ก่อนนับ `bills_count`

## Incident: Code node ใช้ `process.env` แล้วพังใน n8n runtime
- Date/Time: 2026-02-19
- Symptom:
  - execution error ต่อเนื่อง (`149881`-`149885`)
  - ล้มที่ `Code (Normalize + Validate)` ด้วย `ReferenceError: process is not defined`
- Root cause:
  - นำ pattern จาก Node.js runtime มาใช้ตรงๆ (`process.env`) ใน n8n Code node
  - แต่ sandbox ของ n8n Code node ไม่มี `process`
- What we learned:
  1. n8n Code node ไม่เทียบเท่า Node.js process runtime
  2. ค่า config ที่ต้องใช้ใน code node ต้องมาจาก `$json`/node ก่อนหน้า/ค่าคงที่ในโค้ด
- Permanent actions:
  1. ห้ามใช้ `process.*` ใน Code node
  2. เพิ่ม static check ก่อนปล่อย: ค้นหา token `process.` ใน `jsCode`
  3. ถ้าต้องใช้ config ให้ส่งผ่าน workflow input แทน env ตรง

## Incident: Patch string escape ผิด ทำให้ Code node syntax error
- Date/Time: 2026-02-19
- Symptom:
  - execution ล้มทันทีที่ `Code (Normalize + Validate)`
  - error `SyntaxError: Invalid or unexpected token`
- Root cause:
  - แทรกโค้ดด้วย string replace แล้ว escape `\\n` ผิดรูปแบบ
  - เกิดสตริงข้ามบรรทัดใน source (`join('` แล้วขึ้นบรรทัดใหม่)
- What we learned:
  1. Patch แบบ text replace ต้องมี compile check ทุกครั้ง
  2. ต้องตรวจตัวอย่างโค้ดช่วงที่แก้ (line-level) ก่อนรันทดสอบจริง
- Permanent actions:
  1. หลัง patch ให้รัน `vm.Script` compile check กับ `jsCode` ทุกครั้ง
  2. เพิ่มขั้นตรวจ `nl -ba` เฉพาะช่วงที่แก้เพื่อจับ escaped-newline

## Incident: OCR failed จาก binary file หลุดก่อนอัปโหลด Gemini (Postman /ocr-dev)
- Date/Time: 2026-02-22
- Symptom:
  - Postman ยิง `POST /webhook/ocr-dev` ได้ `OCR_FAILED`
  - ข้อความ Gemini: `Unsupported file URI type`
- Root cause:
  1. `HTTP Upload File5` คาด binary field `files0`
  2. ในบาง path request มาจาก webhook เป็น `files` และ/หรือ binary ถูกส่งต่อหลุด
  3. `Code (Parse Admission Result)` คืนแค่ `json` ไม่คืน `binary`
  4. `Code (Build Request)` จึงได้ upload response ไม่สมบูรณ์ -> `fileUri` ว่าง
- Detection gap:
  - ไม่มี guard test ที่ยืนยัน binary propagation หลัง admission-control path
- Immediate fix:
  1. normalize binary alias (`files`, `files_0` -> `files0`) ใน pre-upload code node
  2. ให้ `Code (Parse Admission Result)` ส่ง `binary: src.binary`
  3. เพิ่ม fail-fast ใน `Code (Build Request)` เมื่อ `UPLOAD_FILE_URI_MISSING`
  4. รองรับรูปแบบ upload response หลายแบบ (`file`, `body.file`, `files[0]`, `name -> fileUri`)
- Preventive action:
  1. เพิ่ม smoke test mandatory: Postman/curl multipart field `files`
  2. ตรวจ execution path ว่า node ที่แก้/เพิ่ม return ทั้ง `json` และ `binary` เมื่อ downstream ต้องใช้ไฟล์
  3. บันทึก rule/guard นี้ใน `OCR_KM_RUNTIME_RULES`
- Validation after fix:
  - ยิง `PTT-OR.pdf` ผ่าน `/webhook/ocr-dev` ได้ `success=true`, `doc_type=fuel`, `bills_count=1`
- Affected workflow:
  - `test-workflow (up1n75qEhbsXswii)`
- Affected nodes:
  - `Code in JavaScript22`
  - `Code (Parse Admission Result)`
  - `Code (Build Request)`

## 9) คำสั่งมาตรฐานที่ใช้ซ้ำ
```bash
# ตรวจเคสเสี่ยง newline ใน Code nodes
node scripts/ocr/verify_code_nodes_newlines.js

# ดู execution ล่าสุด
sqlite3 .n8n-dev/.n8n/database.sqlite \
  "select id,status,workflowId,startedAt,stoppedAt from execution_entity order by id desc limit 10;"
```
