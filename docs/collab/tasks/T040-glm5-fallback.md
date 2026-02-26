# T040 — GLM5 (Zhipu AI) Fallback OCR เมื่อ Gemini ล่ม

**Author:** Claude Code (CC)
**Date:** 2026-02-27
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง (patch live workflow main OCR)
**Depends on:** ไม่มี

---

## Overview

SPOF-1: Main OCR workflow (`up1n75qEhbsXswii`) พึ่ง Gemini 100% — ถ้า Google Vision API ล่มหรือ quota หมด OCR ทั้งระบบหยุดทำงานทันที ไม่มี fallback ใดๆ

งานนี้เพิ่ม **GLM5 (Zhipu AI `glm-4v`)** เป็น backup OCR — ถ้า Gemini ล้มเหลว ระบบ route อัตโนมัติไปใช้ GLM5 แทน โดยไม่กระทบ response format ปลายทาง

---

## Scope

### Scope Lock — Queue Path Only (per Codex discuss 2026-02-27)

ใน workflow `up1n75qEhbsXswii` มี **2 execution paths** ที่ใช้ Gemini:

| Path | Entry | Gemini Call | Parse Node |
|------|-------|-------------|------------|
| **Queue path** (async jobs) | `Download file` → `HTTP (Upload to Gemini)` | `HTTP (GenerateContent)` | `Code (Parse Result)` |
| **Direct path** (`/ocr-dev`) | `HTTP Upload File5` | (separate Gemini node) | `Code in JavaScript9` |

**T040 scope = Queue path only** — patch queue path ก่อน
Direct path จะ cover ใน T040B (follow-up) หลัง T040 stable

**In scope:**
- เพิ่ม `IF (Gemini OK?)` node ระหว่าง `HTTP (GenerateContent)` และ `Code (Parse Result)` **(queue path)**
- เพิ่ม `Code (Prepare GLM5 Request)` — อ่าน binary จาก **`Download file`** node (field: `data`)
- เพิ่ม `HTTP (GLM5 GenerateContent)` — call Zhipu AI API
- เพิ่ม `Code (Reshape GLM5 Response)` — reshape เป็น Gemini-like structure
- ต่อ Reshape → `Code (Parse Result)` (multi-input path 1)
- เพิ่ม `fallback_used`, `fallback_model`, `model_version` ใน output
- อัปเดต `.env.example` (CC ทำแล้ว)
- รัน `verify_nowThai_sync.sh`

**Out of scope (explicit):**
- Direct path (`/ocr-dev`) — T040B
- เปลี่ยน `Code (Parse Result)` logic หลัก — แค่เพิ่ม fallback tracking fields
- PDF→Image conversion สำหรับ GLM5 (ถ้า GLM5 ไม่รองรับ PDF → graceful fail)
- Hardcode API key ใดๆ — ห้ามเด็ดขาด ใช้ `$env.GLM5_API_KEY` เสมอ
- สร้าง workflow ใหม่ — patch `up1n75qEhbsXswii` เท่านั้น

---

## Technical Spec

### Current Gemini Flow (workflow `up1n75qEhbsXswii`)

```
Code (Build Request)1
       ↓
HTTP (Upload to Gemini)           → fileUri
       ↓
Code (Build Request)1 [merge]     → body with fileUri + prompt
       ↓
HTTP (GenerateContent)            ← onError: continueRegularOutput อยู่แล้ว
       ↓
[ตัด direct link เดิม]
       ↓
IF (Gemini OK?)                   ← NEW
   TRUE → Code (Parse Result)     ← path 0 (Gemini OK)
   FALSE → Code (Prepare GLM5 Request) ← path 1 (fallback)
```

### GLM5 API

- Provider: Zhipu AI — `open.bigmodel.cn`
- Endpoint: `POST https://open.bigmodel.cn/api/paas/v4/chat/completions`
- Auth: `Authorization: Bearer {GLM5_API_KEY}` — key ใน `$env.GLM5_API_KEY`
- Format: OpenAI-compatible (messages array)
- Model: `$env.GLM5_MODEL` (default `glm-4v`)
- Input: image_url type with `data:<mime>;base64,<data>`
- Response: `choices[0].message.content` (string → JSON bills)

### Node 1: `IF (Gemini OK?)`

ตำแหน่ง: ระหว่าง `HTTP (GenerateContent)` และ `Code (Parse Result)`

```javascript
// Condition expression (true = Gemini OK)
{{ !!$json?.candidates?.[0]?.content?.parts?.[0]?.text }}
```

Connections:
- input: `HTTP (GenerateContent)` output 0
- output 0 (TRUE): `Code (Parse Result)` input 0
- output 1 (FALSE): `Code (Prepare GLM5 Request)` input 0

### Node 2: `Code (Prepare GLM5 Request)` [NEW]

**Binary node confirmed by Codex discuss (2026-02-27):**
- Node name: **`Download file`**
- Binary field: **`data`** (ไม่ใช่ `files0`)

```javascript
// อ่าน binary จาก 'Download file' node (queue path)
const binaryItem = $('Download file').first();
const binaryData = binaryItem?.binary?.data;

if (!binaryData) {
  return [{
    json: {
      glm5_error: 'binary_not_found',
      fallback_status: 'failed',
      fallback_used: true,
      fallback_model: $env.GLM5_MODEL || 'glm-4v'
    }
  }];
}

const mimeType = binaryData.mimeType || 'image/jpeg';
const base64Data = binaryData.data; // n8n stores as base64

// ดึง prompt จาก Code (Build Request)1 (upstream node บน queue path)
let promptText = null;
try {
  // Code (Build Request)1 สร้าง Gemini request body — ดึง text part ออก
  const geminiBody = $('Code (Build Request)1').first().json;
  promptText = geminiBody?.contents?.[1]?.parts?.[0]?.text
            || geminiBody?.contents?.[0]?.parts?.[0]?.text;
} catch(e) {}

if (!promptText) {
  // Fallback prompt — ใช้เมื่อหา upstream ไม่ได้
  promptText = `คุณคือระบบ OCR สำหรับ invoice/receipt ไทย วิเคราะห์รูปภาพและสกัด field ต่อไปนี้เป็น JSON: vendor_name, vendor_tax_id (13 หลัก), invoice_number, invoice_date (YYYY-MM-DD), total_amount, vat_amount ตอบเป็น JSON เท่านั้น`;
}

const requestBody = {
  model: $env.GLM5_MODEL || 'glm-4v',
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`
        }
      },
      {
        type: 'text',
        text: promptText
      }
    ]
  }],
  temperature: 0.1
};

return [{
  json: {
    body: requestBody,
    _mime_type: mimeType
  }
}];
```

### Node 3: `HTTP (GLM5 GenerateContent)` [NEW]

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "=Bearer {{ $env.GLM5_API_KEY }}" },
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "contentType": "raw",
    "body": "={{ JSON.stringify($json.body) }}"
  },
  "continueOnFail": true,
  "onError": "continueRegularOutput"
}
```

**หมายเหตุ:** ใช้ `$env.GLM5_API_KEY` เสมอ — ห้าม hardcode API key ไม่ว่าจะชั่วคราว

### Node 4: `Code (Reshape GLM5 Response)` [NEW]

Re-format OpenAI response → Gemini-like format เพื่อ reuse `Code (Parse Result)` เดิม

```javascript
const glmResponse = $json;
const choices = glmResponse?.choices;

// ถ้า GLM5 ล้มเหลว → return error structure ที่ Parse Result handle ได้
if (!choices?.[0]?.message?.content) {
  return [{
    json: {
      candidates: null,
      fallback_used: true,
      fallback_model: $env.GLM5_MODEL || 'glm-4v',
      fallback_status: 'failed',
      error: glmResponse?.error?.message || glmResponse?.error || 'GLM5 no response'
    }
  }];
}

const content = choices[0].message.content;
const usage = glmResponse.usage || {};

// Reshape เป็น Gemini-like structure
return [{
  json: {
    candidates: [{
      content: {
        parts: [{ text: content }]
      }
    }],
    usageMetadata: {
      promptTokenCount: usage.prompt_tokens || 0,
      candidatesTokenCount: usage.completion_tokens || 0,
      totalTokenCount: usage.total_tokens || 0
    },
    fallback_used: true,
    fallback_model: $env.GLM5_MODEL || 'glm-4v',
    fallback_status: 'success'
  }
}];
```

Connections:
- `Code (Prepare GLM5 Request)` → `HTTP (GLM5 GenerateContent)` input 0
- `HTTP (GLM5 GenerateContent)` → `Code (Reshape GLM5 Response)` input 0
- `Code (Reshape GLM5 Response)` → `Code (Parse Result)` input **1** (PATTERN-001: multi-input)

### Node 5: Modify `Code (Parse Result)` — เพิ่ม fallback tracking

ใน output object เพิ่ม:
```javascript
// เพิ่มใน return object ของ Code (Parse Result)
// ใกล้กับ field อื่นๆ ที่ return ออกไป
fallback_used: $json.fallback_used || false,
fallback_model: $json.fallback_model || null,
model_version: $json.fallback_used
  ? ($json.fallback_model || 'glm-4v')
  : 'gemini-2.5-flash'
```

**PATTERN-001 WARNING:** `Code (Parse Result)` รับ input จาก 2 paths → ใช้ `$('IF (Gemini OK?)').first().json` หรือ `$('Code (Reshape GLM5 Response)').first().json` แทน `$json` ตรงๆ เมื่อ reference nodes ก่อนหน้า

---

## Connection Changes Summary

| From | To | Notes |
|------|----|-------|
| ❌ `HTTP (GenerateContent)` → `Code (Parse Result)` | — | ตัดออก |
| ✅ `HTTP (GenerateContent)` → `IF (Gemini OK?)` | NEW | input 0 |
| ✅ `IF (Gemini OK?)` TRUE → `Code (Parse Result)` | NEW | path 0 |
| ✅ `IF (Gemini OK?)` FALSE → `Code (Prepare GLM5 Request)` | NEW | path 1 |
| ✅ `Code (Prepare GLM5 Request)` → `HTTP (GLM5 GenerateContent)` | NEW | |
| ✅ `HTTP (GLM5 GenerateContent)` → `Code (Reshape GLM5 Response)` | NEW | |
| ✅ `Code (Reshape GLM5 Response)` → `Code (Parse Result)` | NEW | input 1 |

---

## Security Considerations

1. **ไม่มี webhook ใหม่** — ไม่เพิ่มจุดรับ input
2. **GLM5_API_KEY ใน `.env`** — อ่านผ่าน `$env.GLM5_API_KEY` ไม่ hardcode
3. **Binary data (base64)** อยู่ใน request ไป Zhipu AI — ข้อมูล invoice จะถูกส่งไป 3rd party เมื่อ Gemini ล้ม (ยอมรับ tradeoff นี้ — ดีกว่า OCR ล้มทั้งหมด)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| GLM5_API_KEY ใน request header | ใช้ `$env` ไม่ hardcode |
| Invoice data ไป Zhipu AI | Fallback only — เกิดเมื่อ Gemini ล้มแล้ว |
| GLM5 ล้มทำให้ workflow crash | `continueOnFail: true` + graceful error structure |

**Required security controls:**
- [x] ไม่มี webhook ใหม่ → ไม่ต้อง auth check
- [x] `continueOnFail: true` บน `HTTP (GLM5 GenerateContent)`
- [x] Error response ไม่ expose internal API key
- [ ] ตรวจว่า `fallback_status` ไม่ expose เนื้อหา invoice ใน error log

---

## Discussion

### Codex Discuss — 2026-02-27

1. **Binary node confirmed:** `Download file` (field: `data`) ✅ — ไม่ใช่ candidate list
2. **Multi-input OK:** `Code (Parse Result)` ใช้ `$input.item.json` ไม่ใช่ `$json` ตรงๆ — PATTERN-001 ไม่กระทบ; แต่ละ branch วิ่งทีละอัน ไม่ต้อง explicit `$('...').first()`
3. **Scope concern → ล็อก scope แล้ว:** T040 = queue path เท่านั้น, T040B = direct path; spec อัปเดตแล้ว
4. **No hardcode API key:** ลบ option นั้นออกจาก spec แล้ว

### CC Response

- Scope ล็อกเป็น **queue path only** ✅
- Binary reference แก้เป็น explicit `Download file` / field `data` ✅
- Hardcode option ลบแล้ว ✅
- เห็นด้วยกับ concern เรื่อง `$input.item.json` — Codex ไม่ต้องแก้ `Code (Parse Result)` หาก logic นั้นทำงานได้กับ multi-input อยู่แล้ว แค่เพิ่ม `fallback_*` fields ใน return

**Proceed to implement ✅**

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|---------|
| T1 | Gemini ทำงานปกติ | ส่ง PDF จริงผ่าน `/webhook/ocr-dev` | `fallback_used=false`, GLM5 ไม่ถูกเรียก |
| T2 | Gemini fail → GLM5 succeed | เปลี่ยน `GEMINI_API_KEY` เป็น invalid ชั่วคราว แล้วส่ง image | `fallback_used=true`, `model_version=glm-4v`, bills ≥ 1 |
| T4 | Image file via GLM5 | force fallback + ไฟล์ .jpg | bills array มีค่า |

### Failure / Edge Cases
| # | Test | Expected |
|---|------|---------|
| T3 | ทั้ง Gemini + GLM5 fail | response 200 (graceful), `status=error`, `fallback_status=failed` |
| T5 | PDF via GLM5 | ถ้า GLM5 รองรับ → bills; ถ้าไม่ → `fallback_status=pdf_not_supported`, graceful |

---

## Definition of Done

> Codex: อย่า mark Done ถ้ายังไม่ครบทุก checkbox

**Implemented:**
- [ ] `IF (Gemini OK?)` node เพิ่มแล้ว — แยก TRUE/FALSE path ถูกต้อง
- [ ] `Code (Prepare GLM5 Request)` เพิ่มแล้ว — binary อ่านได้จาก upstream
- [ ] `HTTP (GLM5 GenerateContent)` เพิ่มแล้ว — `continueOnFail: true`
- [ ] `Code (Reshape GLM5 Response)` เพิ่มแล้ว — output Gemini-like structure
- [ ] `Code (Parse Result)` มี `fallback_used`, `fallback_model`, `model_version`
- [ ] Connection เดิม `HTTP (GenerateContent)` → `Code (Parse Result)` ถูกตัดออก
- [ ] Connection ใหม่ทั้งหมดครบ

**Verified from system (required):**
- [ ] T1 Exec ID: `_______` — Gemini OK, `fallback_used=false`
- [ ] T2 Exec ID: `_______` — GLM5 fallback succeed, `fallback_used=true`
- [ ] T3 Exec ID: `_______` — both fail, graceful error
- [ ] `verify_nowThai_sync.sh` ผ่าน

**E2E Passed:**
- [ ] Exec ID: `_______` — full happy path (Gemini OK, no fallback)
- [ ] Exec ID: `_______` — fallback path (GLM5 used)

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
