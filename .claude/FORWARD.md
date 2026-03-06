# Forward Handoff — 2026-03-01

## Where We Are
- Branch: `stable`
- Last commit: `25ecfed` docs(retro): session retrospective 2026-03-01-t044-single-source-of-truth
- Phase: T044 COMPLETE — no active task

---

## What Was Accomplished This Session

| Commit | Task | Result |
|--------|------|--------|
| `3c2b912` | T044 Step A: gg-data-gateway VENDOR_MAP | Code(VENDOR_MAP) node + Switch output 6 + spec written ✅ |
| `2bd7884` | T044 Phase 1+2+3 (Codex) | ocr-km-logger enrichment + ocr-training enrichment + ocr-km-suggest KPI grouping ✅ |
| `6967c98` | T044 Phase 4 (CC) + hot-fixes | Dashboard → TRAIN_CASES, buildAccuracyStats bug fixed, 73.2% accuracy live ✅ |
| `cb9f852` | HANDOFF cleanup | T044-Phase4 removed from Pending, added to Recently Completed ✅ |
| `25ecfed` | /rrr retrospective | `docs/collab/retrospectives/2026-03-01-t044-single-source-of-truth.md` ✅ |

### Session highlights
- **T044 Single Source of Truth**: TRAIN_CASES เป็น single source — ทุก row มี doc_type + vendor_name + ocr_accuracy_pct
- **gg-data-gateway VENDOR_MAP**: Code node hardcoded 5 vendors (Caltex, PT MAX LPG, Succo/Socco, PTT/OR, Shell)
- **CC bug catch**: Codex's `Number('') = 0` — blank ocr_accuracy_pct ถูกนับเป็น 0% แทนที่จะ skip → fixed before merge
- **Dashboard live**: 73.2% (19 scored / 39 total bills), fuel=85.0%, other=70.0%
- **FIELD_DIFFS analysis**: missing (158) = early training data ไม่ใช่ OCR bug; extra (17) = doc_type mismatch; wrong_value (21) = real OCR errors

---

## What To Do Next (In Order)

1. **(Optional / Low priority)** Backfill 13 historical `telegram_train` rows ที่มี blank `ocr_accuracy_pct` ใน TRAIN_CASES
   - Logic: ดึง diff_count จาก FIELD_DIFFS โดย match case_id → คำนวณ `(4 - min(diff_count, 4)) / 4 * 100`
   - Sheet: `OCR_TRAIN_CASES`, column `ocr_accuracy_pct`

2. **(Medium)** Fix Telegram notify `chat_id is empty` ใน ocr-km-suggest
   - Workflow: `NkKd02QyzLRcpIJM`
   - ตรวจ `Code (Build Telegram)` — chat_id source ไม่ถูก resolve

3. **(Low)** เพิ่ม `source` column ใน FIELD_DIFFS rows — ตอนนี้ทุก row มี source='' ทำให้ไม่รู้ว่า error มาจาก feedback_kpi หรือ telegram_train

4. **T030** Supabase migration — still deferred

---

## Pending Tasks (from HANDOFF.md)

| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T030 | Supabase migration (proposal ready) | — | Deferred |

---

## Uncommitted Changes

| File | Status | Content |
|------|--------|---------|
| `.claude/FORWARD.md` | M | This file (being written now) |
| `docs/collab/HANDOFF.md` | M | Last Sync timestamp update |
| `scripts/pdf2jpg_glm.mjs` | ?? | Untracked — script สำหรับ PDF→JPG (pre-existing, not session work) |

---

## Context That Took Time To Build (Don't Lose)

### Number('') = 0 — JavaScript silent gotcha
- `Number('') === 0` และ `!Number.isNaN(Number('')) === true` → blank string ถูกนับเป็น 0 โดยไม่ error
- **Pattern บังคับ:** เช็ค `rawVal === '' || rawVal === null || rawVal === undefined` ก่อน `Number(rawVal)` เสมอ
- พบใน `buildAccuracyStats()` ของ ocr-km-suggest — Codex พลาด, CC ต้อง hot-fix

### Shell quoting `!` in bash
- `"ocm-cabonrecipte!"` ใน double quotes → `!` ถูก bash history expand → 401 unauthorized
- **Fix:** ใช้ single quotes เสมอ: `curl -H 'x-api-key: ocm-cabonrecipte!'`

### VENDOR_MAP GSheets sheet ไม่ถูกสร้าง
- `operation: "create"` บน googleSheets node โดยไม่ระบุ `resource: "sheet"` → สร้าง spreadsheet ใหม่แทน tab
- **Workaround:** ใช้ `Code` node return hardcoded array แทน GSheets Read

### gg-data-gateway auth — header ไม่ใช่ query param
- Auth: `x-api-key` header (ไม่ใช่ `?key=`)
- แต่ ocr-dashboard ใช้ `?key=` query param — คนละ workflow คนละ auth pattern

### FIELD_DIFFS insight (2026-03-01)
- missing (158/197) = early training sessions ก่อน T043/T041 — OCR คืนค่าว่าง, user fill ทีหลัง
- extra (17/197) = doc_type=other แต่ OCR คืน items[] → user clear ออก (schema mismatch ไม่ใช่ bug)
- wrong_value (21/197) = real OCR errors ที่ควรใช้ improve prompt

### Dashboard URL
- Localhost: `http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!`
- Internet: `https://rapturously-streamlined-king.ngrok-free.dev/webhook/ocr-dashboard?key=ocm-cabonrecipte!`

---

## Key Workflow IDs (reference)

| Workflow | ID |
|----------|----|
| ocr-invoice-processor | `up1n75qEhbsXswii` |
| ocr-km-logger | `jmJHPPj0OM5LcZ0n` |
| ocr-km-suggest | `NkKd02QyzLRcpIJM` |
| ocr-training | `KW0QRXxRh9MjdPaY` |
| ocr-dashboard | `FsMOrto8DmG1LYjD` |
| gg-data-gateway | `XtaSg9pLDuPERtI8` |
| gg-notify-gateway | `YZTJwkh25isaLKHo` |
| gg-health-monitor | `BlCrCNITw9ThtfOx` |

---

## Commands To Run First

```bash
# 1. Verify state
git log --oneline -5
./scripts/verify_nowThai_sync.sh

# 2. Quick dashboard check
curl -s 'http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!' | grep -o "Overall Accuracy.*scored"

# 3. ดู FIELD_DIFFS ด้วย correct quoting
curl -s "http://localhost:5678/webhook/gg-data?sheet=FIELD_DIFFS" \
  -H 'x-api-key: ocm-cabonrecipte!' | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), 'rows')"
```

---

## Last Checkpoint — 2026-03-06 (mid-session)
- ✅ T051: backfill vendor_name TRAIN_CASES — blank=2, raw=0, T032 excluded
- ✅ T052C: bug fix — `inferredType` alias removed, exec 158066 success
- ✅ T052A: review 8/10 APPROVED — 89% true baseline, minor: ocr-training missing case_class
- ✅ T052B: review 9/10 APPROVED — canonical routing live, PTT OR consolidated
- ⏭️ T052C review: write formal review file (bug fixed this session)
- ⏭️ T052D/E/F reviews: pending
- ⏭️ PTG missing from canonical map: add to next window

## Last Checkpoint — 2026-03-03 (session close)
- ✅ T048: Telegram chat_id fallback fixed ใน ocr-km-suggest
- ✅ T049: MEA เพิ่มใน VENDOR_MAP (3 workflows) + FIELD_DIFFS excluded_test=16, wrong_value=21
- ✅ T050: ocr-kpi-report migrated → OCR_TRAIN_CASES; exec 155925 → overall=97%, 33 scored, fuel=31 ✅
- ✅ Daily health fixes: OCM-Chat-BOT continueOnFail, POC schema, GSheets→Supabase continueOnFail, GG Health timeout 60s
- ✅ wait-for-codex.sh: background polling script สำหรับ CC auto-detect Codex completion
- ✅ LESSON-017: consumer audit บังคับเมื่อ migrate data source
- ⏭️ PAY workflow: OAuth expired — user ต้อง re-auth credential `IYyt3qEQVk3xfjcF` "Google Drive account" ใน n8n UI
- ⏭️ Electricity/fleet_card ต้องการ training data เพิ่ม

### PT MAX LPG bill observation (for future prompt improvement)
- `quantity: 18.76172607879925` = back-calculated (300÷15.99) — ไม่ได้อ่านจากบิล
- `Customer Name: "มจ. ฤทธา จากัด"` — ผิด: ควรเป็น "บจ. ฤทธา จำกัด" (OCR misread บ→ม, ำ→า)
- User confirmed "ถูก" → recorded as 100% accurate (training signal may be slightly noisy)

## Key Learnings This Session
- **Bash `!` escaping via Claude Code tool**: แม้จะใช้ single quotes ใน curl, bash ก็ escape `!` เป็น `\!` ผ่าน Claude Code Bash tool → ใช้ Python urllib แทน curl เสมอเมื่อส่ง header ที่มี `!`
- **GSheets Update matchingColumns**: `columns.value` ต้องรวม matching column ด้วย (e.g. `case_id: '={{ $json.case_id }}'`) ไม่งั้น error "Column to Match On required"
- **n8n execution data format**: compact refs (data[N]) — ใช้ SQLite `execution_data` ไม่ใช่ REST API (REST API แสดง 0 เสมอถ้า pagination issue)
