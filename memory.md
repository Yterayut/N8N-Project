# บันทึกการทำงานระบบ n8n

เอกสารนี้รวบรวมประสบการณ์ ตำแหน่งไฟล์สำคัญ และขั้นตอนที่ใช้ขณะพัฒนาระบบอัตโนมัติด้วย n8n โดยจัดกลุ่มตามหมวดเพื่อให้ค้นหาได้รวดเร็ว พร้อมสรุปเหตุการณ์ตามลำดับเวลาที่ท้ายเอกสาร

## สารบัญ
- [ตั้งค่าเริ่มต้น](#ตั้งค่าเริ่มต้น)
- [พัฒนา Workflow](#พัฒนา-workflow)
- [ปัญหาและทางแก้](#ปัญหาและทางแก้)
- [งานดูแลระบบ](#งานดูแลระบบ)
- [ไทม์ไลน์ย่อ](#ไทม์ไลน์ย่อ)

---

## ตั้งค่าเริ่มต้น

### ติดตั้งและตรวจสอบเครื่องมือ (20 ต.ค. 2025)
- ติดตั้ง n8n เวอร์ชัน 1.92.2 ด้วย `npm -g install n8n@1.92.2` ใช้เวลาประมาณ 5 นาที (2017 packages)
- ยืนยันความพร้อมของ Code node ในตัว n8n  
  - **Code (JavaScript)**: รองรับ `async/await`, เข้าถึง `$input`, `$items`, `$node`, ใช้ libs มาตรฐานของ n8n  
  - **Code (Python)**: ต้องติดตั้งเพิ่มเติม เช่น `@n8n/n8n-nodes-langchain`
- โค้ดตัวอย่างสำหรับ Code node:

```javascript
for (const item of $input.all()) {
  item.json.newField = item.json.oldField * 2;
}
return $input.all();
```

### เปิด n8n ด้วย ngrok และ Basic Auth
- สั่งรัน ngrok `ngrok http 5678` และดึง URL จาก `http://localhost:4040/api/tunnels`
- เรียก `n8n start` พร้อมตั้งค่า environment:
  - `WEBHOOK_URL=https://<ngrok>.ngrok-free.dev`
  - `N8N_BASIC_AUTH_ACTIVE=true`
  - `N8N_BASIC_AUTH_USER=yterayut@gmail.com`
  - `N8N_BASIC_AUTH_PASSWORD=Marn2530`
- เข้าถึง n8n UI ผ่าน ngrok URL และล็อกอินด้วย credential ข้างต้น

### Workflow ทดสอบ Code Node
- โครงสร้าง: `Manual Trigger → Code`
- ตัวอย่างโค้ด:

```javascript
return [
  {
    json: {
      message: "สวัสดีจาก Code Node! 🎉",
      timestamp: new Date().toISOString(),
      randomNumber: Math.floor(Math.random() * 100),
      calculation: {
        add: 5 + 10,
        multiply: 5 * 10,
        power: Math.pow(2, 8),
      },
    },
  },
];
```

### เตรียม Google Sheets และ OAuth
1. **สร้างชีต**: `LINE Messages Log` (คอลัมน์ Timestamp, User ID, Message, Type)
2. **เตรียม OAuth บน Google Cloud**  
   - สร้าง Project (เช่น `n8n-integration`)  
   - Enable APIs: Google Sheets API, Google Drive API  
   - ตั้งค่า OAuth consent screen (External, เพิ่ม scope `.../auth/spreadsheets`, `.../auth/drive`, เพิ่มอีเมลตนเองเป็น Test User)  
   - สร้าง OAuth Client (Web application) แล้วใส่ Redirect URI จาก n8n:  
     `https://<ngrok>/rest/oauth2-credential/callback`  
   - คัดลอก Client ID / Client Secret ไปไว้ใน Credential `Google Sheets OAuth2 API` บน n8n แล้วกด Connect

---

## พัฒนา Workflow

### Workflow: LINE → n8n → Google Sheets
- **โครงสร้างทั่วไป**  
  `Webhook (line-webhook)` → `Code` → `Google Sheets (Append)`
- **การตั้งค่า Node**
  - **Webhook**: Method `POST`, Path `line-webhook`, Response `Immediately (200)`  
    URL ตัวอย่าง: `https://<ngrok>/webhook/line-webhook`
  - **Code**: คัดแยกเฉพาะข้อความจาก LINE และ map เป็นฟิลด์ที่ต้องการ

```javascript
const items = $input.all();
const result = [];

for (const item of items) {
  const body = item.json.body || item.json;
  if (body.events) {
    for (const event of body.events) {
      if (event.type === 'message' && event.message?.type === 'text') {
        result.push({
          json: {
            timestamp: new Date(event.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            userId: event.source?.userId ?? 'Unknown',
            message: event.message.text ?? '',
            messageType: event.message.type ?? 'text',
            replyToken: event.replyToken ?? '',
          },
        });
      }
    }
  }
}

return result;
```

  - **Google Sheets**: Operation `Append Row`, กำหนด Columns → `={{ $json.field }}` (ไม่มีช่องว่าง) สำหรับ Timestamp/User ID/Message/Type, เปิด `retryOnFail=true`, `maxTries=3`

- **การเชื่อม LINE Bot**
  - ตั้ง Webhook URL ใน LINE Dev Console → Verify → Open `Use webhook`
  - ปิด Auto-reply messages
  - ทดสอบส่งข้อความ “ทดสอบ”, “ทดสอบ 123”, “สวัสดี 2025” แล้วตรวจผลใน Google Sheets

### รายงานสถานะ (20 ต.ค. 2025, 22:30 น.)
- Workflow `My workflow 3` ทำงานครบ: Webhook รับข้อมูล, Code ประมวลผล, Google Sheets บันทึกข้อมูล
- Execution #56 (22:30:35) ผ่านใน 5 ms
- Google Sheets row ตัวอย่าง:  
  `Timestamp=20/10/2568 22:30`, `User ID=U9f2d613ee48931a4c3b9ebeac27de312`, `Message=สวัสดี 2025`

### Workflow Routing: LINE/Facebook Hub
- ปรับ Code node ให้รองรับคำสั่ง `wf:<path>` โดยเพิ่มฟิลด์ `route`, `command`, `subWorkflow` (รวม Production/Test URL และ payload) พร้อม fallback URL จาก `item.json.webhookUrl` หรือ `WEBHOOK_URL`
- เพิ่ม `Route Switch` ตรวจ `{{$json.route}}`  
  - ถ้าเป็น `subWorkflow` → ส่งไป `Call Sub Workflow` (HTTP POST)  
  - ถ้าไม่ใช่ → ส่งต่อไป flow เดิม (Google Sheets หรือ Facebook actions)
- `Call Sub Workflow` ใช้ `retryOnFail=true`, `maxTries=3` และโพสต์ payload ที่ห่อ LINE event
- ยังคงเส้นทาง `Code → Google Sheets` เพื่อเก็บ log ทุกข้อความ

---

## ปัญหาและทางแก้

| วันที่/เวลา | อาการ | แนวทางแก้ |
|-------------|--------|------------|
| 20 ต.ค. 2025, 23:52 | ค่าใน Google Sheets ไม่ขึ้น เพราะ expression มีช่องว่าง (`= {{ }}`) | ปรับ mapping เป็น `={{ ... }}` ในทุกคอลัมน์ |
| 20 ต.ค. 2025, 23:52 | การเชื่อมต่อ Webhook → Code หลุด (connections ว่างในฐานข้อมูล) | เชื่อมต่อใหม่ใน `.n8n/database.sqlite` ตาราง `workflow_entity` ของ `My workflow 3` |
| 21 ต.ค. 2025, 00:05 | Google Sheets node error `ECONNRESET` ขณะเรียก API | เปิด `retryOnFail=true`, `maxTries=3` และทดสอบซ้ำ (execution #75 ผ่าน) |
| ช่วงจัดหมวดหมู่ | ต้องตั้งค่า Google OAuth แต่ไม่รู้ Client ID/Secret | สร้าง Google Cloud Project, เปิด Sheets/Drive API, ตั้ง OAuth consent, เพิ่ม redirect URI, แล้ว copy Client ID/Secret ไป n8n |

---

## งานดูแลระบบ

- ย้ายโฟลเดอร์การทำงานทั้งหมดไปไว้ที่ `/Users/teerayutyeerahem/My-project/n8n/.n8n`
- สคริปต์ `start-n8n.sh` ใช้รัน n8n พร้อมตั้งค่า environment, Basic Auth, เปิด ngrok, แสดง NGROK URL, และ `trap` เพื่อ kill ngrok เมื่อออก
- สร้างและปรับปรุงสคริปต์จัดการโทเคน Facebook  
  - `generate_fb_tokens.sh` รองรับ long-lived user/page token, คำนวณ `appsecret_proof`, ดึงข้อมูล `/me/accounts` หรือ `/me`, อัปเดต `.env` โดยไม่ทับ key อื่น  
  - `refresh_fb_tokens.sh` โหลดค่าใน `.env`, เรียก `generate_fb_tokens.sh`, บันทึกเวลาใน `logs/facebook_token_refresh.log`
- ตั้ง cron job ให้รัน `refresh_fb_tokens.sh` รายสัปดาห์
- ตรวจสอบโทเคน  
  - `FB_LONG_USER_ACCESS_TOKEN` เป็น long-lived (`expires_at = 0`, `data_access_expires_at` ~60 วัน)  
  - `FB_PAGE_ACCESS_TOKEN` สามารถโพสต์/คอมเมนต์ได้จริง (ทดสอบด้วยโพสต์ “Hello World generate_fb_tokens.sh”)

---

## ไทม์ไลน์ย่อ

- **20 ต.ค. 2025 18:00** — ติดตั้ง n8n v1.92.2, ทดสอบความพร้อมของ Code node, รัน ngrok + Basic Auth  
- **20 ต.ค. 2025 18:30-21:00** — สร้าง workflow ตัวอย่าง (Manual Trigger → Code), ทดสอบ output  
- **20 ต.ค. 2025 21:00-22:30** — เตรียม Google Sheets & OAuth, สร้าง workflow `Webhook → Code → Google Sheets`, เชื่อม LINE Bot, ทดสอบข้อความ “สวัสดี 2025” | execution #56  
- **20 ต.ค. 2025 23:52** — แก้ mapping Google Sheets (ลบช่องว่าง), เชื่อม connection ในฐานข้อมูล, execution #73 สำเร็จ (ข้อความ `liverpoolFC`)  
- **21 ต.ค. 2025 00:05** — พบ `ECONNRESET` → ตั้ง retry ให้ Google Sheets, execution #75 ผ่าน  
- **21 ต.ค. 2025 00:20** — ปรับ `My workflow 3` ให้เป็น hub: เพิ่ม `Route Switch`, `Call Sub Workflow`, รองรับ `wf:<path>`  
- **21 ต.ค. 2025 18:05** — จัดระเบียบโฟลเดอร์, สร้าง `start-n8n.sh`, เพิ่มสคริปต์ต่ออายุโทเคน Facebook, ยืนยันโทเคนใช้งานได้จริง

---

> หมายเหตุ: อัปเดตเอกสารนี้ทุกครั้งเมื่อมีการเปลี่ยนแปลงสถาปัตยกรรม, โทเคน, หรือ workflow ใหม่ เพื่อให้ทีมสามารถค้นหาอ้างอิงได้ทันที

---

## สิ่งที่ทำสำเร็จและบทเรียนที่ได้

- **โพสต์เนื้อหาขึ้น Facebook Page ด้วย Graph API สำเร็จ (21 ต.ค. 2025, 21:10)**  
  - ใช้ค่า `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `GRAPH_API_VERSION` จาก `.env` และส่ง `POST https://graph.facebook.com/{version}/{page_id}/feed` พร้อมพารามิเตอร์ `message`, `access_token`
  - สร้างสคริปต์ Python ชั่วคราวสำหรับยิง POST โดยอ่านค่าจาก `.env` และ (เฉพาะบนเครื่องที่ยังไม่ติดตั้ง CA) ใช้ `ssl._create_unverified_context()` เพื่อข้ามการตรวจ SSL
  - ได้ post id `889083480945134_122101911639077607` ยืนยันว่าโพสต์ขึ้นเพจแล้ว
- **บทเรียน**: ตรวจสอบความพร้อมของโทเคนใน `.env` ก่อน (มี `FB_PAGE_ACCESS_TOKEN` ที่ไม่ว่าง), หากเผชิญ SSL error ให้ใช้วิธีชั่วคราวเช่นสร้าง unverified context หรือใช้ `curl -k` แล้วจัดการ root certificate ภายหลัง
- **ทดสอบสิทธิ์ Facebook Graph API สำหรับการขอรีวิว (22 ต.ค. 2025)**  
  - Flow `pages_manage_posts` / `pages_manage_engagement`: `POST /{page_id}/feed` → ได้ post id (`889083480945134_122101945041077607` เป็นต้น), `POST /{post_id}` ปรับข้อความ, `POST /{post_id}/comments` สร้างคอมเมนต์, `POST /{comment_id}/comments` ตอบกลับ และ `DELETE` ล้างโพสต์/คอมเมนต์สำเร็จ (`{"success": true}`)  
  - `pages_read_user_content`: `GET /{page_id}/feed?limit=5` คืนโพสต์ล่าสุดของเพจ (บันทึก JSON/สกรีนไว้ใช้แนบ review)  
  - `business_management`: `GET /me/businesses` ด้วย user token แสดง business id `2260688474404292`  
  - หมายเหตุ: `GET /{page_id}/comments` และ `fields=tasks` บน endpoint ของเพจคืน error code 100 (field ไม่มีใน node Page) → ให้ใช้ `GET /me/accounts?fields=id,name,tasks` หรือ fields ที่รองรับแทนตอนส่งหลักฐาน  
  - ภาพหน้าจอจากเพจยืนยันว่าโพสต์, การแก้ไข, คอมเมนต์ และ reply ถูกเผยแพร่และลบตามลำดับ
- **ทดสอบเพิ่มเติมหลังเตรียมแผน (22 ต.ค. 2025, บ่าย)**  
  - `GET /me/accounts?fields=id,name,tasks,can_post` ด้วย long-lived user token สำเร็จ → เพจ `889083480945134` แสดง tasks (`ADVERTISE`, `ANALYZE`, `CREATE_CONTENT`, `MESSAGING`, `MODERATE`, `MANAGE`) ยืนยัน permission `pages_manage_metadata`/`business_management`  
  - `GET /{post_id}/comments?summary=true` (post `889083480945134_122101911639077607`) คืนคอมเมนต์จริงของผู้ใช้ (“อร่อย”) พร้อม summary → ใช้เป็นหลักฐาน `pages_read_user_content` / `pages_manage_engagement`  
  - บันทึก JSON จากคำสั่งเหล่านี้ใน logs/ เพื่อแนบตอน Submit Review
- **จัดระเบียบหลักฐาน Meta Review (docs/facebook_permission_tests.md)**  
  - สร้างไฟล์สรุปคำสั่งและผลลัพธ์ที่ต้องใช้ประกอบการขออนุมัติสิทธิ์ (`pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_metadata`, `business_management`) พร้อมระบุไฟล์ log/image ที่เกี่ยวข้อง  
  - ใช้เป็น checklist อ้างอิงก่อนส่ง review
- **เตรียมเอกสารส่ง Meta Review (docs/meta_review_submission.md)**  
  - รวบรวมขั้นตอนก่อน submit: ตรวจโทเคน, รันคำสั่ง test, เก็บภาพ/วิดีโอ, เขียนคำอธิบายการใช้งานและความปลอดภัย, checklist การส่ง  
  - ใช้เป็น playbook เมื่อถึงเวลายื่นรีวิวจริง
- **วิเคราะห์ execution ID#85 (21 ต.ค. 2025, 15:38)**  
  - Payload จาก LINE (`LineBotWebhook/2.0`) วิ่งเข้า Webhook → Code → Route Switch → Google Sheets ภายใน ~4.1 วินาที  
  - Code node กำหนด `route = "log"` (เพราะข้อความไม่ขึ้นต้นด้วย `wf:`) ทำให้ Route Switch ไม่ส่งไป `Call Sub Workflow`  
  - Google Sheets node append แถวใหม่ (Timestamp `21/10/2568 15:38:10`, User ID `U9f2d613ee48931a4c3b9ebaec27de312`, Message `จริงๆ`, Type `text`)  
  - **บทเรียน**: หากต้องการ fan-out ไป workflow ย่อย ต้องให้ข้อความขึ้นต้น `wf:<path>` เพื่อให้ Route Switch จับ `subWorkflow`; การดู execution log จากฐานข้อมูลช่วยตรวจสอบ mapping และเวลาประมวลผลแต่ละ node ได้ละเอียด

### สูตรลัดโพสต์ Facebook Page ด้วย Python

```python
from urllib import request, parse
import ssl

message = """เริ่มวันดีๆ ด้วย “กล้วยทอดร้อนๆ” จากจ๊ะศรี 🍌☕
กรอบ หอม หวานพอดี คู่กับกาแฟคือที่สุด!
แวะมาเจอกันตอนเช้าที่ตลาดกำแพงนะคะ 🌞

#ของกินตอนเช้า #กล้วยทอดจ๊ะศรี #หอมกรอบทุกคำ"""

env = load_env('.env')  # ต้องมีฟังก์ชันอ่าน key=value คืนเป็น dict
url = f"https://graph.facebook.com/{env['GRAPH_API_VERSION']}/{env['FB_PAGE_ID']}/feed"
body = parse.urlencode({
    "message": message,
    "access_token": env["FB_PAGE_ACCESS_TOKEN"],
}).encode()

# ใช้เฉพาะเครื่องที่ยังไม่มี root CA (เช่น macOS ที่ไม่ได้ติดตั้ง cert)
context = ssl._create_unverified_context()

with request.urlopen(request.Request(url, data=body, method="POST"), context=context) as resp:
    print(resp.read().decode())
```

- **วิธีจำสั้น ๆ**
  1. โหลดค่าจำเป็นจาก `.env`: `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `GRAPH_API_VERSION`
  2. ยิง `POST https://graph.facebook.com/{version}/{page_id}/feed` โดยส่ง `message`, `access_token`
  3. ถ้าเจอปัญหา SSL บน macOS สามารถใช้ `ssl._create_unverified_context()` หรือ `curl -k` ชั่วคราว
  4. ตรวจผลลัพธ์ ถ้า response มี `"id":"<pageID>_<postID>"` แสดงว่าโพสต์สำเร็จ

- ปรับ My workflow 3 ให้แยก flow LINE/Facebook ชัดเจน (22 ต.ค. 2025, 16:30)
  - เพิ่ม node "Is Facebook" (IF) เพื่อตรวจ `source` และส่ง LINE event ไป Google Sheets (LINE) ส่วน Facebook ส่งต่อไป Google Sheets (FB) + เส้นทางตอบกลับ
  - เพิ่ม node "Google Sheets (LINE)" เขียนชีต `LINE Messages Log`/`Sheet1`
  - ปรับ "Route Switch" → "Is Sub Workflow" (If node) สำหรับแยก route `subWorkflow` และเชื่อมต่อ Call Sub Workflow / FB Action Switch เฉพาะเมื่อเป็น Facebook
  - ย้าย helper function (THAI_TONE_MARKS, stripAccents, sanitizeKeyword, includesKeyword) ไปต้น Code node เพื่อหลีกเลี่ยง hoisting error
  - ทดสอบ flow จริง: LINE message → บันทึก Sheet1; Facebook comment 4 ประเภท (ร้องทุกข์, กำลังใจ, Sticker, Negative) ผ่าน n8n สำเร็จ (reply/delete/แจ้ง LINE พร้อม log)

## อัปเดตล่าสุด (27 ต.ค. 2025)

- **Facebook Page Token**
  - ใช้ `fb_token_generator.sh` แลก short-lived → long-lived user token → page token แล้วอัปเดต `.env` (`FB_LONG_USER_ACCESS_TOKEN`, `FB_PAGE_ACCESS_TOKEN`) และ credential `facebook-เพจจ๊ะศรีกล้วยทอด`
  - ตรวจผ่าน `debug_token` แล้วว่าครบ scopes ที่จำเป็น: `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_read_engagement`, `pages_manage_metadata`, `pages_show_list`, `pages_messaging`, `business_management`
  - ตั้งค่าโหนด Facebook Graph API ทุกตัวให้ใช้ `Graph API Version = v24.0`

- **Google Sheets OAuth**
  - เพิ่ม Redirect URI ใน Google Cloud สำหรับ client เดียวกัน  
    `https://rapturously-streamlined-king.ngrok-free.dev/rest/oauth2-credential/callback`  
    `https://rapturously-streamlined-king.ngrok-free.dev/projects/jeD6fV4Q5Q6oH8GK/credentials`
  - Reconnect credential `Google Sheets account` หลังอัปเดต เพื่อแก้ error `authorization grant is invalid`

- **สถานะ Workflow 3**
  - เส้นทาง `fb_complaint`, `fb_encouragement`, `fb_negative`, `fb_sticker` ทำงานครบ (ตอบ Facebook, แจ้ง LINE, บันทึกชีต)
  - เส้นทาง `log` จะไม่แจ้ง LINE / ไม่เขียนชีต (เหมือน execution #263)
  - หากพบ 403 อีกครั้ง ให้ตรวจ scope ของ page token และ restart n8n หลังแก้ `.env`
- เพิ่ม dedupe ใน Code node ใช้ workflow static data `processedComments` ป้องกันตอบซ้ำภายในค่าเริ่มต้น 6 ชั่วโมง (กำหนดเองได้ด้วย `FB_REPLY_DEDUPE_WINDOW_MS`)
- Postprocess โหนด Facebook เก็บ log ข้อผิดพลาดล่าสุด (สูงสุด 100 รายการ) ไว้ใน `facebookErrorLog` เพื่อตรวจจับรหัส 613 ได้ง่ายขึ้น
