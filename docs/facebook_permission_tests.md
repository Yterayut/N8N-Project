# Facebook Permission Test Evidence

รวบรวมคำสั่งและผลลัพธ์ที่ใช้ทดสอบเพื่อเตรียมส่งอนุมัติสิทธิ์บน Meta for Developers

## ใช้งานก่อนเริ่ม
```bash
export GRAPH_API_VERSION="v24.0"
export FB_APP_ID="660259396927223"
export FB_APP_SECRET="d1b65ead0b6cf3174a1ad484251860ac"
export FB_PAGE_ID="889083480945134"
export FB_LONG_USER_ACCESS_TOKEN="..."   # long-lived user token ปัจจุบัน
export FB_PAGE_ACCESS_TOKEN="..."        # page token ปัจจุบัน
```

> คำสั่งทุกชุดบันทึกผลลัพธ์ (ผ่าน `jq`) ลงในโฟลเดอร์ `logs/` เพื่อแนบเป็นหลักฐาน

---

## pages_manage_posts / pages_manage_engagement
```bash
# สร้างโพสต์ใหม่
POST_ID=$(curl -s -X POST \
  "https://graph.facebook.com/$GRAPH_API_VERSION/$FB_PAGE_ID/feed" \
  -F "message=โพสต์ทดสอบ permission pages_manage_posts $(date '+%F %T')" \
  -F "access_token=$FB_PAGE_ACCESS_TOKEN" | jq -r '.id')

# อัปเดตข้อความโพสต์
curl -s -X POST \
  "https://graph.facebook.com/$GRAPH_API_VERSION/$POST_ID" \
  -F "message=อัปเดตข้อความโพสต์ทดสอบ $(date '+%F %T')" \
  -F "access_token=$FB_PAGE_ACCESS_TOKEN"

# คอมเมนต์ด้วยเพจ
COMMENT_ID=$(curl -s -X POST \
  "https://graph.facebook.com/$GRAPH_API_VERSION/$POST_ID/comments" \
  -F "message=คอมเมนต์ทดสอบจาก workflow $(date '+%F %T')" \
  -F "access_token=$FB_PAGE_ACCESS_TOKEN" | jq -r '.id')

# ตอบกลับคอมเมนต์
curl -s -X POST \
  "https://graph.facebook.com/$GRAPH_API_VERSION/$COMMENT_ID/comments" \
  -F "message=ข้อความตอบกลับคอมเมนต์ทดสอบ $(date '+%F %T')" \
  -F "access_token=$FB_PAGE_ACCESS_TOKEN"

# ทำความสะอาด
curl -s -X DELETE "https://graph.facebook.com/$GRAPH_API_VERSION/$COMMENT_ID" \
  -d "access_token=$FB_PAGE_ACCESS_TOKEN"
curl -s -X DELETE "https://graph.facebook.com/$GRAPH_API_VERSION/$POST_ID" \
  -d "access_token=$FB_PAGE_ACCESS_TOKEN"
```

หลักฐานภาพ: `images/fb-test-post-*.png` (โพสต์, การแก้ไข, คอมเมนต์, reply)

---

## pages_read_user_content
```bash
# อ่านโพสต์ล่าสุดของเพจ
curl -s -G "https://graph.facebook.com/$GRAPH_API_VERSION/$FB_PAGE_ID/feed" \
  -d "limit=5" \
  -d "access_token=$FB_PAGE_ACCESS_TOKEN" | jq > logs/test_pages_read_user_content_feed.json

# อ่านคอมเมนต์ของโพสต์ที่เพจใช้งานจริง
curl -s -G "https://graph.facebook.com/$GRAPH_API_VERSION/889083480945134_122101911639077607/comments" \
  -d "summary=true" \
  -d "access_token=$FB_PAGE_ACCESS_TOKEN" | jq > logs/test_pages_read_user_content_comments.json
```

ตัวอย่าง response มีคอมเมนต์จากผู้ใช้ “อร่อย” พร้อม `summary.total_count = 1`

---

## pages_manage_metadata / business_management
```bash
curl -s -G "https://graph.facebook.com/$GRAPH_API_VERSION/me/accounts" \
  -d "fields=id,name,tasks,can_post" \
  -d "access_token=$FB_LONG_USER_ACCESS_TOKEN" \
  | jq > logs/test_pages_manage_metadata.json
```

ผลลัพธ์มีรายการเพจ `889083480945134` พร้อม `tasks` และ `can_post=false` (เพจสามารถถูกจัดการผ่าน API ได้)

นอกจากนี้ `curl -s -G "https://graph.facebook.com/$GRAPH_API_VERSION/me/businesses"` ด้วย user token คืน business id `2260688474404292`

---

## แนบหลักฐาน
- Command outputs: ในโฟลเดอร์ `logs/`
- ภาพหน้าจอ: `images/fb-test-*.png` (โพสต์ก่อน/หลังแก้ไข, คอมเมนต์, reply, คอมเมนต์จากผู้ใช้จริง)
- ข้อมูลอ้างอิงในเอกสาร `memory.md` (หัวข้อ “ทดสอบสิทธิ์ Facebook Graph API...”)

พร้อมใช้ข้อมูลชุดนี้ประกอบการส่ง review บน Meta for Developers
