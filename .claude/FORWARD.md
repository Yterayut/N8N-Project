## Last Checkpoint — 2026-03-13 BKK (session 2)

### Git State
- Branch: `stable`
- Last commit: `58bca3d fix(ocr): normalize invoice_date_th from ISO to DD/MM/YYYY format`

### Status
- ✅ GG ground truth for nexgen/INET bill complete — `docs/gg/proposals/2026-03-13-groundtruth-nexgen_actual.json`
- ✅ INET (0105561072420) in VENDOR_MAP all 3 workflows — layout=inet_nexgen_v1, vendor_code=inet
- ✅ Training examples active: `ex_1773338904205_234d` (active=true, active_for_prompt=true) + 1 more
- ✅ Date normalization fix deployed — `normalizeDateTh()` in Code(Normalize+Validate), format hint in repair prompt
- ⚠️ 1st nexgen example has wrong layout_id=ptt_or_fuel_v1 (should be inet_nexgen_v1) — minor
- ⚠️ T054 spec pending CC review — key action needed
- ⚠️ POC + PAY Google OAuth expired — Yut ต้อง reconnect ใน n8n UI
- ⚠️ KM log metadata bug: vendor_code/layout_id/doc_type = "unknown" in top-level (ocr_bills has correct values) — not fixed yet

### Key Context
- Date fix root cause: repair step (second Gemini call) converted Thai year 2568→2025 but kept ISO format "2025-01-25" → normalizeDateTh() converts any YYYY-MM-DD → DD/MM/YYYY
- Caltex admin feedback case `1773393283437-4e524126ae3f3`: 75% accuracy → main issue was invoice_date_th format (now fixed)
- T054 spec at `docs/collab/tasks/T054-ocr-coverage-pdca-loop-hardening.md` — authored by Codex 2026-03-13

### Next Actions
1. Test: send Caltex bill again → verify invoice_date_th now outputs "25/01/2025" (DD/MM/YYYY)
2. CC review T054 spec → assign Codex to implement
3. Fix KM log metadata bug: Code(Prepare KM Log Payload) in `ztJ8oCBHREUPPry6` reads vendor_code from diff result instead of ocr_bills[0]
4. Optionally: fix 1st nexgen example layout_id via examples-api reject+recreate
