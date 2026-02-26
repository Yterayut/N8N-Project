# OCR API Schema Standards v2

## 1. Success
```json
{
  "success": true,
  "document_id": "doc_...",
  "request_id": "...",
  "status": "success",
  "decision": "auto_pass|needs_review",
  "confidence": 0.88,
  "doc_type": "unknown",
  "doc_type_confidence": 0.55,
  "doc_type_reason": "no_hint",
  "used_reask": false,
  "bills_count": 1,
  "validation_errors": [],
  "message": "OK",
  "data": { "bills": [] }
}
```

## 2. Error (Standard)
```json
{
  "success": false,
  "request_id": "...",
  "status": "error|parse_error|unauthorized|busy",
  "error_code": "UNAUTHORIZED|PARSE_ERROR|OCR_FAILED|SYSTEM_BUSY",
  "message": "...",
  "retry_after_sec": 15,
  "data": { "bills": [] }
}
```

## 3. Feedback API
`POST /webhook/ocr-feedback`
```json
{
  "tenant_id": "tenant_a",
  "document_id": "doc_...",
  "page_no": 2,
  "request_id": "...",
  "ocr_version": "v2026.02.21",
  "ocr_raw_output": {"bills": []},
  "admin_final_output": {"bills": []},
  "approved_by": "admin_01",
  "approved_at": "2026-02-21T12:00:00Z"
}
```
