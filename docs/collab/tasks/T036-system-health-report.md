# T036 — System Health Report (Daily + On-demand + Error Spike + Weekly Trend)

**Author:** Claude Code (CC)
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** High
**Risk:** ต่ำ — สร้าง workflow ใหม่ทั้งหมด ไม่แก้ workflow เดิม

---

## Overview

สร้าง 3 workflows ใหม่สำหรับ monitoring ระบบ:

| Workflow | หน้าที่ | Trigger |
|----------|--------|---------|
| `system-daily-health-report` | รายงาน 07:30 BKK ทุกวัน + Weekly ทุกจันทร์ | Cron 00:30 UTC |
| `system-health-ondemand` | ยุทพิมพ์ `/health` ใน Telegram → ตอบทันที | Telegram Trigger |
| `system-error-monitor` | เฝ้าดู error spike ทุก 30 นาที → alert ทันที | Cron ทุก 30 นาที |

---

## ข้อมูลสำหรับ Implementation

```
N8N_BASE:           http://localhost:5678
DB_PATH:            /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite
TELEGRAM_CRED_ID:   rauiF9qBRW8iVrsU   (Telegram account OCM-Chatbot)
CHAT_ID_ENV:        TELEGRAM_OCR_CHAT_ID  (อ่านจาก $env.TELEGRAM_OCR_CHAT_ID)
WEBHOOK_URL:        https://rapturously-streamlined-king.ngrok-free.dev
API_KEY_ENV:        OCR_SHARED_API_KEY
N8N_USER:           อ่านจาก $env.N8N_BASIC_AUTH_USER
N8N_PASS:           อ่านจาก $env.N8N_BASIC_AUTH_PASSWORD
```

### Expected Active Workflows (13 รายการ)

```javascript
const EXPECTED_ACTIVE = [
  { id: 'up1n75qEhbsXswii', name: 'ocr-invoice-processor' },
  { id: 'NkKd02QyzLRcpIJM', name: 'ocr-km-suggest' },
  { id: 'KW0QRXxRh9MjdPaY', name: 'ocr-training' },
  { id: 'LzYmwkdRfOxbCrwB', name: 'ocr-examples-api' },
  { id: '8jBkNiydlIfAGyZ3', name: 'ocr-learning-path1' },
  { id: 'yCqvdl3vrHGgiBMt', name: 'ocr-kpi-report' },
  { id: 'sSrKcFxY1Wxk5HGH', name: 'OCR Daily Summary' },
  { id: 'XtaSg9pLDuPERtI8', name: 'gg-data-gateway' },
  { id: 'YZTJwkh25isaLKHo', name: 'gg-notify-gateway' },
  { id: 'ztJ8oCBHREUPPry6', name: 'ocr-feedback-receiver' },
  { id: 'jmJHPPj0OM5LcZ0n', name: 'ocr-km-logger' },
  { id: 'dFzVzAFjdRJHbQqe', name: 'ocr-rules-reader' },
  { id: 'BlCrCNITw9ThtfOx', name: 'gg-health-monitor' },
];
```

---

## Workflow 1: `system-daily-health-report`

### Nodes (ลำดับ)

```
Schedule Trigger
  → HTTP: Get Workflows
  → HTTP: GG Health
  → HTTP: GG Data (OCR_EXAMPLES)
  → HTTP: GG Data (OCR_KM_RUNTIME_RULES)
  → Execute Command: SQLite 24h stats
  → IF: Is Monday?
    → YES → Execute Command: SQLite 7-day trend
    → NO  → (skip)
  → Code: Build Report
  → Telegram: Send
```

### Node Specs

**Schedule Trigger**
- Cron: `30 0 * * *` (UTC) = 07:30 BKK

**HTTP: Get Workflows**
- URL: `http://localhost:5678/rest/workflows`
- Auth: Basic Auth (`N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`)
- continueOnFail: true

**HTTP: GG Health**
- URL: `http://localhost:5678/webhook/gg-health`
- Header: `x-api-key: {{$env.OCR_SHARED_API_KEY}}`
- continueOnFail: true

**HTTP: GG Data (OCR_EXAMPLES)**
- URL: `http://localhost:5678/webhook/gg-data?sheet=OCR_EXAMPLES`
- Header: `x-api-key: {{$env.OCR_SHARED_API_KEY}}`
- continueOnFail: true

**HTTP: GG Data (OCR_KM_RUNTIME_RULES)**
- URL: `http://localhost:5678/webhook/gg-data?sheet=OCR_KM_RUNTIME_RULES`
- Header: `x-api-key: {{$env.OCR_SHARED_API_KEY}}`
- continueOnFail: true

**Execute Command: SQLite 24h stats**
```bash
sqlite3 /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite \
"SELECT status, COUNT(*) as cnt, GROUP_CONCAT(DISTINCT workflowId) as wf_ids FROM execution_entity WHERE startedAt > datetime('now','-24 hours') GROUP BY status;"
```
- continueOnFail: true

**IF: Is Monday?**
- Condition: `{{ new Date().getUTCDay() === 1 }}` = true

**Execute Command: SQLite 7-day trend** (Monday only)
```bash
sqlite3 /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite \
"SELECT date(startedAt) as day, status, COUNT(*) as cnt FROM execution_entity WHERE startedAt > datetime('now','-7 days') GROUP BY day, status ORDER BY day;"
```
- continueOnFail: true

**Code: Build Report**

Logic:
1. รับ output จาก nodes ก่อนหน้าทั้งหมด (ใช้ `$('NodeName').first().json`)
2. ตรวจ workflows active vs expected
3. ตรวจ endpoint responses
4. parse SQLite output
5. สร้าง message

Message format (all OK):
```
🏥 Daily Health — 07:30 BKK
━━━━━━━━━━━━━━━━━━━━
🟢 ระบบพร้อม — ทุกอย่างปกติ

⚙️ Workflows: 13/13 active
📡 Endpoints:
  ✅ GG Health
  ✅ GG Data (OCR_EXAMPLES: 6 rows)
  ✅ GG Data (Rules: 3 active)

📊 24h Execution:
  ✅ success: 48 / error: 0

📋 Flag: RUNTIME_RULES=true

━━━━━━━━━━━━━━━━━━━━
🟢 READY — พร้อมรับงาน
```

Message format (issues):
```
🏥 Daily Health — 07:30 BKK
━━━━━━━━━━━━━━━━━━━━
🔴 พบปัญหา — ต้องตรวจสอบ

⚙️ Workflows: 11/13 active
  ❌ MISSING: ocr-km-logger
             gg-health-monitor
📡 Endpoints:
  ❌ GG Health → error
  ✅ GG Data (OCR_EXAMPLES: 6 rows)
  ✅ GG Data (Rules: 3 active)

📊 24h Execution:
  ✅ success: 40
  ❌ error: 8
     • up1n75qEhbsXswii ×5
     • YZTJwkh25isaLKHo ×3

📋 Flag: RUNTIME_RULES=true

━━━━━━━━━━━━━━━━━━━━
🔴 ISSUES FOUND
```

เพิ่ม Weekly section (วันจันทร์):
```
📈 Weekly Trend (7 วัน):
  Mon: ✅48 / Tue: ✅52 / ...
  Total: 320 exec | Error rate: 2.1%
```

**Telegram: Send**
- Credential: `rauiF9qBRW8iVrsU`
- Chat ID: `{{ $env.TELEGRAM_OCR_CHAT_ID }}`
- Text: output จาก Code node
- Parse Mode: Markdown (ถ้า format มี * หรือ `)

---

## Workflow 2: `system-health-ondemand` (Feature A)

### Nodes

```
Telegram Trigger
  → IF: text contains "/health"
    → YES → (health check nodes — clone logic จาก Workflow 1)
           → Code: Build Report (same as above แต่ header = "🏥 On-demand Health")
           → Telegram: Reply to sender
    → NO  → (ignore)
```

### Node Specs

**Telegram Trigger**
- Credential: `rauiF9qBRW8iVrsU`
- Updates: `message` type

**IF: text contains "/health"**
- Condition: `{{ $json.message?.text?.includes('/health') }}` = true

**Health check nodes** — ใช้ HTTP + Execute Command เดิม (copy จาก Workflow 1)

**Telegram: Reply**
- Chat ID: `{{ $('Telegram Trigger').first().json.message.chat.id }}`
- Credential: `rauiF9qBRW8iVrsU`
- Text: report message

---

## Workflow 3: `system-error-monitor` (Feature B)

### Nodes

```
Schedule Trigger (ทุก 30 นาที)
  → Execute Command: SQLite error count (1h)
  → IF: error_count >= 5
    → YES → Execute Command: SQLite error details
           → Code: Build Alert
           → Telegram: Send Alert
    → NO  → (stop — no spam)
```

### Node Specs

**Schedule Trigger**
- Cron: `*/30 * * * *`

**Execute Command: SQLite error count (1h)**
```bash
sqlite3 /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite \
"SELECT COUNT(*) FROM execution_entity WHERE status='error' AND startedAt > datetime('now','-1 hours');"
```

**IF: error_count >= 5**
- Condition: `{{ parseInt($json.stdout) >= 5 }}`

**Execute Command: SQLite error details**
```bash
sqlite3 /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite \
"SELECT workflowId, COUNT(*) as cnt FROM execution_entity WHERE status='error' AND startedAt > datetime('now','-1 hours') GROUP BY workflowId ORDER BY cnt DESC LIMIT 5;"
```

**Code: Build Alert**
```
⚠️ Error Spike Alert!
━━━━━━━━━━━━━━━━━━━━
🔴 พบ errors สูงผิดปกติใน 1 ชั่วโมงที่ผ่านมา

❌ Errors: {count}
  • {workflowId} ×{cnt}
  • ...

⏰ {datetime}
```

**Telegram: Send Alert**
- Chat ID: `{{ $env.TELEGRAM_OCR_CHAT_ID }}`
- Credential: `rauiF9qBRW8iVrsU`

### Cooldown (ป้องกัน spam)

ใช้ n8n **Workflow Static Data** เก็บ `last_alert_at`:
```javascript
const staticData = $getWorkflowStaticData('global');
const lastAlert = staticData.last_alert_at || 0;
const now = Date.now();
const TWO_HOURS = 2 * 60 * 60 * 1000;

if (now - lastAlert < TWO_HOURS) {
  // skip — cooldown
  return [];
}
staticData.last_alert_at = now;
// proceed to alert
```

ใส่ logic นี้ใน Code node ก่อน Telegram node

---

## Test Plan

| # | Test | Expected |
|---|------|----------|
| T1 | Trigger Workflow 1 manual | ได้ Telegram message ใน 30 วินาที |
| T2 | Message format (all OK) | เห็น 🟢, workflows 13/13, endpoints ✅ |
| T3 | Feature A: ยุทพิมพ์ `/health` | Bot ตอบ report ใน 10 วินาที |
| T4 | Feature B: manual trigger ด้วย error count ปลอม | ได้ alert Telegram |
| T5 | Feature B: cooldown | ส่ง 2 ครั้งภายใน 2h → alert แค่ครั้งแรก |
| T6 | วันจันทร์ section | ถ้าวันจันทร์ → message มี 📈 Weekly Trend |

**วิธีทดสอบ T4 (simulate error spike):**
```bash
# เพิ่ม mock error records ชั่วคราว แล้วลบออกหลัง test
# หรือ ลด threshold เป็น >= 1 ก่อน test แล้วเปลี่ยนกลับ
```

---

## Definition of Done

**Implemented:**
- [ ] `system-daily-health-report` active, cron 00:30 UTC
- [ ] `system-health-ondemand` active, Telegram Trigger set up
- [ ] `system-error-monitor` active, cron */30 */30

**Verified:**
- [ ] T1 ผ่าน (manual trigger → Telegram received)
- [ ] T2 ผ่าน (message format ถูกต้อง)
- [ ] T3 ผ่าน (/health → bot ตอบ)
- [ ] T4 ผ่าน (error spike → alert)
- [ ] T5 ผ่าน (cooldown ทำงาน)

**Docs:**
- [ ] HANDOFF.md อัปเดต T036 complete + workflow IDs ใหม่

---

## Security Considerations

- ทุก HTTP calls ไป `localhost:5678` เท่านั้น — ไม่ expose ออก internet
- Telegram Trigger รับเฉพาะ message type — ไม่ process attachment/unknown types
- SQLite query ใช้ sqlite3 CLI read-only — ไม่มี write operations
- Error details ไม่รวม sensitive data (ไม่ log payload)

---

## Discussion
*(Codex pre-execution questions ใส่ที่นี่)*
