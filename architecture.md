# สถาปัตยกรรมระบบอัตโนมัติ n8n

เอกสารนี้สรุปโครงสร้างและการทำงานของระบบอัตโนมัติที่สร้างด้วย n8n ภายในโฟลเดอร์ `/Users/teerayutyeerahem/My-project/n8n` เพื่อใช้ดูแลการสื่อสารผ่าน LINE Official Account (LINE OA) และ Facebook Page พร้อมบันทึกเหตุการณ์ลง Google Sheets และส่งการแจ้งเตือนที่จำเป็น

## 1. วัตถุประสงค์และภาพรวม
- รวมศูนย์เหตุการณ์จาก LINE OA และ Facebook Page มายัง Webhook เดียวของ n8n (`/webhook/line-webhook`)
- ทำความเข้าใจและคัดแยกประเภทเหตุการณ์ (ร้องเรียน, ให้กำลังใจ, ข้อความไม่เหมาะสม, สติกเกอร์ ฯลฯ) ก่อนตัดสินใจตอบกลับอัตโนมัติ หรือลบคอมเมนต์
- แจ้งเตือนทีมงานผ่าน LINE OA และบันทึกข้อมูลทุกเหตุการณ์ลง Google Sheets เพื่อให้ติดตามย้อนหลังและต่อยอดวิเคราะห์ได้
- รองรับคำสั่ง `wf:<path>` จาก LINE OA เพื่อเรียก workflow ย่อยอื่น ๆ ของ n8n ผ่าน HTTP sub-workflow

## 2. ส่วนประกอบโครงสร้างพื้นฐาน

### 2.1 Runtime และการเปิดใช้งาน
- ใช้ `n8n` เวอร์ชัน 1.92.2 ติดตั้งแบบ global และรันใน user folder เดียวกับโปรเจ็กต์
- สคริปต์ `start-n8n.sh` ทำหน้าที่หลักดังนี้  
  - โหลดตัวแปรจาก `.env` แล้วตั้ง `N8N_USER_FOLDER` ให้ชี้มาที่โปรเจ็กต์นี้  
  - เปิด Basic Auth สำหรับ UI/API ของ n8n (ค่า username/password ถูกกำหนดในสคริปต์และควรย้ายไปเก็บใน `.env`)  
  - เปิด `ngrok` เพื่อสร้าง public URL ให้ webhook ใช้ทดสอบจากภายนอก พร้อมแสดง URL บนคอนโซล  
  - เรียก `n8n start` และจัดการ kill กระบวนการ ngrok เมื่อสคริปต์จบการทำงาน
- การรัน n8n ดังกล่าวทำให้ฐานข้อมูลและ binary data ถูกเก็บไว้ภายใต้ `.n8n/` ในโปรเจ็กต์ ช่วยให้มี state เดียวกันระหว่างการรันแต่ละครั้ง

### 2.2 การตั้งค่าผ่านไฟล์ `.env`
- `.env` ใช้เก็บตัวแปรสำคัญ เช่น  
  - `FB_APP_ID`, `FB_APP_SECRET`, `FB_LONG_USER_ACCESS_TOKEN` ใช้สำหรับกระบวนการแลก token  
  - `FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID` สำหรับตอบกลับ/จัดการคอมเมนต์เพจ  
  - `FB_COMPLAINT_FORM_URL`, `FB_POSITIVE_STICKER_ID` สำหรับตอบกลับอัตโนมัติ  
  - `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_ALERT_USER_IDS` สำหรับส่งข้อความแจ้งเตือนกลับไปยังผู้ดูแล  
  - `GRAPH_API_VERSION` เพื่อกำหนดเวอร์ชันของ Facebook Graph API
- โครงสร้างโค้ดใน Code node รองรับ suffix ตาม Page ID (เช่น `FB_PAGE_ACCESS_TOKEN_<PAGEID>`) เพื่อให้แยกโทเคนหลายเพจได้ในอนาคต

### 2.3 พื้นที่จัดเก็บข้อมูลถาวร
- `.n8n/database.sqlite` — เก็บ workflow, credentials, execution log, ข้อมูล binary  
- `.n8n/config` — เก็บ `encryptionKey` ของ credential (ห้ามเผยแพร่) และค่า `tunnelSubdomain` สำหรับ tunnel service  
- `logs/` — พื้นที่เตรียมไว้สำหรับเก็บ log เพิ่มเติม (ว่างอยู่ในปัจจุบัน)  
- `workflow3.json` — ไฟล์สำรอง node configuration ของ workflow หลัก (My workflow 3) ในรูป JSON

### 2.4 บริการภายนอกที่เชื่อมต่อ
- **LINE Messaging API**: ส่งข้อความแจ้งเตือนด้วย `push` หรือ `multicast` ตามจำนวนผู้รับ (ใช้ Channel Access Token)  
- **Facebook Graph API**:  
  - รับ webhook comment event (ส่งมาที่ endpoint เดียวกับ LINE)  
  - เรียก API เพื่อตอบคอมเมนต์หรือส่งสติกเกอร์  
  - เรียก API เพื่อลบคอมเมนต์ที่เข้าข่ายไม่เหมาะสม  
- **Google Sheets API**: บันทึกข้อมูลลงชีต `FB Comment Log` ภายในสเปรดชีตเดียวกับ `LINE Messages Log`
- **ngrok**: เปิด public tunnel ให้ webhook ของ n8n เข้าถึงได้จากภายนอกเครื่อง

## 3. เส้นทางการไหลของข้อมูลหลัก

### 3.1 LINE OA → n8n
1. LINE OA ส่ง event (เช่น ข้อความจากผู้ใช้) มายัง `POST /webhook/line-webhook`  
2. `Webhook` node ส่งข้อมูลต่อให้ `Code` node เพื่อประมวลผล  
3. `Code` node แปล event เป็นโครงสร้างกลาง (ตั้งค่า `route`, `sheetStatus`, `line` payload ฯลฯ)  
4. หากข้อความขึ้นต้นด้วย `wf:<path>` ระบบจะตั้งค่า `route=subWorkflow` พร้อมเตรียม URL ของ sub-workflow (`/webhook/<path>` และ `/webhook-test/<path>`)  
5. ผลลัพธ์ทุกชิ้นถูกส่งเข้าบันทึกใน Google Sheets และวิ่งต่อไปยัง `Route Switch` เพื่อเลือกว่าจะเรียก sub-workflow เพิ่มหรือไม่  
6. กรณีเป็นเพียงการบันทึก/แจ้งเตือน ข้อมูลจะไหลผ่าน `FB Action Switch` (ทางออก default) ไปจบที่ `LINE Notify` เพื่อแจ้งเตือนผู้ดูแลต่อ

### 3.2 Facebook Page → n8n
1. Facebook Webhook ส่ง payload รูปแบบ `entry[]` มายัง endpoint เดียวกัน  
2. `Code` node วนอ่านทุก comment event ที่ verb=`add` และ item=`comment`  
3. มีการ normalize ข้อความเพื่อตรวจ keyword 3 กลุ่ม: `complaint`, `encouragement`, `negative` และตรวจคอมเมนต์ที่เป็นสติกเกอร์  
4. ระบบเตรียมข้อมูลตอบกลับตามกรณี (เช่น ส่งลิงก์ฟอร์มร้องเรียน, ส่งข้อความกำลังใจ, ลบคอมเมนต์ไม่เหมาะสม, ตอบด้วยสติกเกอร์) พร้อมจัดเตรียม payload สำหรับ LINE notify  
5. ทุกเหตุการณ์ถูกบันทึกลง Google Sheets พร้อมสถานะ (`sheetStatus`) และข้อมูลอ้างอิงคอมเมนต์  
6. `FB Action Switch` จะเลือกขั้นตอนถัดไป:  
   - `fb_complaint` หรือ `fb_encouragement` → `FB Reply Text` สำหรับตอบข้อความ  
   - `fb_sticker` → `FB Reply Sticker` เพื่อตอบสติกเกอร์กลับ  
   - `fb_negative` → `FB Delete Comment` เพื่อลบคอมเมนต์  
   - ค่าอื่น (เช่น `log`) → ส่งต่อไป `LINE Notify` โดยไม่ดำเนินการเพิ่มเติม

### 3.3 การบันทึก Google Sheets
- `Google Sheets` node ใช้ credential `Google Sheets account` (OAuth2) เขียนข้อมูลลงชีต `FB Comment Log`  
- ฟิลด์ที่บันทึกประกอบด้วย Timestamp, PostID, CommentID, UserName, UserID, Type, OriginalComment, ReplyMessage, NotifiedChannel, Status  
- ระบบตั้ง `attemptToConvertTypes=false` เพื่อคงรูปแบบข้อมูลเป็นสตริง ช่วยลดความคลาดเคลื่อนจากการแปลงประเภทอัตโนมัติของ n8n

### 3.4 การเรียก Workflow ย่อยผ่านคำสั่ง `wf:`
- คำสั่งใน LINE รูปแบบ `wf:<path> <payload>` จะทำให้ `route=subWorkflow`  
- `Route Switch` จะส่งข้อมูลไป `Call Sub Workflow` (HTTP Request) เพื่อเรียก `POST <baseUrl>/webhook/<path>` พร้อม payload ที่ประกอบด้วยค่า `originalEvent`, `message`, `content` ฯลฯ  
- การตอบกลับของ sub-workflow จะถูกส่งกลับให้ Node ถัดไปใช้งานต่อ (เช่นใช้ต่อยอดส่งแจ้งเตือน หรือบันทึกข้อมูลเพิ่มเติม)

## 4. รายละเอียด Workflow `My workflow 3`
- **Webhook (`line-webhook`)** — รับ HTTP POST จาก LINE/Facebook; รองรับหลายวิธีการ (multipleMethods=true)  
- **Code** — เป็นหัวใจของระบบ  
  - รวมการประมวลผลทั้ง LINE และ Facebook ไว้ในไฟล์เดียว  
  - สร้างฟังก์ชันช่วยเหลือ: strip accent ภาษาไทย, ตรวจ keyword, สร้าง URL คอมเมนต์ Facebook, แปลง timestamp  
  - เตรียมข้อมูลส่งต่อแบบมาตรฐาน ทั้งสำหรับ Google Sheets, การตอบคอมเมนต์, และ LINE notify  
  - ดึงค่าคอนฟิกจาก environment พร้อม fallback ค่า default เพื่อให้ workflow ใช้ได้แม้ยังไม่ได้ตั้งค่าบางตัว  
- **Google Sheets** — Append ข้อมูลลงชีต `FB Comment Log`; ทำงานควบคู่กับ `Google Sheets account` credential; เปิด retry/alwaysOutput เพื่อลดการสูญหายของข้อมูล  
- **Route Switch** — ตรวจค่า `$json.route`; ถ้าเป็น `subWorkflow` จะออกช่อง 1, ถ้าไม่ใช่จะผ่านช่อง 2 ไปหา `FB Action Switch`  
- **Call Sub Workflow** — ส่ง HTTP POST ไปยัง URL ที่ Code node เตรียมไว้ (Production URL) พร้อม payload; รองรับ retry 3 ครั้ง  
- **FB Action Switch** — แยกการทำงานสำหรับ route ต่าง ๆ (`fb_complaint`, `fb_encouragement`, `fb_sticker`, `fb_negative`, default)  
- **FB Reply Text** — เรียก `https://graph.facebook.com/v24.0/{commentId}/comments` เพื่อตอบข้อความ; ถ้าสำเร็จจะระบุสถานะ `*_REPLIED`  
- **FB Reply Sticker** — โพสต์สติกเกอร์ตอบกลับผ่าน Graph API (ระบุ `sticker_id`); ปรับสถานะเป็น `FB_STICKER_REPLIED` หรือ `FB_STICKER_ERROR`  
- **FB Delete Comment** — ลบคอมเมนต์ด้วย HTTP DELETE; เมื่อสำเร็จจะตั้งสถานะ `FB_NEGATIVE_DELETED`  
- **LINE Notify** — ถ้าตั้งค่าให้แจ้งเตือน จะเรียก API ของ LINE (push หรือ multicast) พร้อมข้อความสรุปเหตุการณ์; ลบ token ออกจาก payload ก่อนส่งต่อเพื่อลดการรั่วไหล

## 5. สคริปต์สนับสนุนและงานดูแลระบบ
- `generate_fb_tokens.sh` — ตัวช่วยแลก long-lived user token และ page token ของ Facebook  
  - รองรับทั้งการเรียกผ่าน env var และถามค่าจากเทอร์มินัล  
  - ใช้ `jq` หรือ `python3` แปลง JSON; มีฟังก์ชันคำนวณ `appsecret_proof`  
  - บันทึก token ลง `.env` (ตามขั้นตอน manual) พร้อมแจ้งสถานะต่าง ๆ บนคอนโซล
- `refresh_fb_tokens.sh` — Wrapper โหลดค่าเดิมจาก `.env` แล้วเรียก `generate_fb_tokens.sh` อัตโนมัติ เพื่อยืดอายุโทเคน  
- `start-n8n.sh` — ใช้รันระบบจริง พร้อมตั้ง Basic Auth และ ngrok อย่างครบวงจร  
- `workflow3.json` — ใช้เป็น snapshot node configuration (สำรอง/แลกเปลี่ยน workflow โดยไม่ต้องเชื่อมต่อ UI)  
- `memory.md`, `plan.md` — บันทึกกระบวนการตั้งค่าและแผนงานก่อนหน้า ช่วยให้ติดตามความเปลี่ยนแปลงได้  
- `logs/` — โฟลเดอร์ว่างที่เตรียมไว้เก็บ log เพิ่มเติม (สามารถใช้เก็บ stdout/stderr ของสคริปต์หรือ cron job ได้)

## 6. การตั้งค่าและความปลอดภัย
- Basic Auth ของ n8n ถูกกำหนดไว้ใน `start-n8n.sh`; ควรย้ายค่า credential เหล่านี้ไปไว้ใน `.env` และตั้งสิทธิ์ไฟล์ให้ปลอดภัย  
- `.env` และ `.n8n/config` มีความลับสำคัญ (token, encryptionKey) ต้องควบคุมสิทธิ์การเข้าถึง และไม่ควร commit ขึ้นระบบควบคุมเวอร์ชัน  
- โทเคนของ Facebook และ LINE ถูกล้างออกจาก payload ก่อนส่งไป node อื่นเพื่อป้องกันรั่วไหล แต่ยังคงอยู่ใน log ของ n8n หากเปิด verbose — ควรตรวจสอบการเก็บ log เพิ่มเติม  
- หากเปิด workflow ใน production ควรเปลี่ยนจาก ngrok ไปใช้ reverse proxy ที่มี SSL certificate ถาวรเพื่อความเสถียร  
- พิจารณาตั้ง cron job เรียก `refresh_fb_tokens.sh` และสำรองฐานข้อมูล `.n8n/database.sqlite` แบบสม่ำเสมอ

## 7. แนวทางพัฒนาต่อยอด
1. **แยก environment ต่อเพจ** — ใช้ suffix ตาม Page ID อย่างเต็มรูปแบบ เพื่อรองรับหลายเพจพร้อมกัน (เพิ่ม config และ mapping ใน Code node)  
2. **เพิ่มการตรวจสอบข้อผิดพลาด** — บันทึกผลล้มเหลวจาก Graph API/LINE API ลง Google Sheets หรือ Slack เพื่อให้ง่ายต่อการ debug  
3. **สร้าง workflow ย่อยเฉพาะกิจ** — ใช้คำสั่ง `wf:` เพื่อเรียก automation เพิ่มเติม เช่น เปิด ticket, ส่งอีเมล, ดึงข้อมูลจากระบบ CRM  
4. **ทำ version control ให้ workflow** — ใช้ `n8n export:workflow --all` เก็บสำรอง workflow เป็นไฟล์ JSON ใน repo เพื่อเห็นความเปลี่ยนแปลงระหว่างเวอร์ชัน  
5. **เพิ่มการทดสอบและจำลองเหตุการณ์** — สร้างสคริปต์จำลอง payload ของ LINE/Facebook เพื่อทดสอบ workflow ก่อน deploy ของจริง  
6. **ย้าย secret ไป Secret Manager** — หากย้ายไปรันบน server/cloud ให้ผนวกกับบริการ secret manager (เช่น AWS Parameter Store) ลดความเสี่ยงจากไฟล์ `.env`

> เมื่อเข้าใจ flow ข้างต้นแล้ว สามารถเพิ่ม node/branch ใหม่ใน n8n ได้โดยยึดรูปแบบ payload กลางที่ Code node สร้างขึ้น และพิจารณาควบคุม route ให้สอดคล้องกับ `Route Switch` และ `FB Action Switch` ที่มีอยู่ในระบบ
