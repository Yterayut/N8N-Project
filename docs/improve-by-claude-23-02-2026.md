# วิเคราะห์ test-workflow สำหรับ Production Readiness

**Workflow:** `test-workflow` (ID: `up1n75qEhbsXswii`)
**วันที่วิเคราะห์:** 2026-02-23

---

## P0 - CRITICAL (ต้องแก้ก่อน deploy)

### 1. `round3` ไม่มีอยู่จริง — จะ crash ทุก fleet_card document
**Node:** `Code (Normalize + Validate)`

โค้ดเรียก `round3(amt / up)` แต่มีแค่ `round2` เท่านั้น ทำให้เกิด `ReferenceError` ทุกครั้งที่ประมวลผลเอกสาร fleet_card ที่มี line item แบบ fuel

**แก้ไข:** เพิ่ม `function round3(v) { return Math.round(v * 1000) / 1000; }` หรือเปลี่ยนเป็น `round2`

---

## P1 - HIGH (ต้องแก้ก่อน production)

### 2. Re-ask result ไม่ผ่าน Normalize+Validate
**Node:** `Code (Apply Re-ask Result)`

เมื่อ Gemini re-ask สำเร็จ ข้อมูลใหม่ถูกใส่ลง `raw_json` โดยตรง **ไม่ผ่านการ normalize/validate อีกครั้ง** ทำให้อาจมีข้อมูลผิดรูปแบบ (เช่น date format ผิด, tax_id ไม่ครบ) เข้า production storage ได้

**คำแนะนำ:** Route re-ask result กลับเข้า normalization หรืออย่างน้อย validate fields หลัก

### 3. `allHeaders` ไม่ถูก set — caller_ip เป็น 'unknown' เสมอ
**Node:** `Code in JavaScript5`

ไม่มีบรรทัด `item.json.allHeaders = headers;` แต่ `Code in JavaScript9` อ้างอิง `allHeaders['x-forwarded-for']` ทำให้ log IP ไม่ได้เลย

**แก้ไข:** เพิ่ม `item.json.allHeaders = headers;` ใน `Code in JavaScript5`

### 4. MIME sniffing decode ทั้งไฟล์
**Node:** `Code in JavaScript22`

`Buffer.from(b64, 'base64')` decode base64 ทั้งหมดเพื่อดูแค่ 8 bytes แรก ไฟล์ 10MB จะจอง memory 10MB โดยไม่จำเป็น

**แก้ไข:** ใช้ `Buffer.from(b64.slice(0, 16), 'base64')` แทน

### 5. ไม่จำกัดจำนวนไฟล์ใน queue upload
**Node:** `Code (Split Files)`

ผู้ใช้สามารถส่ง 1000 ไฟล์ในครั้งเดียว แต่ละไฟล์สร้าง Google Drive upload + Sheets append ทำให้ hit rate limit ได้

**แก้ไข:** เพิ่ม guard `if (Object.keys(files).length > 20) throw new Error('Too many files');`

### 6. Queue worker ไม่มี Document Classification
**Node:** `Code (Build Request)1`

Queue path ไม่มี Document Classifier ทำให้ prompt ทุกประเภทถูกรวมกันส่ง Gemini โดยไม่แยก fuel/electricity/fleet_card ผลลัพธ์จะแย่กว่า main path มาก

**แก้ไข:** เพิ่ม Document Classifier ใน queue path ให้เหมือน main path

### 7. Queue worker ไม่ retry งานที่ fail
ถ้า Gemini API error ใน queue path, item จะถูก mark เป็น `done` ทั้งที่ fail **งานหายถาวร**

**แก้ไข:** Mark เป็น `error` แทน `done` แล้วให้ Schedule Trigger retry items ที่ status=error

### 8. URL มี trailing `\n\n`
**Node:** `HTTP Request1`, `HTTP GenerateContent3`

URL ลงท้ายด้วย `\n\n` ซึ่งอาจทำให้ HTTP 400 จาก Gemini API

**แก้ไข:** ลบ `\n\n` ออกจากท้าย URL

---

## P2 - MEDIUM (ควรแก้ก่อน scale)

| # | ปัญหา | Node | ผลกระทบ | คำแนะนำ |
|---|--------|------|---------|---------|
| 9 | **Google Sheets Get All row_key ดึงทุกแถว** | `Google Sheets (Get All row_key)` | เมื่อมี 10,000+ bills จะช้ามากและ memory สูง | ย้ายไปใช้ database หรือ cache row_key |
| 10 | **ราคา THB hardcoded** | `Code in JavaScript9` | `0.0105/0.0875` ต่อ 1K tokens เมื่อ Gemini ปรับราคาต้องแก้โค้ด | ย้ายไป `$env.PRICE_THB_PER_1K_INPUT` / `$env.PRICE_THB_PER_1K_OUTPUT` |
| 11 | **Fan-out ส่ง response ก่อน save** | Connection จาก `Finalize Decision` | Client ได้ 200 แต่ข้อมูลอาจไม่ถูก save ลง Sheets (ถ้า Sheets down) | พิจารณาส่ง response หลัง save สำเร็จ หรือเพิ่ม reconciliation job |
| 12 | **ไม่จำกัดขนาดไฟล์** | Webhook path | ไฟล์ 100MB จะถูก accept โดยไม่มี guard | เพิ่มการตรวจสอบ file size ก่อน processing |
| 13 | **Few-shot truncation ตัดกลาง JSON** | `Code (Select Few-shot Examples)` | `.slice(0, 6000)` อาจตัดกลาง JSON example ทำให้ prompt เสีย | ตัดที่ขอบเขต example แทน character limit |
| 14 | **API key comparison ไม่ timing-safe** | `If` node, `Code (Validate Feedback Payload)` | เสี่ยง timing attack (ความเสี่ยงต่ำใน practice) | ใช้ constant-time comparison |
| 15 | **Gemini error message leak ถึง client** | `Respond to Webhook (error)` | ส่ง error จาก Gemini ตรงๆ ถึง client อาจเปิดเผย internal info | Sanitize error message ก่อนส่งกลับ |
| 16 | **Disabled nodes 20+ ตัว** | Legacy chain (Webhook_OCR_Test9 path) | เพิ่มความซับซ้อนโดยไม่จำเป็น | ลบทิ้งทั้งหมด |

---

## P3 - LOW (ปรับปรุงเพิ่มเติม)

| # | ปัญหา | Node | คำแนะนำ |
|---|--------|------|---------|
| 17 | **Hardcoded vendor tax IDs** | `Code (Normalize + Validate)` | ย้ายไป config sheet หรือ env var |
| 18 | **Hardcoded workflow name/ID ใน Telegram** | `Code (Build Telegram Notification OCR)` | ใช้ `$workflow.name` / `$workflow.id` แทน |
| 19 | **Queue batch size hardcoded = 10** | `Code in JavaScript23` | ย้ายไป `$env.OCR_QUEUE_BATCH_SIZE` |
| 20 | **SLA lane thresholds hardcoded** | `Code (SLA Lane + Timeout Budget)` | `4000kb` / `700kb` ควรเป็น env var |
| 21 | **Electricity ref validation rigid** | `Code (Normalize + Validate)` | `/^\d{12}$/` อาจไม่รองรับทุก provider |
| 22 | **ไม่รองรับ TIFF/HEIC** | `Code in JavaScript22` | iPhone photos (HEIC) และ scanned docs (TIFF) จะไม่ถูก detect MIME |
| 23 | **Re-ask confidence floor 0.88** | `Code (Apply Re-ask Result)` | `Math.max(conf, 0.88)` inflate confidence เกินจริง |
| 24 | **file_id ใน queue worker อ้างอิงผิด node** | `Code Set Done` | ใช้ `$('Google Sheets (Set Processing)').all()[0]` ควรใช้ `$('Loop Over Items').item` |
| 25 | **`nowThai()` copy-paste ทุก node** | หลาย Code nodes | แก้ที่เดียวไม่ครอบคลุม ควรรวมเป็น shared function |

---

## HTTP Request Nodes — ตารางสรุป

| Node | Retry | Timeout | Error Mode | ปัญหา |
|------|-------|---------|------------|--------|
| HTTP Upload File5 | Yes (5s wait) | **ไม่มี** | continueRegularOutput | ไฟล์ใหญ่อาจ hang ไม่มีกำหนด |
| HTTP GenerateContent3 | Yes (5s wait) | Dynamic (ocr_timeout_ms) | continueRegularOutput | ดี — timeout ปรับตาม SLA lane |
| HTTP GenerateContent (Re-ask) | **ไม่มี** | Dynamic | **Default (throw)** | ถ้า fail จะไม่มี webhook response |
| HTTP (Upload to Gemini) queue | **ไม่มี** | **ไม่มี** | continueRegularOutput | อาจ hang ภายใน 5 นาที workflow timeout |
| HTTP (GenerateContent) queue | **ไม่มี** | **ไม่มี** | continueRegularOutput | เช่นเดียวกัน |
| HTTP Request1 (legacy) | **ไม่มี** | **ไม่มี** | **Default (throw)** | ไม่มี error handling เลย |

**คำแนะนำ:** เพิ่ม retry + timeout ให้ทุก HTTP node โดยเฉพาะ Re-ask ที่ควรใช้ `continueRegularOutput` เพื่อไม่ให้ workflow crash

---

## Google Sheets — ความเสี่ยง Rate Limit

Main OCR path ใช้ **4 Google Sheets operations** ต่อ 1 request:
1. Read PROMPTS
2. Append OCR_RAW
3. Read ALL row_key (OCR)
4. Append OCR (per bill)

Google Sheets API limit: **60 requests/min/user**

ที่ 10+ concurrent requests จะ hit rate limit แน่นอน

---

## คำแนะนำเชิงสถาปัตยกรรมสำหรับ Production

### 1. ย้ายจาก Google Sheets เป็น Database
Google Sheets มีข้อจำกัด:
- 60 requests/min/user (rate limit)
- 50,000 chars/cell
- Get All row_key โหลดทุกแถว ไม่ scale

**แนะนำ:** ใช้ PostgreSQL หรือ Supabase สำหรับ `OCR_RAW`, `OCR`, `OCR_QUEUE`

### 2. Queue Worker ควร share pipeline เดียวกับ Main Path
ปัจจุบัน queue path ขาด:
- Document Classification
- Normalize + Validate
- Re-ask loop
- Few-shot examples
- Admission Control
- SLA Lane

ทำให้คุณภาพ OCR แตกต่างกันมากระหว่าง main path กับ queue path

### 3. ลบ Disabled Nodes ทั้งหมด
~20 disabled nodes จาก legacy path (Webhook_OCR_Test9) เพิ่มความสับสนและ maintenance burden

### 4. เพิ่ม Monitoring & Observability
- ไม่มี error rate tracking
- ไม่มี latency monitoring
- Telegram notification เป็นช่องทางเดียว
- **แนะนำ:** เพิ่ม structured logging, alerting on error rate spike, dashboard สำหรับ OCR success rate

### 5. เปลี่ยนชื่อ Workflow
ชื่อ `test-workflow` ไม่เหมาะสำหรับ production ควรเปลี่ยนเป็นชื่อที่สื่อความหมาย เช่น `ocr-invoice-processor`

### 6. เพิ่ม Input Validation ที่ Webhook Layer
- จำกัดขนาดไฟล์ (เช่น max 20MB)
- จำกัดจำนวนไฟล์ต่อ request
- Validate Content-Type header

---

## Checklist สรุป

- [ ] **P0:** แก้ `round3` undefined ใน Normalize+Validate
- [ ] **P1:** เพิ่ม normalization หลัง re-ask
- [ ] **P1:** เพิ่ม `allHeaders` ใน Code in JavaScript5
- [ ] **P1:** แก้ MIME sniffing ให้ decode แค่ 16 chars
- [ ] **P1:** เพิ่ม file count limit ใน queue upload
- [ ] **P1:** เพิ่ม Document Classifier ใน queue path
- [ ] **P1:** แก้ queue worker ให้ retry failed items
- [ ] **P1:** ลบ trailing `\n\n` จาก URL
- [ ] **P2:** วางแผนย้ายจาก Google Sheets เป็น DB
- [ ] **P2:** ย้าย hardcoded pricing ไป env var
- [ ] **P2:** เพิ่ม file size validation
- [ ] **P2:** sanitize Gemini error ก่อนส่งกลับ client
- [ ] **P2:** ลบ disabled nodes ทั้งหมด
- [ ] **P3:** ย้าย hardcoded values ไป config/env
- [ ] **P3:** เปลี่ยนชื่อ workflow
