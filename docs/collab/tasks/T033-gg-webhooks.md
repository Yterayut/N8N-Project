# T033 — GG Data & Notify Webhooks

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** High
**Risk:** ต่ำ — เพิ่ม workflow ใหม่ ไม่แตะ workflow เดิม
**Depends on:** GG agent setup (cbba753) ✅

---

## Overview

GG scripts (`scripts/gg/gg-*.sh`) ต้องการ 2 n8n webhook endpoints:
1. `GET /webhook/gg-data?sheet=SHEET_NAME` — คืนข้อมูลจาก Google Sheets เป็น JSON array
2. `POST /webhook/gg-notify` — รับ notification จาก GG แล้วส่ง Telegram

ตอนนี้ scripts มี graceful fallback (return `[]` / log locally) แต่ไม่มีข้อมูลจริง — task นี้ทำให้ GG ทำงานได้จริง

---

## Scope

**In scope:**
- สร้าง workflow ใหม่ `gg-data-gateway` (GET webhook → Sheets read → JSON response)
- สร้าง workflow ใหม่ `gg-notify-gateway` (POST webhook → Telegram message)
- ทั้งสอง workflow require `x-api-key` header (ใช้ `OCR_SHARED_API_KEY` เดิม)

**Out of scope:**
- ไม่แก้ GG scripts (ใช้ได้อยู่แล้ว)
- ไม่แก้ workflows เดิม
- ไม่ implement GCP service account หรือ OAuth ใหม่ — ใช้ Google Sheets credential เดิมใน n8n

---

## Technical Spec

### Workflow 1: `gg-data-gateway`

**Webhook:** `GET /webhook/gg-data`
**Query param:** `sheet` (ค่าที่รองรับ: `TRAIN_CASES`, `FIELD_DIFFS`, `OCR_KM_RUNTIME_RULES`, `OCR_FEEDBACK`, `OCR_EXAMPLES`)
**Auth:** `x-api-key` header = `$env.OCR_SHARED_API_KEY`

#### Nodes:
```
Webhook (GET /webhook/gg-data)
  └─► Code (Auth + Validate sheet param)
        └─► Switch (sheet name)
              ├─► Google Sheets (Read TRAIN_CASES)
              ├─► Google Sheets (Read FIELD_DIFFS)
              ├─► Google Sheets (Read OCR_KM_RUNTIME_RULES)
              ├─► Google Sheets (Read OCR_FEEDBACK)
              └─► Google Sheets (Read OCR_EXAMPLES)
                    └─► Respond to Webhook (JSON array)
```

#### Code (Auth + Validate) logic:
```javascript
const apiKey = $input.first().json.headers['x-api-key'] || '';
const expected = $env.OCR_SHARED_API_KEY || '';
if (!apiKey || apiKey !== expected) {
  return [{ json: { error: 'unauthorized' }, statusCode: 401 }];
}

const sheet = $input.first().json.query?.sheet || '';
const allowed = ['TRAIN_CASES','FIELD_DIFFS','OCR_KM_RUNTIME_RULES','OCR_FEEDBACK','OCR_EXAMPLES'];
if (!allowed.includes(sheet)) {
  return [{ json: { error: `unknown sheet: ${sheet}`, allowed } }, { statusCode: 400 }];
}

return [{ json: { sheet, authorized: true } }];
```

#### Google Sheets nodes (ทุก tab):
- Spreadsheet ID: `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- Operation: `getAll` (Get Many Rows)
- Return format: `json` (array of objects, header row = keys)
- `continueOnFail: true` → ถ้า Sheets ล่ม return `[]`

#### Respond to Webhook:
- Return body: `{{ $json }}` (array จาก Sheets node)
- Status: 200
- Content-Type: application/json

---

### Workflow 2: `gg-notify-gateway`

**Webhook:** `POST /webhook/gg-notify`
**Auth:** `x-api-key` header = `$env.OCR_SHARED_API_KEY`
**Body:** `{ "role": "C", "message": "text", "output_file": "/path/to/file" }`

#### Nodes:
```
Webhook (POST /webhook/gg-notify)
  └─► Code (Auth + Format message)
        └─► Telegram (Send Message)
              └─► Respond to Webhook ({"ok": true})
```

#### Code (Auth + Format) logic:
```javascript
const apiKey = $input.first().json.headers['x-api-key'] || '';
const expected = $env.OCR_SHARED_API_KEY || '';
if (!apiKey || apiKey !== expected) {
  return [{ json: { error: 'unauthorized' }, statusCode: 401 }];
}

const body = $input.first().json.body || {};
const role = body.role || '?';
const message = body.message || '';
const outputFile = body.output_file || '';

const roleEmoji = {
  C: '🧠', E: '📄', G: '🔧', I: '📝', J: '✅', O: '🧹'
};
const emoji = roleEmoji[role] || '🤖';

const telegramText = `${emoji} *GG Role ${role}*\n${message}${outputFile ? `\n\`${outputFile}\`` : ''}`;

return [{ json: { telegram_text: telegramText, chat_id: $env.TELEGRAM_OCR_CHAT_ID } }];
```

#### Telegram node:
- Chat ID: `{{ $json.chat_id }}`
- Text: `{{ $json.telegram_text }}`
- Parse mode: Markdown
- `continueOnFail: true`

---

## Security Considerations

| จุด | Mitigation |
|-----|-----------|
| gg-data expose Sheets data | x-api-key auth + allowlist sheet names |
| gg-notify spam Telegram | x-api-key auth |
| message injection | ไม่มี eval — text เป็น display only |
| sheet=unknown param | allowlist validation → 400 error |

---

## Test Plan

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | gg-data auth ผิด | GET /webhook/gg-data?sheet=TRAIN_CASES (ไม่มี key) | 401 |
| T2 | gg-data sheet ไม่รู้จัก | GET ?sheet=UNKNOWN | 400 + allowed list |
| T3 | gg-data TRAIN_CASES | GET ?sheet=TRAIN_CASES + correct key | JSON array (อาจว่างถ้า sheet ว่าง) |
| T4 | gg-data FIELD_DIFFS | GET ?sheet=FIELD_DIFFS + correct key | JSON array |
| T5 | gg-notify auth ผิด | POST ไม่มี key | 401 |
| T6 | gg-notify ส่ง Telegram | POST {role:"C", message:"test"} + key | Telegram message ปรากฏ |
| T7 | GG script ดึงข้อมูลได้ | รัน `./scripts/gg/gg-curate.sh` manually | ไม่ error, log แสดง row count |

---

## Definition of Done

**Implemented:**
- [ ] `gg-data-gateway` workflow active (GET /webhook/gg-data)
- [ ] `gg-notify-gateway` workflow active (POST /webhook/gg-notify)
- [ ] webhookId UUID บนทั้งสอง webhook nodes (PATTERN-008)

**Verified:**
- [ ] T1-T6 ผ่านทั้งหมด
- [ ] `./scripts/gg/gg-curate.sh` รันแล้วเห็น log ว่าดึงข้อมูลได้ (ไม่ใช่ error fallback)

**Docs:**
- [ ] HANDOFF.md workflow IDs อัปเดต
- [ ] `docs/collab/GG.md` Data Sources section อัปเดต webhook IDs

---

## Discussion
*(Codex pre-execution questions ใส่ที่นี่)*
