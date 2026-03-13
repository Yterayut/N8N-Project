## Last Checkpoint — 2026-03-13 BKK

### Git State
- Branch: `stable`
- Last commit: `c955a4f docs(retro): session retrospective 2026-03-12-health-kpi-analysis`

### Status
- ✅ GG ground truth for nexgen/INET bill complete — `docs/gg/proposals/2026-03-13-groundtruth-nexgen_actual.json`
- ✅ INET (0105561072420) in VENDOR_MAP all 3 workflows — layout=inet_nexgen_v1, vendor_code=inet
- ✅ Training examples active: `ex_1773338904205_234d` (active=true, active_for_prompt=true) + 1 more
- ✅ TRAIN_CASE: `tc_1773338906718_xs0a2r` (nexgen bill, 2026-03-12)
- ⚠️ 1st nexgen example has wrong layout_id=ptt_or_fuel_v1 (should be inet_nexgen_v1) — minor
- ⚠️ T054 spec pending CC review — key action needed
- ⚠️ POC + PAY Google OAuth expired — Yut ต้อง reconnect ใน n8n UI

### Key Context
- GG confirmed buyer_tax_id=0107544000094 (INET PCL) — not in current OCR examples
- Training loop exec 161139 created example after Yut sent corrections via Telegram
- T054 spec at `docs/collab/tasks/T054-ocr-coverage-pdca-loop-hardening.md` — authored by Codex 2026-03-13
- OCR system healthy — 0 errors since 2026-03-07

### Next Actions
1. CC review T054 spec → assign Codex to implement
2. Optionally: fix 1st nexgen example layout_id via examples-api reject+recreate
3. Test T054 T1: POST nexgen bill → expect coverage_status=learning, few_shot_count>0
