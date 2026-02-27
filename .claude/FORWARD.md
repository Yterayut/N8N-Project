# Forward Handoff — 2026-02-27

## Last Checkpoint — 14:05

- ✅ `/health` Telegram fixed — removed chatIds filter + toggled workflow off/on
- ✅ GG Data (OCR_EXAMPLES) Switch bug fixed — `numberOutputs: 5` (was defaulting to 4; param name NOT `outputsAmount`)
- ✅ T041C merged + CC review 9/10; Typhoon fallback live both paths; `nowISO()` Thai time patched
- ⏭️ Next: investigate RUNTIMERULES=true safety + main OCR child_process errors (pre-patch, may be resolved)

---

## Session Context (2026-02-27 this session)

### T041B — Typhoon OCR Fallback (GLM5 replacement)
- **Decision:** Replace GLM5 completely with Typhoon (Option A) — queue path only
- **Typhoon endpoint:** `POST https://api.opentyphoon.ai/v1/ocr` — multipart PDF
  - Returns: `{choices:[{message:{content:"Thai natural_text..."}}]}`
  - 8/12 PDFs OK, timeout: บิลค่าไฟ/fleetcard/ritta
- **TYPHOON_API_KEY:** `sk-y51g5dvThq...` added to `.env`
- **GLM5 node IDs to REMOVE:** `e74dd7c5` (Prepare), `429f34a0` (HTTP), `a1ae9c75` (Reshape)
- **Spec:** `docs/collab/tasks/T041B-typhoon-fallback.md`
- **Architecture:** Code (Prepare: binary pass-through) → HTTP (Typhoon multipart) → Code (Reshape: regex → bills → Gemini format) → Code (Parse Result) [input 1]

### GLM5 Key Change (this session)
- `GLM5_API_KEY` changed to `f76e6a4351954440bcea9bece91ba3a1.DOEFaMMqEY51QC0o`
- GLM5 issues: `glm-5` text-only, sandbox blocks child_process for PDF→JPEG

### T040 Background
- T040 APPROVED 7/10 — GLM5 fallback wired in queue path
- T1 exec `153492` ✅ (Gemini OK); T2 blocked (Zhipu AI credits)
- Codex respond T040 still pending: `./scripts/collab/codex-exec.sh respond T040`

---

## Pending After T041B Completes

1. CC review T041B → `docs/collab/reviews/T041B-review.md`
2. Merge agents/codex → stable
3. T041C spec: Direct path (`/ocr-dev`) Typhoon fallback
4. Codex respond T040 (backlog)

---

## Uncommitted Changes
- `.env` has TYPHOON_API_KEY added (not tracked — .gitignore'd)
- `.tmp/`, `cookie.txt`, `tmp/` — gitignored

## Last Checkpoint — 17:12
- ✅ KM Rules review done: 13 → 6 active (7 GG no-op rules set inactive, priority dup fixed, row14 approved_by filled)
- ✅ Active rules: rule-v1(100), v4(90), v2(80), v3(70), elec-ft-zero(60), fleetcard-qty(55)
- ⏭️ Next: dead node cleanup (ocr-training 4 dead nodes) or Typhoon timeout investigation

## Last Checkpoint — 17:18
- ✅ Dead node cleanup: ocr-training 122→118 nodes (4 orphans removed)
- ✅ KM Rules: 13→6 active
- ⏭️ Next: Typhoon timeout (A) or Codex respond T041C (E)

## Last Checkpoint — 17:45
- ✅ T042 OCR Dashboard live: GET /webhook/ocr-dashboard?key=...
- ✅ Data: Accuracy 70%(n=15), Field errors 77, KM rules 6 active
- ✅ Fixed: switched from internal fetch() → GSheets nodes (fix for sandbox block)
- ⏭️ Next: write T042 review + Typhoon timeout (A)
