## Last Checkpoint — 2026-03-14 BKK (session 1)

### Git State
- Branch: `stable`
- Last commit: `3944b7a chore(forward): T054 merged stable — CC merge approval complete`

### Status
- ✅ T054 complete — merged agents/codex → stable, CC merge approval done
- ✅ 5 workflows patched by Codex: XtaSg9pLDuPERtI8, up1n75qEhbsXswii, KW0QRXxRh9MjdPaY, ztJ8oCBHREUPPry6, yCqvdl3vrHGgiBMt
- ✅ KM log metadata bug fixed (Phase 4 — ocr_bills[0] priority in ztJ8oCBHREUPPry6)
- ✅ Two-pass few-shot selector deployed (strict pass-1 → relaxed pass-2 for new vendors)
- ✅ Telegram correction parser hardened (allowlist + truncation + invalid-key rejection)
- ⚠️ OCR_COVERAGE_REGISTRY sheet tab NOT created yet — gg-data-gateway using fallback default rows
- ⚠️ Nexgen E2E happy-path (few_shot_count>0 + non-empty customer/address) not passing — exec 161890
- ⚠️ POC + PAY Google OAuth expired — Yut ต้อง reconnect ใน n8n UI
- ⚠️ First nexgen example layout_id=ptt_or_fuel_v1 (wrong, should be inet_nexgen_v1) — minor

### Key Context
- T054 PARTIAL PASS: core hardening deployed, remaining=sheet tab creation + nexgen E2E
- Coverage fallback active: gg-data-gateway returns hardcoded 13 vendors at status=learning until real tab exists
- Two-pass selector: if pass-1 returns 0 examples → pass-2 uses relaxed vendor (any layout). continueOnFail=true on both HTTP nodes
- KM log bug fixed: vendor_code/layout_id/doc_type now read from ocr_bills[0] not diff result

### Next Actions
1. Create `OCR_COVERAGE_REGISTRY` tab in OCM-INFRA spreadsheet (12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0) with 13 vendor rows — CC or Yut (manual in Google Sheets or via gg-data-gateway Sheets node)
2. Debug nexgen E2E: check exec 161890 to see why few_shot_count=0 + customer/address empty
3. Optionally: fix 1st nexgen example layout_id via examples-api reject+recreate
4. Yut: reconnect POC+PAY Google OAuth in n8n UI
