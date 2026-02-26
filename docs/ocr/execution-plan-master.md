# OCR Master Execution Plan (Production)

## 1) Scope & Objective
- Keep current synchronous journey unchanged: Carbonreceipt sends **page-by-page** OCR requests and receives JSON in the same request.
- Improve system stability for 10-50 file bursts.
- Improve OCR quality continuously via admin correction feedback.
- Prevent secret leakage and enforce release safety.

## 2) Workstream Owners
| Workstream | Owner (Role) | Backup | Deliverables |
|---|---|---|---|
| WS-A Platform Reliability | Backend/Ops Lead | SRE | queue guard, backpressure, timeout, retry |
| WS-B OCR Pipeline Quality | OCR Lead | Backend | dedupe, validation, confidence gate |
| WS-C Carbonreceipt Integration | App/API Lead | Backend | retry contract, idempotency adoption |
| WS-D Feedback Learning | Data/OCR Lead | Product/QA | feedback ingestion, diff, rule-learning |
| WS-E Observability & Alerting | SRE | Backend | dashboard, Telegram ops alert, runbook |
| WS-F Security & Release | Security/DevOps | Tech Lead | secret scan, scrub export, rollout checklist |

## 3) Execution Phases

### Phase 0: Baseline Freeze (2 days)
- Lock API schema version (`v1`).
- Capture baseline metrics:
  - p95 latency
  - success/error/timeout rate
  - dedupe miss rate
  - admin correction rate
  - token cost/day
- Freeze current workflow ID map and node ownership.

### Phase 1: Stability Core (1 week)
- Add admission control:
  - global max in-flight
  - per-tenant max in-flight
- Add backpressure response when busy:
  - HTTP `429` or `503`
  - `retry_after_sec`
- Normalize all error responses to standard JSON schema.
- Ensure parse-error never returns empty body.

### Phase 2: Throughput Hardening (1 week)
- Queue-aware worker tuning (without breaking sync contract).
- External OCR provider resilience:
  - timeout budget
  - retry with jitter
  - circuit-breaker threshold
- Idempotency key enforcement (`tenant + document_id + page_no + file_hash`).
- Atomic dedupe guard before insert/write.

### Phase 3: Feedback Loop MVP (1-2 weeks)
- Carbonreceipt sends feedback on admin approval.
- Store both:
  - `ocr_raw_output`
  - `admin_final_output`
- Build field-level diff and correction analytics.
- Enable rule-learning from high-quality approved corrections.

### Phase 4: Controlled Learning Release (ongoing)
- Offline evaluation on holdout set before any rule/model change.
- Canary rollout (10% traffic) -> full rollout.
- Auto rollback triggers on regression.

## 4) API Schema (Proposed)

### 4.1 OCR Request (current sync, unchanged)
`POST /webhook/ocr-dev`
- multipart `files`
- headers: `x-api-key`
- optional metadata: `document_id`, `page_no`, `tenant_id`, `bill_type`

### 4.2 OCR Success Response (standardized)
```json
{
  "success": true,
  "document_id": "doc_xxx",
  "request_id": "req_xxx",
  "status": "success",
  "decision": "auto_pass|needs_review",
  "confidence": 0.88,
  "doc_type": "fuel|unknown|...",
  "doc_type_confidence": 0.95,
  "doc_type_reason": "...",
  "used_reask": false,
  "bills_count": 1,
  "validation_errors": [],
  "message": "OK",
  "data": { "bills": [] }
}
```

### 4.3 OCR Busy/Error Response (standardized)
```json
{
  "success": false,
  "request_id": "req_xxx",
  "status": "error",
  "error_code": "SYSTEM_BUSY|PARSE_ERROR|UNAUTHORIZED|OCR_FAILED",
  "message": "...",
  "retry_after_sec": 15,
  "data": { "bills": [] }
}
```

### 4.4 Feedback API
`POST /webhook/ocr-feedback`
```json
{
  "tenant_id": "...",
  "document_id": "...",
  "page_no": 3,
  "request_id": "req_xxx",
  "ocr_version": "v2026.02.21",
  "ocr_raw_output": { "bills": [] },
  "admin_final_output": { "bills": [] },
  "approved_by": "admin_user_id",
  "approved_at": "2026-02-21T10:00:00Z"
}
```

## 5) Database Plan

### 5.1 Table: `ocr_requests`
- `id` (pk)
- `request_id` (unique)
- `tenant_id`
- `document_id`
- `page_no`
- `file_hash`
- `status` (`success|error|parse_error|busy`)
- `http_code`
- `decision`
- `doc_type`
- `confidence`
- `prompt_tokens`
- `candidates_tokens`
- `total_tokens`
- `est_cost_thb`
- `created_at`, `updated_at`

Index:
- `(tenant_id, document_id, page_no)`
- `(status, created_at)`

### 5.2 Table: `ocr_predictions`
- `id` (pk)
- `request_id` (fk)
- `raw_json`
- `normalized_json`
- `validation_errors_json`
- `dedupe_key`
- `ocr_version`
- `prompt_version`
- `created_at`

### 5.3 Table: `ocr_feedback`
- `id` (pk)
- `request_id` (fk)
- `tenant_id`
- `document_id`
- `page_no`
- `ocr_raw_output_json`
- `admin_final_output_json`
- `field_diff_json`
- `edit_score`
- `approved_by`
- `approved_at`
- `quality_label` (`trusted|review_required`)
- `created_at`

### 5.4 Table: `ocr_learning_rules`
- `id` (pk)
- `rule_type` (`normalize|template_hint|mapping`)
- `pattern_json`
- `replacement_json`
- `source_feedback_count`
- `precision_score`
- `status` (`draft|canary|active|rolled_back`)
- `created_at`, `updated_at`

## 6) Task Breakdown (Subtasks)

### WS-A Reliability
1. Add in-flight counter + cap.
2. Add busy response path with `retry_after_sec`.
3. Add timeout envelope for external OCR call.
4. Add retry/backoff wrapper for retryable failures.

### WS-B OCR Quality
1. Canonicalize invoice number for dedupe (`#, O/0, S/5, whitespace`).
2. Apply critical-field validation gate.
3. Keep duplicate-bill collapse deterministic and auditable.

### WS-C Integration
1. Share retry contract with Carbonreceipt.
2. Carbonreceipt sends `idempotency_key`.
3. Carbonreceipt retries on `429/503` with jitter.

### WS-D Feedback Learning
1. Add feedback webhook receiver.
2. Diff engine by field + line item.
3. Build trusted dataset filter.
4. Weekly rule proposal job.

### WS-E Observability
1. Metrics: latency, queue depth, busy rate, parse_error rate, cost.
2. Telegram notifications (already added) + failure taxonomy.
3. Dashboard and alert thresholds.

### WS-F Security
1. Secret scan before release/export.
2. Remove credential refs from shared workflow JSON.
3. Block commit if sensitive patterns detected.

## 7) Test Plan

### 7.1 Functional
- Single-page single-bill success.
- Single-page multi-bill success.
- Duplicate bills in one page collapse correctly.
- Unauthorized request returns standardized 401 JSON.
- Parse error returns 422 JSON (non-empty body).

### 7.2 Load/Resilience
- Burst 10/20/50 files (after split) with controlled concurrency.
- Provider 429 simulation.
- Provider timeout simulation.
- Worker crash/restart simulation.

### 7.3 Data Integrity
- Idempotent replay returns same result.
- No duplicate write under concurrent retries.
- Feedback record created only on final admin approval.

### 7.4 Security
- No API key/token/credential IDs in exported artifacts.
- PII masking check in logs/Telegram.

## 8) Rollout Checklist
1. Pre-release
- [ ] Backup workflow DB
- [ ] Baseline KPI snapshot stored
- [ ] Secret scan passed
- [ ] Regression tests passed

2. Canary (10%)
- [ ] Busy rate within threshold
- [ ] p95 latency not degraded >10%
- [ ] correction rate stable or improved

3. Full rollout
- [ ] enable to 100%
- [ ] monitor 24h with on-call
- [ ] daily summary to Telegram

4. Rollback criteria
- [ ] error rate > threshold for 10 min
- [ ] parse_error spike > threshold
- [ ] p95 latency exceeds SLA for 15 min

## 9) SLA/SLO Targets (initial)
- OCR API availability: 99.9%
- p95 latency/page: <= 45s
- standardized error response coverage: 100%
- duplicate output defect rate: < 0.5%
- critical field accuracy (after pre-approve loop): >= 99%

## 10) Deliverables
- `docs/ocr/execution-plan-master.md` (this file)
- sanitized workflow export for GitHub publication
- test evidence bundle (curl + logs + KPI snapshot)
