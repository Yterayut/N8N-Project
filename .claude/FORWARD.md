## Last Checkpoint — 2026-03-13 BKK (session 3)

### Git State
- Branch: `stable`
- Last commit: `7935d0c chore(handoff): date-decimal-fixes complete + 4 bad examples rejected`

### Status
- ✅ Date normalization fix deployed — `normalizeDateTh()` in Code(Normalize+Validate)
- ✅ Decimal fix deployed — `round3()` for unit_price/quantity/amount
- ✅ 4 bad examples rejected (from Yut's 0% accuracy test)
- ✅ `Code (Build Request)` strengthened — explicit no-copy rule for invoice_number/invoice_date_th/total_amount
- ✅ 2 stale Caltex examples updated — `invoice_date_th` from "2025-01-25" → "25/01/2568"
- ⚠️ KM log metadata bug: vendor_code/layout_id/doc_type = "unknown" in top-level — not fixed
- ⚠️ T054 spec pending CC review
- ⚠️ POC + PAY Google OAuth expired — Yut ต้อง reconnect ใน n8n UI
- ⚠️ First nexgen example layout_id=ptt_or_fuel_v1 (wrong, should be inet_nexgen_v1) — minor

### Key Context
- Invoice contamination root cause: few-shot examples contain real `invoice_number` values in gold_json → Gemini copies them. Fix: stronger prompt rule + correct example dates
- 2 Caltex examples still had ISO date "2025-01-25" in gold_json (pre-date-fix artifacts) — now corrected
- Test suggestion: send Caltex bill `S1731125012511010003` via admin feedback again to verify 100%

### Next Actions
1. Test: send same Caltex bill (the 75% one) again → verify invoice_number extracted correctly from document
2. CC review T054 spec → assign Codex to implement
3. Fix KM log metadata bug: Code(Prepare KM Log Payload) in `ztJ8oCBHREUPPry6` reads vendor_code from diff result instead of ocr_bills[0]
4. Optionally: fix 1st nexgen example layout_id via examples-api reject+recreate
