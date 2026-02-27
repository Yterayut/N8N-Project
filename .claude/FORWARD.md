# Forward Handoff — 2026-02-27

## Last Checkpoint — 11:20

- ✅ T041C merged (Codex) + CC review 9/10 APPROVED — Typhoon fallback live on BOTH queue + direct paths
- ✅ normalize fix applied: `customer_name_th`, `item_unit_price`, `item_quantity`, `item_description_th`
- ✅ `nowISO()` patched → `+07:00` Thai ISO in 5 Code nodes; `GENERIC_TIMEZONE=Asia/Bangkok` in `.env`
- ⏭️ Next: recommend T041D (review + plan next priorities) or user-directed

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
