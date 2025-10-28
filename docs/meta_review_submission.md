# Meta Review Submission Checklist

เอกสารนี้ช่วยเตรียมข้อมูลเพื่อยื่นขออนุมัติสิทธิ์ Facebook Graph API สำหรับเพจ `889083480945134`

## 1. ตรวจสอบโทเคน
- ยืนยันว่า `.env` มีค่า `FB_LONG_USER_ACCESS_TOKEN` และ `FB_PAGE_ACCESS_TOKEN` ที่ใช้งานได้ (`debug_token` เผย `is_valid=true`, `expires_at=0`)
- ถ้าโทเคนหมดอายุ ให้รัน `generate_fb_tokens.sh` หรือ `refresh_fb_tokens.sh`

## 2. รวบรวมหลักฐาน API Test
ใช้คำสั่งใน `docs/facebook_permission_tests.md` เพื่อสร้างไฟล์ log และภาพหน้าจอ:
- `logs/test_pages_manage_posts_post.json` – ทดสอบโพสต์/คอมเมนต์/ลบ
- `logs/test_pages_read_user_content_feed.json`, `logs/test_pages_read_user_content_comments.json` – ข้อมูล feed และคอมเมนต์จริง
- `logs/test_pages_manage_metadata.json` – ข้อมูลเพจพร้อม tasks
- ภาพหน้าจอ (`images/fb-test-*.png`) แสดงโพสต์, การแก้ไข, คอมเมนต์, reply และข้อความจากผู้ใช้จริง

> เก็บผลลัพธ์ล่าสุดก่อน submit เพื่อให้ timestamp สดใหม่

## 3. จัดทำวิดีโอสาธิต (ถ้า Meta ร้องขอ)
1. เปิดเพจจริงและ workflow n8n
2. สร้างคอมเมนต์ตามแต่ละประเภท (ร้องทุกข์, ให้กำลังใจ, สติกเกอร์)
3. แสดงผลใน Facebook (ตอบกลับอัตโนมัติ) และ LINE แจ้งเตือน
4. เปิด Google Sheets เพื่อแสดงแถวใหม่

## 4. เตรียมคำอธิบายใน Developer Dashboard
- **Use case**: ระบบอัตโนมัติสำหรับร้าน “จ๊ะศรีกล้วยทอด” เพื่อตอบคอมเมนต์/แจ้งเตือนทีมงาน/เก็บสถิติ
- **ข้อมูลที่ใช้**: ชื่อผู้คอมเมนต์, ข้อความคอมเมนต์, รายละเอียดโพสต์ (ใช้เพื่อเลือกตอบกลับ/ลบ), ผลตอบกลับถูกจัดเก็บใน Google Sheets สำหรับแผนกบริการลูกค้า
- **การเก็บรักษาข้อมูล**: โทเคนเก็บใน `.env`, Google Sheets ใช้เฉพาะทีมภายใน, ไม่มีการแชร์ต่อบุคคลที่สาม

## 5. กด Submit for Review
1. ไปที่ Meta for Developers → App → App Review → Permissions and Features
2. สำหรับแต่ละ permission (`pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_metadata`, `business_management`, `pages_show_list`)  
   - ใส่คำอธิบายการใช้งาน  
   - แนบไฟล์ JSON/ภาพหน้าจอที่เตรียมไว้  
   - ใส่ลิงก์วิดีโอสาธิต (ถ้ามี)
3. ยืนยันข้อมูลติดต่อประสานงาน

## 6. ติดตามผล
- ตรวจสถานะใน Dashboard
- หาก Meta ขอตัวอย่างเพิ่มเติม ให้ใช้ log/ภาพหน้าจอใน `docs/` เพื่อส่งตอบทันที

เมื่อได้รับอนุมัติครบ ให้บันทึกเวลาและหมายเหตุใน `memory.md` เพื่ออ้างอิงในอนาคต
