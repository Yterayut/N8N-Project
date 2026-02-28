# Forward Handoff — 2026-02-27

## Where We Are
- Branch: `stable`
- Last commit: `a69562e` fix(T042): switch to GSheets nodes instead of internal fetch()
- Phase: Health fixes + Dashboard ✅ — Typhoon timeout pending

---

## What Was Accomplished This Session

| Commit | Task | Result |
|--------|------|--------|
| `1b0dae2` | Fix gg-data Switch `numberOutputs:5` | OCR_EXAMPLES routes correctly ✅ |
| `962dc9a` | KM Rules: 13→6 active + ocr-training 122→118 nodes | Cleanup complete ✅ |
| `e560bed` | T041C review loop closed (Codex respond) | Lesson: multi-layer fallback needs 3-case test ✅ |
| `60515ba` | T042 spec written | Spec at `docs/collab/tasks/T042-ocr-dashboard.md` |
| `102cfa7` | T042 Codex implement | Workflow `FsMOrto8DmG1LYjD` created ✅ |
| `a69562e` | T042 fix: internal fetch() → GSheets nodes | Data now shows real values ✅ |

### Today's session highlights
- **KM Rules review**: 7 GG no-op rules deactivated (rule_type=""), 6 active remain
- **Dead node cleanup**: 4 orphaned nodes removed from ocr-training
- **T042 OCR Dashboard live**: HTML dashboard accessible via ngrok
- **Key gotcha found**: `fetch()` inside n8n Code node is sandbox-blocked → use HTTP Request nodes or GSheets nodes instead

---

## T042 Dashboard — Live Status

**URL (localhost):** `http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!`
**URL (internet):** `https://rapturously-streamlined-king.ngrok-free.dev/webhook/ocr-dashboard?key=ocm-cabonrecipte!`

**Workflow ID:** `FsMOrto8DmG1LYjD` | **Nodes:** 7 (Webhook → Code(Auth) → 3×GSheets → Code(Build HTML) → Respond)

**Data shown:**
- Accuracy by doc_type: 70.0% overall (n=15 feedback)
- Field errors: 77 total (from FIELD_DIFFS)
- Active KM Rules: 6
- 7-day volume: graceful empty (sqlite3 CLI blocked in n8n Code sandbox)

**Known limitation:** SQLite execution volume section empty — `child_process` blocked in n8n v1.123.20 Code node sandbox. Options if needed: (a) add separate SQLite query script as HTTP endpoint, (b) use n8n execution stats API with Basic Auth from HTTP Request node.

---

## Pending Tasks

| ID | Task | Priority |
|----|------|----------|
| T042 review | Write CC review for T042 | Medium |
| **A** | Typhoon timeout — บิลค่าไฟ/fleetcard/ritta 8/12 only | High |
| T030 | Supabase migration | Deferred |

---

## What To Do Next (In Order)

1. **Write T042 review** (`docs/collab/reviews/T042-review.md`) — short, close the loop
2. **Typhoon timeout (A)** — investigate which doc types timeout (บิลค่าไฟ, fleetcard, ritta)
   - Start: check last few executions where Typhoon was used, look at timeout error pattern
   - Hypothesis: Typhoon timeout = 30s default, บิลค่าไฟ multi-page PDFs take longer
3. **Dashboard volume fix (optional)** — expose SQLite via small shell script webhook or use n8n REST executions endpoint

---

## Context That Took Time To Build (Don't Lose)

### n8n Code node sandbox limits (discovered 2026-02-27)
- `require('child_process')` → **BLOCKED** in n8n v1.123.20 Code node sandbox
- `fetch()` → also blocked (internal calls to localhost:5678 from Code node fail silently — returns empty array)
- **Fix pattern**: use `n8n-nodes-base.googleSheets` nodes for Sheets data, `n8n-nodes-base.httpRequest` for HTTP calls
- When Code node needs external data → **always use dedicated n8n nodes, not fetch()/child_process**

### n8n Switch node (PATTERN-016)
- `numberOutputs: N` — NOT `outputsAmount` — controls output count (default=4)
- Fixed gg-data-gateway OCR_EXAMPLES routing

### KM Rules sheet column mapping
- E=status, K=rule_key, N=approved_by
- Active check: `source_lesson_id==='active'` OR `rule_value===TRUE/Y` (not `status==='active'`)
- 6 active rules after cleanup: priorities 100, 90, 80, 70, 60, 55

### Dashboard architecture
```
Webhook → Code(Auth) → GSheets(FEEDBACK) ─┐
                     → GSheets(FIELD_DIFFS) ─┤→ Code(Build HTML) → Respond(HTML)
                     → GSheets(KM_RULES) ──┘
```
Multi-input to Code(Build HTML): reads via `$('GSheets (OCR_FEEDBACK)').all()`

### ngrok domain (active)
- `rapturously-streamlined-king.ngrok-free.dev` → localhost:5678

---

## Commands To Run First

```bash
# 1. Verify state
git log --oneline -5
./scripts/verify_nowThai_sync.sh

# 2. Quick dashboard check
curl -s "http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!" | grep -o "Overall Accuracy.*n=[0-9]*"

# 3. Write T042 review then move to Typhoon timeout
```

---

## Uncommitted Changes
- `docs/collab/HANDOFF.md` — modified (FORWARD commit will clear this)

---

## Last Checkpoint — 2026-02-28
- ✅ T042 dashboard live
- ✅ Caltex swap fix: `Respond to Webhook6` now overrides `data.bills` with `$json.bills` (corrected by vendorCorrections)
- ✅ Telegram webhook stable: restart-telegram-triggers.sh cycles only (n8n handles setWebhook+secret)
- ✅ KM suggest: telegram_train threshold=1, auto-approved
- ⏭️ Test Caltex bill via Telegram to confirm swap fix → write T042 review → Typhoon timeout
