# T041B — Typhoon OCR Fallback (แทน GLM5 ใน queue path)

**Author:** Claude Code (CC)
**Date:** 2026-02-27
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง (patch live workflow main OCR — replace existing fallback nodes)
**Depends on:** T040 (IF (Gemini OK?) node มีอยู่แล้ว — ไม่ต้องสร้างใหม่)

---

## Overview

T040 ติดตั้ง GLM5 (Zhipu AI) เป็น fallback แล้ว แต่ GLM5 มีปัญหา:
1. `glm-5` = text-only, ไม่รองรับ vision (รับแค่ base64 image ไม่ได้รับ PDF)
2. PDF→JPEG conversion ต้องใช้ `child_process` ซึ่ง sandbox n8n block
3. Account Zhipu AI มีปัญหา credits

**T041B = แทน 3 GLM5 nodes ด้วย Typhoon OCR (opentyphoon.ai)**

Typhoon ข้อดี:
- `/v1/ocr` endpoint รับ PDF binary โดยตรง — ไม่ต้อง convert
- ทดสอบแล้ว: PTT invoice → tax_id ถูกต้อง, Thai text ดี
- API ง่าย: Bearer token (ไม่ต้อง JWT)
- โมเดล: `typhoon-ocr-preview` (เร็ว 1-4s, OCR quality ดี)

---

## Scope

### Queue path only (เช่นเดิม — ตาม T040 scope lock)

**REMOVE** 3 GLM5 nodes:
| Node | ID | Action |
|------|----|--------|
| `Code (Prepare GLM5 Request)` | `e74dd7c5-26f4-4dbe-a516-666f997f465b` | **REMOVE** |
| `HTTP (GLM5 GenerateContent)` | `429f34a0-a5c8-4b3b-895b-1b28532aed05` | **REMOVE** |
| `Code (Reshape GLM5 Response)` | `a1ae9c75-b8ee-4cbe-ab72-f0ad70c10338` | **REMOVE** |

**ADD** 3 Typhoon nodes (same positions, same connections):
- `Code (Prepare Typhoon Request)` — อ่าน binary จาก `Download file`, pass ผ่าน binary
- `HTTP (Typhoon OCR)` — POST multipart PDF ไป `/v1/ocr`
- `Code (Reshape Typhoon Response)` — extract natural_text, build bills, reshape → Gemini format

**KEEP** (ไม่เปลี่ยน):
- `IF (Gemini OK?)` node — ยังใช้อยู่
- `Code (Parse Result)` — ไม่เปลี่ยน (รับ input เหมือนเดิม)
- ทุก connection ที่ไม่เกี่ยวกับ GLM5

**Out of scope:**
- Direct path (`/ocr-dev`) — T041C (follow-up)
- เปลี่ยน `IF (Gemini OK?)` logic
- เปลี่ยน `Code (Parse Result)` logic

---

## Current State (pre-T041B)

```
IF (Gemini OK?)
  TRUE  → Code (Parse Result) [input 0]
  FALSE → Code (Prepare GLM5 Request) [input 0]
              ↓
          HTTP (GLM5 GenerateContent)
              ↓
          Code (Reshape GLM5 Response)
              ↓
          Code (Parse Result) [input 1]
```

## Target State (post-T041B)

```
IF (Gemini OK?)
  TRUE  → Code (Parse Result) [input 0]
  FALSE → Code (Prepare Typhoon Request) [input 0]
              ↓
          HTTP (Typhoon OCR)
              ↓
          Code (Reshape Typhoon Response)
              ↓
          Code (Parse Result) [input 1]
```

---

## Technical Spec

### Node 1: `Code (Prepare Typhoon Request)` [NEW — แทน Code (Prepare GLM5 Request)]

**Role:** อ่าน binary PDF จาก `Download file` node แล้วส่งผ่าน binary field ไปให้ HTTP node

```javascript
// อ่าน binary จาก 'Download file' node (queue path)
const dlItem = $('Download file').first();
const binaryData = dlItem?.binary?.data;

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

// Pass binary through + API key for header reference
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
- input: `IF (Gemini OK?)` output 1 (FALSE branch)
- output: `HTTP (Typhoon OCR)` input 0

---

### Node 2: `HTTP (Typhoon OCR)` [NEW — แทน HTTP (GLM5 GenerateContent)]

**Role:** POST multipart PDF ไปยัง Typhoon `/v1/ocr` endpoint

```json
{
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.opentyphoon.ai/v1/ocr",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $json._typhoon_api_key }}"
        }
      ]
    },
    "sendBody": true,
    "contentType": "multipart-form-data",
    "bodyParameters": {
      "parameters": [
        {
          "parameterType": "formBinaryData",
          "name": "file",
          "inputDataFieldName": "data"
        }
      ]
    },
    "options": {
      "timeout": 120000
    }
  },
  "continueOnFail": true,
  "onError": "continueRegularOutput"
}
```

**หมายเหตุสำคัญ:**
- `inputDataFieldName: "data"` → ชื่อ binary key ที่ Code node ด้านหน้า return (ดู Node 1)
- `contentType: "multipart-form-data"` → ส่ง PDF เป็น multipart file upload
- `timeout: 120000` → 120s (บางไฟล์ใช้เวลา 30-60s)
- ห้ามใช้ `$env.TYPHOON_API_KEY` โดยตรงใน header — ใช้ `$json._typhoon_api_key` แทน (ผ่านจาก Code node)
- ห้าม hardcode API key

**Response ที่ได้:**
```json
{
  "id": "chatcmpl-xxx",
  "choices": [{
    "message": {
      "content": "บริษัท ปตท. จำกัด (มหาชน)\nเลขที่ผู้เสียภาษี 0107561000013\n..."
    }
  }]
}
```

**Connections:**
- input: `Code (Prepare Typhoon Request)` output 0
- output: `Code (Reshape Typhoon Response)` input 0

---

### Node 3: `Code (Reshape Typhoon Response)` [NEW — แทน Code (Reshape GLM5 Response)]

**Role:** extract `natural_text` จาก Typhoon response → parse fields ด้วย regex → build `bills` array → reshape เป็น Gemini-compatible format

```javascript
const resp = $input.item.json;

// ---- Graceful fail: HTTP error or no content ----
const naturalText = resp?.choices?.[0]?.message?.content;
if (!naturalText) {
  return [{
    json: {
      candidates: null,
      fallback_used: true,
      fallback_model: 'typhoon-ocr-preview',
      fallback_status: 'failed',
      error: resp?.error?.message || resp?.error || 'Typhoon no response'
    }
  }];
}

// ---- Extract fields with regex (best-effort) ----
// vendor_tax_id: 13-digit Thai tax ID
const taxIdMatch = naturalText.match(/\b(\d{13})\b/);
const vendor_tax_id = taxIdMatch ? taxIdMatch[1] : null;

// vendor_name: first non-empty line (usually company name at top)
const lines = naturalText.split('\n').map(l => l.trim()).filter(Boolean);
const vendor_name = lines[0] || null;

// invoice_number: look for common patterns
const invMatch = naturalText.match(
  /(?:เลขที่ใบกำกับ(?:ภาษี)?|Invoice\s*No\.?|Inv\.?\s*No\.?|เลขที่)[^\d]*([A-Za-z0-9\-\/]+)/i
);
const invoice_number = invMatch ? invMatch[1].trim() : null;

// invoice_date: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
let invoice_date = null;
const dateMatch = naturalText.match(
  /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?!\d)/ // YYYY-MM-DD
) || naturalText.match(
  /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/ // DD/MM/YYYY
);
if (dateMatch) {
  // Normalize to YYYY-MM-DD
  if (dateMatch[1].length === 4) {
    // YYYY-MM-DD format
    const y = parseInt(dateMatch[1]);
    const m = dateMatch[2].padStart(2, '0');
    const d = dateMatch[3].padStart(2, '0');
    // Convert Buddhist year if > 2500
    invoice_date = `${y > 2500 ? y - 543 : y}-${m}-${d}`;
  } else {
    // DD/MM/YYYY format
    const d = dateMatch[1].padStart(2, '0');
    const m = dateMatch[2].padStart(2, '0');
    const y = parseInt(dateMatch[3]);
    invoice_date = `${y > 2500 ? y - 543 : y}-${m}-${d}`;
  }
}

// total_amount: look for total / ยอดรวม / ราคารวม
const totalMatch = naturalText.match(
  /(?:ยอดรวม|รวมทั้งสิ้น|Total(?:\s*Amount)?|Grand\s*Total)[^\d]*?([\d,]+(?:\.\d{1,2})?)/i
);
const total_amount = totalMatch
  ? parseFloat(totalMatch[1].replace(/,/g, ''))
  : null;

// vat_amount: ภาษีมูลค่าเพิ่ม / VAT
const vatMatch = naturalText.match(
  /(?:ภาษีมูลค่าเพิ่ม|VAT|ภาษี\s*7%)[^\d]*?([\d,]+(?:\.\d{1,2})?)/i
);
const vat_amount = vatMatch
  ? parseFloat(vatMatch[1].replace(/,/g, ''))
  : null;

// ---- Build bills array ----
const bills = [{
  vendor_name,
  vendor_tax_id,
  invoice_number,
  invoice_date,
  total_amount,
  vat_amount
}];

// ---- Reshape to Gemini-compatible format ----
// Code (Parse Result) reads: candidates[0].content.parts[0].text → JSON.parse → bills array
return [{
  json: {
    candidates: [{
      content: {
        parts: [{ text: JSON.stringify({ bills }) }]
      }
    }],
    usageMetadata: {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0
    },
    fallback_used: true,
    fallback_model: 'typhoon-ocr-preview',
    fallback_status: 'success',
    _typhoon_natural_text: naturalText  // ไว้ debug — Code (Parse Result) ไม่ใช้ field นี้
  }
}];
```

**Connections:**
- input: `HTTP (Typhoon OCR)` output 0
- output: `Code (Parse Result)` input **1** (PATTERN-001: multi-input)

---

## Connection Changes Summary

| From | To | Action |
|------|----|--------|
| `IF (Gemini OK?)` [FALSE] → `Code (Prepare GLM5 Request)` | — | ❌ REMOVE |
| `Code (Prepare GLM5 Request)` → `HTTP (GLM5 GenerateContent)` | — | ❌ REMOVE |
| `HTTP (GLM5 GenerateContent)` → `Code (Reshape GLM5 Response)` | — | ❌ REMOVE |
| `Code (Reshape GLM5 Response)` → `Code (Parse Result)` [input 1] | — | ❌ REMOVE |
| `IF (Gemini OK?)` [FALSE] → `Code (Prepare Typhoon Request)` | NEW | ✅ ADD |
| `Code (Prepare Typhoon Request)` → `HTTP (Typhoon OCR)` | NEW | ✅ ADD |
| `HTTP (Typhoon OCR)` → `Code (Reshape Typhoon Response)` | NEW | ✅ ADD |
| `Code (Reshape Typhoon Response)` → `Code (Parse Result)` [input 1] | NEW | ✅ ADD |

**Node IDs ที่ต้อง REMOVE** (ใช้ REST API patch):
- `e74dd7c5-26f4-4dbe-a516-666f997f465b` (Code Prepare GLM5)
- `429f34a0-a5c8-4b3b-895b-1b28532aed05` (HTTP GLM5)
- `a1ae9c75-b8ee-4cbe-ab72-f0ad70c10338` (Code Reshape GLM5)

**Anchor nodes (ห้ามเปลี่ยน ID):**
- `3fb14095-1f01-437f-84d6-e45008c024d5` — `IF (Gemini OK?)`
- `87c34b55-7dde-4755-9db6-52710dca2fea` — `Code (Parse Result)`

---

## Environment Variables

ใน `.env` (CC เพิ่มแล้ว — Codex ไม่ต้องทำ):
```bash
TYPHOON_API_KEY=sk-y51g5dvThqtd9h21NkabskWnt8vaCLKElVoMlRQ5YGD96VLP
```

n8n อ่านผ่าน `$env.TYPHOON_API_KEY` — ห้าม hardcode key ในโค้ด

**Codex: ก่อนทดสอบ ตรวจว่า n8n โหลด env ใหม่แล้ว**
```bash
# ตรวจว่า TYPHOON_API_KEY โหลดแล้ว
curl -s -b /tmp/cookie.txt 'http://localhost:5678/rest/debug/env' 2>/dev/null | grep TYPHOON || echo "not found"
# ถ้า not found → restart n8n ก่อน:
# sudo systemctl restart n8n   (หรือ pm2 restart n8n ตามที่ใช้)
# แล้ว login ใหม่: curl -c /tmp/cookie.txt -X POST ...
```

---

## Security Considerations

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| TYPHOON_API_KEY ใน header | ผ่าน `$json._typhoon_api_key` จาก Code node — ไม่ hardcode |
| Invoice PDF ส่งไป Typhoon (SCB10X) | Fallback only — เกิดเมื่อ Gemini ล้มแล้ว; ยอมรับ tradeoff เดิม |
| HTTP (Typhoon OCR) ล้ม | `continueOnFail: true` + graceful error ใน Reshape node |
| natural_text ใน response | `_typhoon_natural_text` field ไว้ debug เท่านั้น — ไม่ส่งออก Respond node |

---

## Discussion

- พบ behavior จริงของ Typhoon `/v1/ocr` ต่างจากตัวอย่างใน spec: response อยู่ที่ `results[0].message.choices[0].message.content` และ content เป็น JSON string (`{"natural_text":"..."}`) ไม่ใช่ `choices[0].message.content` ตรงๆ
- Parse chain ของ workflow นี้ต้องต่อ `Code (Reshape Typhoon Response) -> Code (Parse Result)` ที่ `index: 0` เพื่อให้ `Code (Parse Result)` emit output ได้จริง (ต่อเป็น `index: 1` แล้ว node run แต่ output ว่าง)
- ดำเนินการต่อโดยปรับ implementation ให้รองรับ runtime จริงตามข้างต้น

---

## Test Plan

### Setup: Force Gemini to fail
เปลี่ยน `HTTP (GenerateContent)` URL เป็น `https://invalid.example.com` ชั่วคราว (ใช้ n8n REST PATCH)
แล้ว restore หลังทดสอบเสร็จ

### Test Cases

| # | Test | Method | Expected |
|---|------|--------|---------|
| T1 | Typhoon fallback succeed (PDF) | queue path + Gemini forced fail + caltex.pdf | `fallback_used=true`, `fallback_model=typhoon-ocr-preview`, `fallback_status=success`, `bills_count≥1`, `vendor_tax_id` มีค่า |
| T2 | Gemini OK → Typhoon ไม่ถูกเรียก | queue path + Gemini ปกติ | `fallback_used=false`, bills_count≥1 |
| T3 | Graceful fail: binary missing | queue อื่นที่ไม่มี binary (หรือ mock) | `fallback_status=failed`, `status=error`, ไม่ crash |
| T4 | Graceful fail: Typhoon API error | force bad TYPHOON_API_KEY ชั่วคราว | `fallback_status=failed`, graceful |

**DoD minimum: T1 + T2 ผ่าน + verify_nowThai_sync.sh ผ่าน**

---

## Definition of Done

> Codex: อย่า mark Done ถ้ายังไม่ครบทุก checkbox

**Implemented:**
- [x] 3 GLM5 nodes REMOVED จาก workflow `up1n75qEhbsXswii`
- [x] `Code (Prepare Typhoon Request)` เพิ่มแล้ว — binary pass-through ทำงาน
- [x] `HTTP (Typhoon OCR)` เพิ่มแล้ว — multipart form-data, `continueOnFail: true`
- [x] `Code (Reshape Typhoon Response)` เพิ่มแล้ว — output Gemini-like structure
- [x] Connection ใหม่ทั้งหมดถูกต้อง: IF FALSE → Typhoon → Parse Result (runtime ใช้ input index 0 เพื่อให้ Parse Result ปล่อย output ได้จริง)

**Verified from system (required):**
- [x] T1 Exec ID: `153576` — Typhoon fallback, `fallback_used=true`, `bills_count=1`, `fallback_status=success` (ใน `raw_json` มี `vendor_tax_id=0105564172883`)
- [x] T2 Exec ID: `153579` — Gemini OK, `fallback_used=false`, `bills_count=4`
- [x] `verify_nowThai_sync.sh` ผ่าน

**E2E Passed:**
- [x] Exec ID: `153576` — Typhoon fallback path ครบ (IF FALSE -> Prepare Typhoon -> HTTP Typhoon -> Reshape -> Parse -> Set Done)

**Docs synced:**
- [x] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Closing Template

*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched: Replaced GLM5 fallback branch with Typhoon OCR branch on workflow `up1n75qEhbsXswii` via n8n REST PATCH; updated reshape logic to parse live Typhoon OCR nested response format; restored queue Gemini URL after forced-fail testing.
Verified from: Exec `153576` (forced Gemini fail -> Typhoon success), Exec `153579` (Gemini success no fallback), `./scripts/verify_nowThai_sync.sh` OK.
Docs synced: Updated this spec (Discussion/DoD/closing), updated `docs/collab/HANDOFF.md` task board.
Remaining limits: Queue webhook `/webhook/ocr-queue` currently returns HTTP 500 with empty body despite successful enqueue execution; not in T041B scope. `Code (Parse Result)` emits parsed OCR in `raw_json` (not top-level `bills`) on queue path.
```
