# T025 — Drive Fail Regression: Graceful Degradation + Test Cases

**Owner:** Claude Code
**Priority:** HIGH
**Created:** 2026-02-25
**Status:** Pending

---

## Problem Statement

T024 เพิ่ม Google Drive upload เข้า fast/standard path แต่พบว่า:

- `Google Drive (Upload)` → `continueOnFail: false`
- `Google Drive (Upload - Direct)` → `continueOnFail: false`

**Risk:** ถ้า GDrive credential หมดอายุ / quota เต็ม / network timeout → workflow crash ทั้งหมด → OCR client ไม่ได้รับ response (HTTP 500 หรือ timeout)

OCR pipeline มีค่ามากกว่า GDrive backup — ควร **degrade gracefully**: OCR result ยังคืนได้ แค่ `drive_file_id` จะเป็น `null`

---

## Current Flow (Fast/Standard Path)

```
Code (SLA Lane) → Google Drive (Upload - Direct) → Code (Merge Drive Result) → HTTP Upload File5 → ... → OCR → Respond
                           ↓ FAIL? → crash ❌
```

**Heavy Path:**
```
Code (Split Files) → Google Drive (Upload) → ... → OCR → Respond
                             ↓ FAIL? → crash ❌
```

---

## Fix Plan (2 tasks)

### Fix A — Enable Graceful Degradation (Claude Code implements)

**Patch ทั้ง 2 Drive nodes** ด้วย n8n REST API:

```javascript
// Patch: Google Drive (Upload - Direct) — fast path
{ continueOnFail: true }

// Patch: Google Drive (Upload) — heavy path
{ continueOnFail: true }
```

**Patch `Code (Merge Drive Result)`** ให้ handle กรณี Drive fail:

```javascript
// ตรวจว่า Drive node succeed หรือ fail
const driveResult = $input.first();
const driveError = driveResult.error;

if (driveError) {
  // GDrive failed — log แต่ไม่ block OCR
  console.log('[WARN] GDrive upload failed:', driveError.message);
  return [{
    json: {
      ...($('Code (SLA Lane + Timeout Budget)').first().json),
      drive_file_id: null,
      drive_upload_status: 'failed',
      drive_error: driveError.message
    }
  }];
}

// GDrive success — normal path
const driveId = driveResult.json?.id || null;
return [{
  json: {
    ...($('Code (SLA Lane + Timeout Budget)').first().json),
    drive_file_id: driveId,
    drive_upload_status: driveId ? 'success' : 'unknown'
  }
}];
```

### Fix B — Regression Test Cases (เพิ่มใน test matrix)

ดู Section: Regression Test Cases ด้านล่าง

---

## Regression Test Cases

เพิ่มใน `docs/collab/tasks/regression-test-matrix.md` — Section: Drive Fail Scenarios

| # | Scenario | Method | Input | Expected HTTP | Expected `drive_file_id` | Expected `decision` | Notes |
|---|---|---|---|---|---|---|---|
| D1 | Happy path — Drive success | POST /webhook/ocr-dev | valid PDF + valid GDrive credential | 200 | non-null string | `needs_review`/`auto_pass` | Baseline |
| D2 | GDrive credential invalid | POST /webhook/ocr-dev | valid PDF + broken GDrive cred | 200 | `null` | `needs_review`/`auto_pass` | OCR ต้อง succeed; drive_file_id=null |
| D3 | GDrive quota exceeded | POST /webhook/ocr-dev | valid PDF (simulate quota error) | 200 | `null` | `needs_review`/`auto_pass` | OCR ต้อง succeed; drive_upload_status='failed' |
| D4 | GDrive timeout (slow network) | POST /webhook/ocr-dev | valid PDF + slow drive (manual) | 200 | `null` or string | `needs_review`/`auto_pass` | ขึ้นกับ n8n timeout; OCR must not block |
| D5 | Heavy path — Drive fail | POST /webhook/ocr-dev | large file (>4MB) + broken GDrive | 200 | `null` | `needs_review`/`auto_pass` | heavy path graceful degrade |
| D6 | Drive success + OCR_RAW has drive_file_id | POST /webhook/ocr-dev | valid PDF + valid GDrive | 200 | string in response body | - | Verify `drive_file_id` persisted to OCR_RAW sheet |
| D7 | `drive_upload_status` field in response | POST /webhook/ocr-dev | any valid PDF | 200 | any | - | Response body ต้องมี `drive_upload_status` field |

---

## How To Test D2 (Simulate GDrive Credential Failure)

```bash
# Option 1: Temporarily break GDrive credential via n8n UI
# - Settings → Credentials → Google Drive account → แก้ access_token → save
# - รัน OCR test → verify OCR returns 200 + drive_file_id=null
# - Restore credential

# Option 2: Check current behavior (before fix)
curl -X POST http://localhost:5678/webhook/ocr-dev \
  -H "x-api-key: ocm-cabonrecipte!" \
  -F "file=@/tmp/test.pdf"
# Before fix: อาจ return 500 หรือ hang
# After fix: return 200 + drive_file_id=null
```

---

## Completion Checklist

- [ ] Patch `Google Drive (Upload - Direct)` → `continueOnFail: true`
- [ ] Patch `Google Drive (Upload)` → `continueOnFail: true`
- [ ] Patch `Code (Merge Drive Result)` → handle drive error gracefully
- [ ] Verify Test D1 (happy path still works after fix)
- [ ] Verify Test D2 (broken cred → OCR still returns 200)
- [ ] Add test cases D1-D7 to `regression-test-matrix.md`
- [ ] Update HANDOFF.md → T025 Completed

---

## Risk After Fix

| Risk | Impact |
|------|--------|
| `drive_file_id=null` ใน OCR_RAW sheet | LOW — admin ยังเห็น OCR result; GDrive backup ไม่มี แต่ข้อมูลไม่หาย |
| Double-logging ถ้า retry | LOW — drive_file_id เขียนทับ null ได้ |
| Merge Drive Result อ่านจาก wrong source | MEDIUM — ต้องใช้ `$('Code (SLA Lane + Timeout Budget)').first()` อย่างถูกต้อง |

---

## Discussion
*(comment ก่อน implement)*
