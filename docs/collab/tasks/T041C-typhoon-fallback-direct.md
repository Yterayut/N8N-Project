# T041C — Typhoon OCR Fallback — Direct Path (`/ocr-dev`)

**Author:** Claude Code (CC)
**Date:** 2026-02-27
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง (patch live workflow main OCR — direct path)
**Depends on:** T041B ✅ (Typhoon fallback queue path working)

---

## Overview

T041B ปิด SPOF บน **queue path** แล้ว
T041C = ปิด SPOF บน **direct path** (`POST /webhook/ocr-dev`)

ตอนนี้ถ้า Gemini ล้มบน direct path:
- `If2` TRUE → `Respond to Webhook (error)` → user ได้ HTTP 500 ทันที
- **ไม่มี fallback ใดๆ**

---

## Direct Path Structure (ก่อน T041C)

```
POST /webhook/ocr-dev
      ↓
Webhook_OCR_Test5
      ↓
... (few-shot, build request) ...
      ↓
HTTP GenerateContent3        ← Gemini call (direct path)
      ↓
If2
  FALSE (Gemini OK) → Code in JavaScript9 → Normalize → ... → Respond to Webhook6
  TRUE  (Gemini fail) → Respond to Webhook (error) ← SPOF ตรงนี้
```

---

## Target State (หลัง T041C)

```
If2
  FALSE (Gemini OK) → Code in JavaScript9 [input 0] (ไม่เปลี่ยน)
  TRUE  (Gemini fail) → Code (Prepare Typhoon Request - Direct) [NEW]
                              ↓ binary: files0 จาก Webhook_OCR_Test5
                        HTTP (Typhoon OCR - Direct) [NEW]
                              ↓ /v1/ocr multipart
                        Code (Reshape Typhoon Response - Direct) [NEW]
                              ↓ Gemini-compatible format
                        IF (Typhoon OK? - Direct) [NEW]
                           TRUE  → Code in JavaScript9 [input 0]
                           FALSE → Respond to Webhook (error)
```

---

## Scope

**ADD** 4 new nodes (แทรกระหว่าง `If2 TRUE` และ `Respond to Webhook (error)`):
- `Code (Prepare Typhoon Request - Direct)`
- `HTTP (Typhoon OCR - Direct)`
- `Code (Reshape Typhoon Response - Direct)`
- `IF (Typhoon OK? - Direct)`

**CHANGE connections:**
| From | To | Action |
|------|----|--------|
| `If2 [0]` → `Respond to Webhook (error)` | — | ❌ REMOVE |
| `If2 [0]` → `Code (Prepare Typhoon Request - Direct)` | NEW | ✅ ADD |
| (chain) | `HTTP (Typhoon OCR - Direct)` | ✅ ADD |
| (chain) | `Code (Reshape Typhoon Response - Direct)` | ✅ ADD |
| (chain) | `IF (Typhoon OK? - Direct)` | ✅ ADD |
| `IF (Typhoon OK? - Direct) [TRUE]` → `Code in JavaScript9` [input 0] | NEW | ✅ ADD |
| `IF (Typhoon OK? - Direct) [FALSE]` → `Respond to Webhook (error)` [input 0] | NEW | ✅ ADD |

**KEEP ไม่เปลี่ยน:**
- `If2` node และ condition
- `Code in JavaScript9` และทุก node ถัดจากนั้น
- `Respond to Webhook (error)` node

**Out of scope:**
- Re-ask path (`HTTP GenerateContent (Re-ask)`) — ยังใช้ Gemini เท่านั้น
- Queue path — T041B cover แล้ว

---

## Anchor Node IDs (ห้ามเปลี่ยน)

| Node | ID |
|------|----|
| `If2` | `411d7808-73f6-45ab-b8cc-c9326768f1ad` |
| `Code in JavaScript9` | `a56aaa14-3b4e-4316-bd03-fc7a1d37c970` |
| `Respond to Webhook (error)` | `de49b642-a6c4-4d3d-8d5f-82be8916d5c7` |
| `Webhook_OCR_Test5` | `25d2ea8a-2b14-467c-8a94-111cc9e42d27` |

---

## Technical Spec

### Node 1: `Code (Prepare Typhoon Request - Direct)` [NEW]

**ต่างจาก queue path:** binary อยู่ที่ `Webhook_OCR_Test5.binary.files0` (ไม่ใช่ `Download file.binary.data`)

```javascript
// อ่าน binary จาก Webhook_OCR_Test5 (direct path)
const webhookItem = $('Webhook_OCR_Test5').first();
// binary key อาจเป็น files0 หรือ files — ลอง files0 ก่อน
const binaryData = webhookItem?.binary?.files0 || webhookItem?.binary?.files;

if (!binaryData) {
  return [{
    json: {
      typhoon_error: 'binary_not_found',
      fallback_status: 'failed',
      fallback_used: true,
      fallback_model: 'typhoon-ocr-preview'
    }
  }];
}

return [{
  json: {
    _typhoon_api_key: $env.TYPHOON_API_KEY || '',
    _mime_type: binaryData.mimeType || 'application/pdf'
  },
  binary: {
    data: binaryData
  }
}];
```

**Connections:**
- input: `If2` output 0 (TRUE = Gemini error)
- output: `HTTP (Typhoon OCR - Direct)` input 0

---

### Node 2: `HTTP (Typhoon OCR - Direct)` [NEW]

**เหมือน queue path ทุกอย่าง** (copy pattern จาก T041B):

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.opentyphoon.ai/v1/ocr",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "=Bearer {{ $json._typhoon_api_key }}" }
      ]
    },
    "sendBody": true,
    "contentType": "multipart-form-data",
    "bodyParameters": {
      "parameters": [
        { "parameterType": "formBinaryData", "name": "file", "inputDataFieldName": "data" }
      ]
    },
    "options": { "timeout": 120000 }
  },
  "continueOnFail": true,
  "onError": "continueRegularOutput"
}
```

**Connections:**
- input: `Code (Prepare Typhoon Request - Direct)` output 0
- output: `Code (Reshape Typhoon Response - Direct)` input 0

---

### Node 3: `Code (Reshape Typhoon Response - Direct)` [NEW]

**เหมือน queue path** — copy code จาก `Code (Reshape Typhoon Response)` (T041B) ทั้งหมด
Output format เหมือนกัน: `{candidates:[{content:{parts:[{text: JSON.stringify({bills})}]}}], fallback_used, fallback_status, ...}`

`Code in JavaScript9` อ่าน: `$json.candidates[0].content.parts[0].text` → ใช้ format เดิมได้เลย ✅

**หมายเหตุ:** ไม่ต้องเพิ่ม `_typhoon_natural_text` debug field ก็ได้ (optional)

**Connections:**
- input: `HTTP (Typhoon OCR - Direct)` output 0
- output: `IF (Typhoon OK? - Direct)` input 0

---

### Node 4: `IF (Typhoon OK? - Direct)` [NEW]

**Condition:**
```javascript
{{ $json.fallback_status === 'success' }}
```

- TRUE (Typhoon success) → `Code in JavaScript9` input 0
- FALSE (Typhoon fail) → `Respond to Webhook (error)` input 0

**หมายเหตุเรื่อง `Respond to Webhook (error)` input:**
Node นี้รับ `$json` เพื่อสร้าง error response:
```javascript
// Respond to Webhook (error) อ่าน:
message: ($json.error?.message || "Failed to process the document. Please try again.")
responseCode: Number($json.error?.status || 500)
```
Reshape node ส่ง `{error: 'Typhoon no response'}` (string) เมื่อ fail → `$json.error?.message` = undefined → fallback message ถูกใช้ ✅

**Connections:**
- input: `Code (Reshape Typhoon Response - Direct)` output 0
- output 0 (TRUE): `Code in JavaScript9` input 0
- output 1 (FALSE): `Respond to Webhook (error)` input 0

---

## Key Insight: `Code in JavaScript9` รับ 2 inputs ที่ input 0

```
If2 [FALSE]                → Code in JavaScript9 [input 0]  (เดิม)
IF (Typhoon OK?) [TRUE]    → Code in JavaScript9 [input 0]  (ใหม่)
```

เหมือนกับที่ Codex พบใน T041B — ทั้ง 2 branches วิ่ง mutually exclusive ทำให้ input 0 ไม่ conflict ✅

`Code in JavaScript9` อ่าน:
- `$json` → Gemini หรือ Typhoon-reshaped response (ทั้งคู่ใช้ format เดียวกัน)
- `$('Webhook_OCR_Test5').first()` → node reference ยังใช้งานได้ ✅
- `$('Code in JavaScript5').first()` → node reference ยังใช้งานได้ ✅

---

## Environment Variables

`TYPHOON_API_KEY` — CC เพิ่มใน `.env` แล้วตั้งแต่ T041B — ไม่ต้องทำเพิ่ม

---

## Security Considerations

| จุด | Mitigation |
|-----|-----------|
| ไม่มี webhook ใหม่ | ✅ ใช้ `/ocr-dev` เดิม |
| TYPHOON_API_KEY | ✅ ผ่าน `$env` ไม่ hardcode |
| `continueOnFail: true` บน HTTP node | ✅ ระบุใน spec |
| Invoice PDF ส่งไป Typhoon | Fallback only — เมื่อ Gemini fail แล้ว |

---

## Discussion

*(Codex กรอก section นี้ก่อน implement ถ้ามี concern)*

---

## Test Plan

### Setup: Force Gemini to fail (direct path)
```bash
# PATCH If2 condition เพื่อบังคับ TRUE เสมอ (หรือทดสอบด้วย invalid Gemini URL)
# วิธีง่ายกว่า: patch HTTP GenerateContent3 URL เป็น invalid
```

### Test Cases

| # | Test | Expected |
|---|------|---------|
| T1 | Typhoon fallback succeed (direct path) | Gemini forced fail + caltex.pdf → `fallback_used=true`, `fallback_status=success`, bills มีค่า |
| T2 | Gemini OK → Typhoon ไม่ถูกเรียก | Normal /ocr-dev request → `fallback_used=false` (หรือ field ไม่มี = ปกติ) |
| T3 | ทั้งคู่ fail | Gemini fail + bad TYPHOON_API_KEY → HTTP 500 graceful จาก `Respond to Webhook (error)` |
| T4 | verify_nowThai_sync | — | `./scripts/verify_nowThai_sync.sh` ✅ |

**DoD minimum: T1 + T2 ผ่าน + verify_nowThai ✅**

---

## Definition of Done

> Codex: อย่า mark Done ถ้ายังไม่ครบทุก checkbox

**Implemented:**
- [ ] Connection `If2 [0] → Respond to Webhook (error)` ถูก REMOVE แล้ว
- [ ] 4 Typhoon nodes เพิ่มแล้ว: Prepare / HTTP / Reshape / IF(Typhoon OK?)
- [ ] `IF (Typhoon OK?) [TRUE]` → `Code in JavaScript9` [input 0] ✅
- [ ] `IF (Typhoon OK?) [FALSE]` → `Respond to Webhook (error)` [input 0] ✅

**Verified from system:**
- [ ] T1 Exec ID: `________` — Typhoon fallback, `fallback_used=true`, bills มีค่า
- [ ] T2 Exec ID: `________` — Gemini OK, normal response
- [ ] `verify_nowThai_sync.sh` ✅

**E2E Passed:**
- [ ] Exec ID: `________` — direct path Typhoon fallback ครบ

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Closing Template

*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
