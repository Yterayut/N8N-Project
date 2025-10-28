# คู่มือการอัพเกรด n8n Workflow 3 เป็น Enhanced v2.0

## 📋 สิ่งที่ทำเสร็จแล้ว

✅ **เขียน Enhanced Code node** (`code-node-enhanced.js`) - รองรับ 10+ content types
✅ **เพิ่ม Configuration** ใน `.env` - response & notification policies
✅ **สร้าง Test Payloads** (`test-payloads.json`) - 10 test cases ครอบคลุมทุกกรณี

---

## 🚀 ขั้นตอนการอัพเกรด

### **Step 1: รีสตาร์ท n8n เพื่อโหลด .env ใหม่**

```bash
cd /Users/teerayutyeerahem/My-project/n8n
pkill -f "n8n start" && pkill -f ngrok
./start-n8n.sh > logs/n8n-$(date +%Y%m%d-%H%M%S).log 2>&1 &
```

**เช็คว่ารันสำเร็จ:**
```bash
ps aux | grep n8n | grep -v grep
curl -s http://localhost:4040/api/tunnels | grep public_url
```

---

### **Step 2: อัพเดต Code Node ใน n8n UI**

1. **เปิด n8n UI:**
   - Local: http://localhost:5678
   - Login: `yterayut@gmail.com` / `Marn2530`

2. **เปิด Workflow 3:**
   - ไปที่ Workflows → "My workflow 3"
   - คลิกที่ **Code** node

3. **Copy Code ใหม่:**
   ```bash
   cat /Users/teerayutyeerahem/My-project/n8n/code-node-enhanced.js
   ```
   - เลือกทั้งหมด (Cmd+A)
   - Copy (Cmd+C)

4. **Paste ใน Code node:**
   - ลบ code เก่าทั้งหมดในหน้าต่าง Code editor
   - Paste code ใหม่ (Cmd+V)
   - คลิก **Save** (ปุ่มมุมบนขวา)

5. **Save Workflow:**
   - คลิก **Save** workflow (Ctrl+S หรือปุ่มด้านบน)

---

### **Step 3: ทดสอบ Workflow ด้วย Test Payloads**

#### **วิธีที่ 1: ทดสอบผ่าน curl (แนะนำ)**

```bash
cd /Users/teerayutyeerahem/My-project/n8n

# Test 1: Sticker Only
curl -X POST http://localhost:5678/webhook/line-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"id":"889083480945134","time":1761545561,"changes":[{"value":{"from":{"id":"25617669544483307","name":"Kiriyah Rz"},"post_id":"889083480945134_122103846645077607","comment_id":"122103846645077607_1354207589618104","created_time":1761545557,"item":"comment","parent_id":"889083480945134_122103846645077607","verb":"add"},"field":"feed"}]}],"object":"page"}'

# Test 2: Encouragement Text
curl -X POST http://localhost:5678/webhook/line-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"id":"889083480945134","time":1761546669,"changes":[{"value":{"from":{"id":"25617669544483307","name":"Kiriyah Rz"},"message":"สู้ๆๆๆ","post_id":"889083480945134_122103846645077607","comment_id":"122103846645077607_1490822195371767","created_time":1761546667,"item":"comment","parent_id":"889083480945134_122103846645077607","verb":"add"},"field":"feed"}]}],"object":"page"}'

# Test 3: Complaint
curl -X POST http://localhost:5678/webhook/line-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"id":"889083480945134","time":1761546700,"changes":[{"value":{"from":{"id":"25617669544483307","name":"Test User"},"message":"ร้องเรียน สินค้าไม่ดี ต้องการแจ้งปัญหา","post_id":"889083480945134_122103846645077607","comment_id":"122103846645077607_1234567890","created_time":1761546698,"item":"comment","parent_id":"889083480945134_122103846645077607","verb":"add"},"field":"feed"}]}],"object":"page"}'

# Test 4: Negative (Delete)
curl -X POST http://localhost:5678/webhook/line-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"id":"889083480945134","time":1761546750,"changes":[{"value":{"from":{"id":"99999999999","name":"Spam User"},"message":"เหี้ย ร้านนี้โกงลูกค้า แย่สุดๆ","post_id":"889083480945134_122103846645077607","comment_id":"122103846645077607_9999999999","created_time":1761546748,"item":"comment","parent_id":"889083480945134_122103846645077607","verb":"add"},"field":"feed"}]}],"object":"page"}'

# Test 5: Question
curl -X POST http://localhost:5678/webhook/line-webhook \
  -H "Content-Type: application/json" \
  -d '{"entry":[{"id":"889083480945134","time":1761546800,"changes":[{"value":{"from":{"id":"12345678901","name":"Curious Customer"},"message":"ราคาเท่าไหร่ครับ สั่งได้ไหม","post_id":"889083480945134_122103846645077607","comment_id":"122103846645077607_1111111111","created_time":1761546798,"item":"comment","parent_id":"889083480945134_122103846645077607","verb":"add"},"field":"feed"}]}],"object":"page"}'
```

#### **วิธีที่ 2: ทดสอบผ่าน n8n UI (Execute Workflow)**

1. ไปที่ n8n UI → Workflow 3
2. คลิกที่ **Webhook** node
3. คลิกปุ่ม **Listen for Test Event** (หรือ Test step)
4. Copy payload จาก `test-payloads.json`
5. ใช้ curl ส่ง payload ไปที่ webhook
6. เช็คผลลัพธ์ใน **Executions** tab

---

### **Step 4: ตรวจสอบผลการทดสอบ**

#### **A. เช็คใน n8n Executions**

1. ไปที่ **Executions** tab (ด้านขวาบน)
2. เลือก execution ล่าสุด
3. คลิกที่ **Code** node → ดู OUTPUT
4. ตรวจสอบ fields:
   - `contentType`: ต้องตรงกับที่คาดหวัง (sticker/text/photo/video/mixed/empty)
   - `intent`: ต้องตรงกับที่คาดหวัง (complaint/encouragement/negative/question/normal/unknown)
   - `route`: ต้องตรงกับ expected action
   - `sheetStatus`: แสดงสถานะการประมวลผล

#### **B. เช็คใน Google Sheets**

1. เปิด Google Sheet: [FB Comment Log](https://docs.google.com/spreadsheets/d/1uiVmR84NpN8q8A3byW2NKAnnZ1vlF3q5Ev93L-0Qk9Q/edit?usp=drivesdk)
2. ดู sheet "FB Comment Log"
3. ตรวจสอบว่าข้อมูลบันทึกถูกต้อง:
   - **Type** column: ต้องแสดง FB_STICKER, FB_ENCOURAGEMENT, FB_COMPLAINT, etc.
   - **Status** column: แสดงสถานะการตอบกลับหรือลบ
   - **ContentType** column (ถ้ามี): แสดงประเภท content

#### **C. เช็คการตอบกลับบน Facebook (สำหรับ live test)**

1. ไปที่ Facebook Page post จริง
2. คอมเมนต์ตาม test cases
3. เช็คว่า bot ตอบกลับถูกต้องหรือไม่

---

## ✅ Test Cases & Expected Results

| Test | Content Type | Intent | Route | Action |
|------|-------------|--------|-------|--------|
| 1. Sticker 👍 | `sticker` | `unknown` | `fb_sticker` | ✅ ตอบสติกเกอร์กลับ |
| 2. "สู้ๆๆๆ" | `text` | `encouragement` | `fb_encouragement` | ✅ ตอบ "ขอบคุณ ❤️" |
| 3. "ร้องเรียน..." | `text` | `complaint` | `fb_complaint` | ✅ ตอบ + ส่งฟอร์ม |
| 4. "เหี้ย..." | `text` | `negative` | `fb_negative` | ✅ **ลบทันที** |
| 5. "ราคาเท่าไหร่" | `text` | `question` | `log` | 📝 Log (ไม่ตอบ)* |
| 6. 📷 Photo | `photo` | `unknown` | `log` | 📝 Log (ไม่ตอบ)* |
| 7. "สู้ๆ" + 📷 | `mixed` | `encouragement` | `fb_encouragement` | ✅ ตอบ (intent priority) |
| 8. "อร่อยมาก" | `text` | `normal` | `log` | 📝 Log (ไม่ตอบ)* |
| 9. (empty) | `empty` | `unknown` | `log` | 📝 Log เท่านั้น |
| 10. 🎥 Video | `video` | `unknown` | `log` | 📝 Log (ไม่ตอบ)* |

\* *ถ้าต้องการให้ตอบ ให้เปลี่ยน config ใน `.env`:*
- `FB_REPLY_TO_QUESTION=true`
- `FB_REPLY_TO_PHOTO=true`
- `FB_REPLY_TO_VIDEO=true`
- `FB_REPLY_TO_NORMAL=true`

---

## 🔧 Configuration Options

### **Response Policies** (ตอบกลับหรือไม่)
```bash
FB_REPLY_TO_STICKER=true      # ตอบสติกเกอร์ไหม
FB_REPLY_TO_PHOTO=false       # ตอบรูปภาพไหม
FB_REPLY_TO_VIDEO=false       # ตอบวิดีโอไหม
FB_REPLY_TO_QUESTION=false    # ตอบคำถามไหม
FB_REPLY_TO_NORMAL=false      # ตอบข้อความธรรมดาไหม
```

### **Notification Policies** (แจ้งเตือน LINE หรือไม่)
```bash
FB_NOTIFY_ALL=false           # แจ้งเตือนทุก comment
FB_NOTIFY_COMPLAINT=true      # แจ้งเฉพาะร้องเรียน
FB_NOTIFY_QUESTION=true       # แจ้งเฉพาะคำถาม
FB_NOTIFY_NEGATIVE=true       # แจ้งเฉพาะเชิงลบ
```

### **Custom Keywords** (ปรับแต่ง keywords)
```bash
FB_COMPLAINT_KEYWORDS=ร้องทุกข์,ร้องเรียน,เดือดร้อน
FB_ENCOURAGEMENT_KEYWORDS=สู้ๆ,กำลังใจ,เชียร์
FB_NEGATIVE_KEYWORDS=ด่า,เหี้ย,fuck
FB_QUESTION_KEYWORDS=ราคา,ราคาเท่าไหร่,ขาย
```

---

## 🐛 Troubleshooting

### **ปัญหา: Bot ไม่ตอบกลับ**
- ✅ เช็ค `.env` ว่าโหลดแล้วหรือยัง (รีสตาร์ท n8n)
- ✅ เช็ค `FB_PAGE_ACCESS_TOKEN` ว่าถูกต้องและไม่หมดอายุ
- ✅ เช็ค execution log ใน n8n UI

### **ปัญหา: Sticker ไม่ถูก detect**
- ✅ Payload ต้องไม่มี `message` field
- ✅ Check `contentType` output จาก Code node
- ✅ ดู `hasSticker` logic ใน code (บรรทัด ~154-164)

### **ปัญหา: Keywords ไม่ทำงาน**
- ✅ ตรวจสอบ Thai tone marks normalization
- ✅ ลอง log `normalized` text ออกมาดู
- ✅ ตรวจสอบว่า keywords ตัวพิมพ์เล็กหมด

### **ปัญหา: LINE notification ไม่มา**
- ✅ เช็ค `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_ALERT_USER_IDS`
- ✅ ดู `sheetNotifiedChannel` ใน output
- ✅ เช็ค LINE Notify node execution

---

## 📊 ตัวอย่าง Output จาก Enhanced Code Node

```json
{
  "source": "facebook",
  "contentType": "sticker",
  "intent": "unknown",
  "route": "fb_sticker",
  "sheetType": "FB_STICKER",
  "sheetStatus": "FB_STICKER_REPLY",
  "messageType": "sticker",
  "facebook": {
    "pageId": "889083480945134",
    "commentId": "122103846645077607_1354207589618104",
    "reply": {
      "type": "sticker",
      "stickerId": "369239343222814"
    }
  },
  "line": {
    "enabled": false,
    "message": "[Facebook] มีคอมเมนต์สติกเกอร์บนเพจ จ๊ะศรีกล้วยทอด..."
  }
}
```

---

## 🎉 Success Criteria

เมื่อทดสอบครบทุก test case และได้ผลลัพธ์ตามคาดหวัง:

✅ Sticker comments → ตอบสติกเกอร์กลับ
✅ Encouragement → ตอบขอบคุณ
✅ Complaint → ตอบ + ส่งฟอร์ม
✅ Negative → ลบทันที + แจ้งเตือน LINE
✅ Question → Log หรือตอบ (ตาม config)
✅ Photo/Video → Log (ไม่ตอบ ตาม config)
✅ Mixed content → ให้น้ำหนัก intent
✅ บันทึกลง Google Sheets ถูกต้องครบถ้วน

---

## 📝 Next Steps

หลังจากทดสอบสำเร็จ:

1. **Export Workflow**: `n8n export:workflow --id=Ga5bDLZW6uUaY2KI --output=workflow3-v2.json`
2. **Backup Database**: `cp .n8n/database.sqlite .n8n/database.sqlite.backup`
3. **Update Documentation**: แก้ไข `architecture.md` และ `memory.md`
4. **Monitor Production**: ติดตามผล execution และ error rate

---

**🚀 พร้อมอัพเกรดแล้ว! ขอให้ใช้งาน Enhanced Workflow v2.0 อย่างมีความสุข**

*Created: 27 October 2025*
*Version: 2.0 (Enhanced Multi-Content Support)*
