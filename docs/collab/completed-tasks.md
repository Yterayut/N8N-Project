# Completed Tasks Archive

> ย้ายมาจาก HANDOFF.md เพื่อลด noise — ดู HANDOFF.md สำหรับ current status

---

## T001–T020 (2026-02-23) — P0/P1/P2/P3 Production Readiness Fixes

| ID | Task | Owner | Notes |
|----|------|-------|-------|
| T001 | Audit improve.md vs live workflow | CC | All 8 P0/P1 issues confirmed OPEN |
| T002 | Regression test matrix | Codex | 18 scenarios, 5 sections |
| T003 | Fix round3 + allHeaders + MIME + URL + file limit | CC | 6 nodes patched, commit c556967 |
| T004 | Fix re-ask normalize bypass | CC | validation added before accepting re-ask |
| T005 | Fix queue worker retry status | CC | Set Done now writes 'error' on fail |
| T006 | Update docs after P0/P1 fixes | Codex | phase1 summary |
| T007 | File size guard (main + queue path) | CC | MAX_FILE_BYTES=20MB |
| T008 | Sanitize Gemini error → client | CC | literal safe message |
| T009 | Few-shot truncation at example boundary | CC | loop-based cut |
| T011 | HTTP Re-ask: retry + continueRegularOutput | CC | retryOnFail=true, maxTries=2 |
| T012 | THB pricing → env vars | CC | OCR_PRICE_THB_PER_1K_INPUT/OUTPUT |
| T013 | Remove 24 disabled legacy nodes | CC | 24 nodes + dangling connections |
| T014 | Phase 2 docs | Codex | phase2-summary.md + regression matrix |
| T015 | Config externalization | CC | OCR_QUEUE_BATCH_SIZE, OCR_SLA_* |
| T016 | Queue worker file_id fix | CC | .first() fallbacks |
| T017 | Re-ask confidence floor | CC | OCR_REASK_CONF_BOOST env |
| T018 | Electricity ref regex widen | CC | /^\d{10,15}$/ + env override |
| T019 | MIME: TIFF + HEIC detection | CC | sniffMimeFromBase64 |
| T020 | Phase 3 docs | Codex | phase3-summary.md + regression matrix |

---

## T021–T028 (2026-02-24 to 2026-02-25) — Enhancement & Learning Loop

| ID | Task | Owner | Score | Notes |
|----|------|-------|-------|-------|
| T021 | Rename workflow → ocr-invoice-processor | CC | — | via n8n REST API |
| T022 | nowThai() consolidation | CC | — | 5 nodes standardized; verify: `scripts/verify_nowThai_sync.sh` |
| T023 | Fix Telegram OCR Notify | CC | — | telegram_text + $workflow.name + footer |
| T024 | Google Drive save fast/standard path | Codex | 8/10 | drive_file_id propagated; GDrive upload verified |
| T025 | GDrive graceful degradation | CC | — | continueOnFail; drive_upload_status='failed' |
| T026 | OCR Feedback Receiver + KPI | Codex | 9/10 | ocr-feedback-receiver + ocr-kpi-report; /ocr-feedback-kpi path |
| T027 | OCR Learning Loop Path1+2 | Codex | 7.5/10 | 3 workflows: examples-api, learning-path1, ocr-training |
| T028 | ocr-training confirm/correct + pending_train | Codex+CC | 7.5/10 | 3 CC bugs fixed post-merge; T5e E2E PASSED exec 151539 |
