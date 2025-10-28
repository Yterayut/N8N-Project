## Facebook Comment Bot Plan

### 1. Facebook Graph API Setup
- [ ] ตรวจสอบ/สร้างแอปบน Meta for Developers พร้อม product ที่ต้องใช้ (Facebook Login, Pages API) — **มีแอปแล้ว แต่ยังไม่ได้ทำ API test calls (สถานะใน Meta ยังเป็น “Testing not started”)**
- [ ] ขอสิทธิ์ `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_posts` — **ยื่นคำขอแล้วแต่ยังต้องทำขั้นตอนทดสอบ/ส่งให้ Meta อนุมัติ**
- [x] สร้าง Page access token แบบ long-lived สำหรับเพจ `889083480945134` และตรวจโพสต์ได้จริง (เก็บไว้ใน `.env` เป็น `FB_PAGE_ACCESS_TOKEN`)
- [x] บันทึก App ID (`660259396927223`), App Secret, Page ID, Graph API version (`v24.0`) ใน `.env`

### 2. LINE Notification Channel
- [x] เลือกใช้ **LINE Messaging API** (Channel: BTC-N8N) สำหรับการแจ้งเตือน
- [ ] *(Optional)* หากภายหลังต้องใช้ LINE Notify ให้สร้าง token และกำหนดจุดเก็บ — ยังไม่จำเป็นตอนนี้
- [x] Channel access token และรายชื่อผู้รับ (userId) เก็บไว้ใน `.env` แล้ว (`LINE_CHANNEL_ACCESS_TOKEN`, `LINE_ALERT_USER_IDS`)
- [x] ตัดสินใจเรียบร้อยว่าจัดเก็บ credential ผ่าน environment variables ของ n8n

### 3. Google Sheets Log Storage
- [x] สร้าง Google Sheet (`LINE Messages Log` / `FB Comment Log`) พร้อมคอลัมน์ครบถ้วน — https://docs.google.com/spreadsheets/d/1uiVmR84NpN8q8A3byW2NKAnnZ1vlF3q5Ev93L-0Qk9Q/edit?gid=0#gid=0
- [x] ตั้งค่า Google OAuth credential ใน n8n แล้วเชื่อมต่อสำเร็จ
- [x] บันทึก Spreadsheet ID (`1uiVmR84NpN8q8A3byW2NKAnnZ1vlF3q5Ev93L-0Qk9Q`) ใน workflow และเอกสาร

### 4. n8n Environment Preparation
- [x] ทดสอบแล้วว่า n8n instance เรียก Graph API, LINE Messaging API, Google Sheets ได้ครบ (โพสต์ขึ้นเพจ / รับ LINE / append ชีต)
- [x] ตั้งค่า environment variables/credentials (`FB_PAGE_ACCESS_TOKEN`, `FB_PAGE_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_ALERT_USER_IDS`, `GRAPH_API_VERSION`, ฯลฯ)
- [x] ปรับ workflow `My workflow 3` ให้ reuse โหนดพร้อม Route Switch → Call Sub Workflow สำหรับ fan-out

### 5. ข้อมูลเพิ่มเติมจากผู้ใช้
- [x] URL ฟอร์มร้องทุกข์: ใช้ค่าจาก `.env` (`FB_COMPLAINT_FORM_URL` – Google Form ปัจจุบัน)
- [x] ข้อความตอบกลับตามประเภท (ค่ามาตรฐานใน workflow):  
  - **ร้องทุกข์ (fb_complaint)**: `ขอบคุณที่แจ้งเรื่องกับ จ๊ะศรีกล้วยทอด ค่ะ หากต้องการแจ้งรายละเอียดเพิ่มเติมสามารถกรอกข้อมูลได้ที่ <FB_COMPLAINT_FORM_URL>`  
  - **ให้กำลังใจ (fb_encouragement)**: `ขอบคุณสำหรับกำลังใจที่มอบให้กันนะคะ ❤️`  
  - **คอมเมนต์ไม่เหมาะสม (fb_negative)**: ไม่ตอบกลับ ส่งคำสั่งลบคอมเมนต์ (`[delete comment]`) และแจ้งทีมผ่าน LINE  
  - **คอมเมนต์สติกเกอร์ (fb_sticker)**: ตอบกลับด้วยสติกเกอร์ ID จาก `.env` (`FB_POSITIVE_STICKER_ID`)
- [x] รายการโพสต์ที่ monitor: **เฝ้าทุกโพสต์บนเพจ** (ยังไม่จำกัด post-id หากต้องการกรองค่อยเพิ่มลิสต์ในอนาคต)

เมื่อ checklist นี้ครบ จะเริ่มลงมือประกอบ workflow ตามลำดับที่วางไว้ได้ทันที
