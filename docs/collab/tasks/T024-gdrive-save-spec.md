# T024 — Google Drive Save for All OCR Files

**Owner:** Codex (execute)
**Status:** Ready for Implementation ✅
**Created:** 2026-02-24
**Decisions finalized:** 2026-02-24 (Claude Code)
**Goal:** บันทึกไฟล์ทุกไฟล์ที่ user ส่งมา OCR ขึ้น Google Drive เพื่อ audit trail และรองรับ CarbonReceipt integration

---

## 1. สถานะปัจจุบัน

### Workflow: `ocr-invoice-processor` (ID: `up1n75qEhbsXswii`)

```
Webhook → JS22 → JS5 → If(file) → If(apiKey) → Admission → Doc Classifier → SLA Lane
                                                                                    │
                          lane='heavy' (≥4000KB/mixed)  ──────────────────────┐    │ lane='fast'/'standard'
                                                                               │    │
                                                                               ▼    ▼
                                                              Code (Split Files)    HTTP Upload File5  ← ตรงไป Gemini ❌
                                                                      │
                                                            ✅ Google Drive (Upload)
                                                               folder: Upload_Carbonrecipt
                                                               name: {file_id}.pdf
                                                               credential: Google Drive account
                                                                      │
                                                            Google Sheets (Append to Queue)
                                                               เก็บ: file_id, filename, drive_file_id
                                                                      │
                                                              (Queue worker later)
                                                                      │
                                                            Download file (Google Drive)
                                                                      │
                                                            HTTP Upload to Gemini → OCR
```

**GAP:** Fast/Standard path ข้าม Google Drive → ไป Gemini โดยตรง

---

## 2. ข้อมูลสำคัญสำหรับ Implementation

### Google Drive credentials & folder
| Field | Value |
|-------|-------|
| Credential name | `Google Drive account` |
| Credential ID | `IYyt3qEQVk3xfjcF` |
| Folder name | `Upload_Carbonrecipt` |
| Folder ID | `1Fc8U94SNk_EJLsvzyUHWcTxDBMLiwR-v` |
| Drive | My Drive |

### Binary field names (สำคัญมาก)
| Path | Binary field | หมายเหตุ |
|------|-------------|---------|
| Fast/Standard | `files0` | จาก Webhook → JS22 normalize |
| Heavy/Queue | `file` | Code (Split Files) rename ให้ |

### JSON fields ที่มีอยู่แล้ว ณ จุด SLA Lane
- `request_id` (จาก Code Build Admission Acquire Payload) — ใช้เป็น filename ได้
- `source_file` — ชื่อไฟล์ต้นฉบับ
- `ocr_lane` — 'fast' / 'standard' / 'heavy'
- `doc_type`, `file_size_kb`, `bill_type`
- `binary.files0` — ไฟล์จริง (binary)

### Google Sheets
| Sheet | ID | หมายเหตุ |
|-------|----|---------|
| Spreadsheet | `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0` | OCM-INFRA |
| OCR_RAW | gid `1923516144` | fast path เขียนที่นี่ |
| OCR_QUEUE | gid `2080899316` | queue path เขียนที่นี่ (มี drive_file_id แล้ว) |

### OCR_RAW columns ปัจจุบัน (ยังไม่มี drive_file_id)
```
source_file, created_at, request_id, created_at_iso, model_version,
prompt_tokens, candidates_tokens, total_tokens, est_cost_thb,
raw_text, raw_json, raw_text_pretty, status, bills_count, file_size_kb, caller_ip
```

---

## 3. Recommended Approach — Option A: Sequential Insert

แทรก Google Drive upload **ก่อน** ส่งไฟล์ Gemini บน fast/standard path

```
Code (SLA Lane + Timeout Budget)
        │
        ▼
[NEW] Google Drive (Upload - Direct)       ← onError: continueRegularOutput
        │ (output: $json.id = drive file ID, binary ยังคงอยู่)
        ▼
[NEW] Code (Merge Drive Result)            ← merge drive_file_id กลับเข้า json
        │ (output: { ...originalJson, drive_file_id: "xxx" }, binary: files0)
        ▼
HTTP Upload File5 (Gemini)                 ← existing node, ไม่เปลี่ยน
        │
        ▼
... (existing OCR flow unchanged)
        │
        ▼
Append row in OCR_RAW4                     ← เพิ่ม drive_file_id column
```

### ทำไมไม่เลือก Option อื่น
- **Option B (Unified Queue):** ทำให้ fast path กลายเป็น async → response ช้ามาก → ไม่เหมาะ
- **Option C (Parallel async):** Race condition ถ้า Drive ช้ากว่า OCR → drive_file_id ไม่ sync → ซับซ้อน

---

## 4. Node Specifications (Claude Code ต้อง implement ตามนี้)

### Node A: `Google Drive (Upload - Direct)`
```json
{
  "name": "Google Drive (Upload - Direct)",
  "type": "n8n-nodes-base.googleDrive",
  "typeVersion": 3,
  "parameters": {
    "inputDataFieldName": "files0",
    "name": "={{ $json.request_id }}.{{ ($binary['files0'].fileName || 'file.pdf').split('.').pop().toLowerCase() || 'pdf' }}",
    "driveId": {
      "__rl": true,
      "value": "My Drive",
      "mode": "list"
    },
    "folderId": {
      "__rl": true,
      "value": "1Fc8U94SNk_EJLsvzyUHWcTxDBMLiwR-v",
      "mode": "list",
      "cachedResultName": "Upload_Carbonrecipt"
    },
    "options": {}
  },
  "credentials": {
    "googleDriveOAuth2Api": {
      "id": "IYyt3qEQVk3xfjcF",
      "name": "Google Drive account"
    }
  },
  "onError": "continueRegularOutput"
}
```
**Position:** ระหว่าง `Code (SLA Lane + Timeout Budget)` และ `HTTP Upload File5`

---

### Node B: `Code (Merge Drive Result)`
```javascript
// Merge Google Drive upload result back into original OCR json
// รัน: หลัง Google Drive (Upload - Direct)
const driveOutput = $input.first().json;
const original = $('Code (SLA Lane + Timeout Budget)').first();

// ถ้า Drive upload สำเร็จ $json.id จะมีค่า, ถ้า fail จะ undefined (onError:continueRegularOutput)
const driveFileId = driveOutput.id || 'UPLOAD_FAILED';

return [{
  json: {
    ...original.json,
    drive_file_id: driveFileId,
    drive_upload_ok: !!driveOutput.id
  },
  binary: original.binary
}];
```
**Position:** หลัง `Google Drive (Upload - Direct)`, ก่อน `HTTP Upload File5`

---

### Update: `Append row in OCR_RAW4` — เพิ่ม column
```json
"drive_file_id": "={{ $json.drive_file_id || '' }}"
```
เพิ่มต่อจาก `caller_ip` column

---

### Connections ใหม่ที่ต้องเพิ่ม
```
Code (SLA Lane + Timeout Budget) → Google Drive (Upload - Direct)   [แทน → HTTP Upload File5]
Google Drive (Upload - Direct)   → Code (Merge Drive Result)
Code (Merge Drive Result)        → HTTP Upload File5                 [ต่อเนื่อง flow เดิม]
```

---

## 5. Error Handling

| Scenario | Behavior | หมายเหตุ |
|----------|----------|---------|
| Drive upload สำเร็จ | `drive_file_id = $json.id` (Drive file ID) | ปกติ |
| Drive upload fail (network/quota) | `drive_file_id = "UPLOAD_FAILED"` | OCR ยัง continue |
| Drive upload fail + OCR fail | Telegram FAILED, drive_file_id = "UPLOAD_FAILED" | สองอย่างล้มเหลว |
| Drive fail, file_id missing | ไม่ block — Code (Merge Drive Result) handle | |

**Key:** `onError: continueRegularOutput` บน Drive node = ถ้า fail → ยังส่งข้อมูลต่อ (json ว่าง)

---

## 6. Testing Checklist (Claude Code ต้องผ่านก่อน complete)

- [ ] ส่งไฟล์ขนาดเล็ก (fast lane) → ไฟล์ปรากฎใน `Upload_Carbonrecipt` folder
- [ ] `drive_file_id` บันทึกใน OCR_RAW sheet
- [ ] ส่งไฟล์ขนาดใหญ่ (heavy lane) → queue path ทำงานปกติ (ไม่กระทบ)
- [ ] จำลอง Drive fail (ใช้ invalid credential ชั่วคราว) → OCR ยัง success, `drive_file_id = UPLOAD_FAILED`
- [ ] Telegram notification ยังส่งถูกต้อง

---

## 7. Optional: Expose `drive_file_id` ใน OCR Response

พิจารณาเพิ่ม `drive_file_id` ใน response body เพื่อ CarbonReceipt integration:

```json
{
  "success": true,
  "request_id": "...",
  "drive_file_id": "1ABC...XYZ",
  ...
}
```

**Benefit:** CarbonReceipt admin สามารถ cross-reference ไฟล์ต้นฉบับกับ OCR result ได้โดยตรง

---

## 8. Decisions (Claude Code ตัดสินใจแล้ว — Codex implement ตามนี้)

| # | Decision | Result |
|---|----------|--------|
| 1 | Expose `drive_file_id` ใน OCR response? | **YES** — เพิ่มใน response body (Section 8.1) |
| 2 | Folder structure | **ใช้ `Upload_Carbonrecipt` เดียว + prefix `YYYY-MM_` ในชื่อไฟล์** (ไม่แยก subfolder เพราะต้องสร้าง folder dynamically ซึ่งเพิ่ม latency) |

### 8.1 — Filename format (แทน Section 4 Node A)

```
YYYY-MM_request_id.ext
```

ตัวอย่าง: `2026-02_req_abc123.pdf`

Expression ใน n8n:
```
={{ $now.format('YYYY-MM') + '_' + $json.request_id + '.' + (($binary && $binary['files0'] && $binary['files0'].fileName) ? $binary['files0'].fileName.split('.').pop().toLowerCase() : 'pdf') }}
```

### 8.2 — เพิ่ม `drive_file_id` ใน Respond to Webhook6 response

ไฟล์ที่ต้องแก้: node `Respond to Webhook6` — เพิ่มใน responseBody JSON object:

```js
drive_file_id: $json.drive_file_id || '',
```

แทรกต่อจาก `request_id: $json.request_id || '',`

---

## 9. Codex Execution Checklist

**งานของ Codex (ทำตามลำดับ):**

- [ ] 1. Login n8n: `POST /rest/login` → save cookie
- [ ] 2. GET workflow `up1n75qEhbsXswii` → load nodes + connections
- [ ] 3. Add Node A: `Google Drive (Upload - Direct)` (spec ใน Section 4) — ใช้ filename format ใหม่จาก Section 8.1
- [ ] 4. Add Node B: `Code (Merge Drive Result)` (spec ใน Section 4)
- [ ] 5. Update connections: SLA Lane → Google Drive → Merge → HTTP Upload File5
- [ ] 6. Update `Append row in OCR_RAW4`: เพิ่ม `drive_file_id` column (Section 4)
- [ ] 7. Update `Respond to Webhook6`: เพิ่ม `drive_file_id` ใน responseBody (Section 8.2)
- [ ] 8. PATCH workflow via REST API
- [ ] 9. ส่ง test OCR → ยืนยัน: ไฟล์ปรากฏใน Google Drive + `drive_file_id` อยู่ใน response
- [ ] 10. อัปเดต HANDOFF.md → T024 status = "Completed"
- [ ] 11. Commit + push `agents/codex`

---

## 10. Constraints

- ห้ามแก้ workflow JSON โดยตรง — patch ผ่าน n8n REST API (`PATCH /rest/workflows/{id}`) เท่านั้น
- ห้าม commit `.env` หรือ credentials
- ต้องรัน `./scripts/verify_nowThai_sync.sh` หลัง patch (ถ้าแก้ Code nodes)
- ต้องรัน `git push origin agents/codex` หลัง commit
