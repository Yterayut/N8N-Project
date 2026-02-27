# Forward Handoff — 2026-02-27

## Where We Are
- Branch: `stable`
- Last commit: `cc2b8d9` chore: final sync log 2026-02-27 session end
- Phase: **T040 APPROVED WITH CONDITIONS** — GLM5 fallback wired, T2 pending Zhipu AI top-up

---

## What Was Accomplished This Session

### T040 — GLM5 (Zhipu AI) Fallback OCR (queue path)
- **Phase 0 (CC):** `GLM5_API_KEY` + `GLM5_MODEL=glm-5` ใน `.env`; spec `T040-glm5-fallback.md` ครบ
- **Codex discuss:** ยืนยัน binary node = `Download file`/field `data`; lock scope = queue path only
- **Codex implement (`be7d99b`):** 4 nodes เพิ่ม + connections + fallback tracking fields ใน `Code (Parse Result)`
- **CC fixes:** rawContentType bug, JWT HS256 auth, model `glm-4v` → `glm-5` (only available)
- **Review:** `docs/collab/reviews/T040-review.md` — **7/10 APPROVED WITH CONDITIONS**
- **PATTERN-015** เพิ่มใน `docs/collab/knowledge/n8n-patterns.md`

### Test Results This Session
| Test | Exec | Status |
|------|------|--------|
| T1: Gemini OK path | `153492` | ✅ `fallback_used=false`, `bills_count=1` |
| T3: Both fail graceful | `153475/153477` | ✅ `status=error` ไม่ crash |
| verify_nowThai_sync | — | ✅ |
| T2: GLM5 success | — | ⚠️ **blocked** — Zhipu AI error 1113 (no credits) |

---

## Current State of Key Files

| File | Status | Notes |
|------|--------|-------|
| `.env` | Changed | `GLM5_API_KEY=96d8029d...`, `GLM5_MODEL=glm-5` added |
| `.env.example` | Committed | GLM5 vars documented |
| `docs/collab/tasks/T040-glm5-fallback.md` | Committed | Spec with Discussion + Closing Template filled |
| `docs/collab/reviews/T040-review.md` | Committed | 7/10, Codex Response section blank (pending) |
| `docs/collab/HANDOFF.md` | Committed | T040 in Recently Completed, T2 pending noted |
| `docs/collab/knowledge/n8n-patterns.md` | Committed | PATTERN-015 added (JWT auth, rawContentType, models list) |
| Live workflow `up1n75qEhbsXswii` | **PATCHED** | 4 new nodes on queue path, Gemini URL restored |

---

## What To Do Next (In Order)

### 1. Top up Zhipu AI account → re-run T2 test
```bash
# Login to open.bigmodel.cn → add credits
# Then test fallback (force Gemini fail, manual run):
# 1. Login n8n:
curl -sS -c /tmp/cookie.txt -X POST http://localhost:5678/rest/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"yterayut@gmail.com","password":"Marn2530"}'

# 2. Patch Gemini URL to invalid (test only):
# GET workflow, change HTTP (GenerateContent) url to "invalid-model", PATCH back

# 3. Queue file + trigger manual run:
curl -X POST http://localhost:5678/webhook/ocr-queue \
  -H "x-api-key: ocm-cabonrecipte!" \
  -F "file=@agents/codex/file/susco.pdf;type=application/pdf"
# Then trigger Schedule Trigger manual run

# Expected: fallback_used=true, fallback_status=success, bills_count >= 1
```

### 2. Codex respond T040
```bash
./scripts/collab/codex-exec.sh respond T040
```
แล้ว CC fill Merge Approval ใน `docs/collab/reviews/T040-review.md`

### 3. T040B spec — Direct path coverage
Direct path (`/ocr-dev`) ยังไม่มี Gemini fallback — เขียน spec T040B ซึ่งจะ patch:
- Node ที่ใช้ Gemini บน direct path (ต่างจาก queue path)
- CC ต้องระบุว่า node ชื่ออะไรบน direct path ก่อนเขียน spec

---

## Pending Tasks (from HANDOFF.md)

| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T040B | Direct path (`/ocr-dev`) GLM5 fallback | Codex | T040 merged |
| T030 | Supabase migration (proposal ready) | — | Deferred |

---

## Uncommitted Changes
ไม่มี — clean working tree (ยกเว้น `.tmp/`, `cookie.txt`, `tmp/` ที่ใน .gitignore)

---

## Context That Took Time To Build (Don't Lose)

### Zhipu AI API Key Format — CRITICAL
- Key format `hex.secret` = **OLD FORMAT** → ต้อง generate JWT HS256 ก่อนใช้ (ไม่ใช่ direct Bearer)
- JWT headers: `{"alg": "HS256", "sign_type": "SIGN"}`
- JWT payload: `{"api_key": id, "exp": now_ms + 3600000, "timestamp": now_ms}`
- ใน Code node: `require('crypto')` + `createHmac('sha256', secret).update(header+'.'+payload).digest('base64url')`
- HTTP node ใช้: `=Bearer {{ $json._glm5_jwt }}` (จาก Code node output)
- NEW format keys (longer string) อาจใช้ direct Bearer ได้ — ขึ้นอยู่กับ account

### Zhipu AI Available Models (2026-02, this account)
`glm-4.5`, `glm-4.5-air`, `glm-4.6`, `glm-4.7`, `glm-5`
**ไม่มี:** `glm-4v`, `glm-4v-plus`, `glm-4v-flash` (naming convention เปลี่ยน)
`glm-5` รองรับ multimodal (vision) — ใช้ `image_url` type ใน messages content

### n8n HTTP Raw Node Content-Type GOTCHA
- `contentType: "raw"` → ส่ง `application/octet-stream` โดย default
- Custom `Content-Type` header ใน headerParameters **ไม่ override** body mime type
- **Fix:** เพิ่ม `rawContentType: "application/json"` ใน parameters ตรงๆ

### Queue Path vs Direct Path
Workflow `up1n75qEhbsXswii` มี 2 Gemini paths:
- **Queue path** (T040 patched): `Download file` → `HTTP (Upload to Gemini)` → `HTTP (GenerateContent)` → `Code (Parse Result)`
- **Direct path** (T040B needed): `HTTP Upload File5` → `Code in JavaScript9`

### n8n Service Management
- n8n รันเป็น systemd user service: `systemctl --user restart n8n.service`
- `.env` ถูก load ตอน startup → ต้อง restart เมื่อเพิ่ม env var ใหม่
- EnvironmentFile: `/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.env`
- Verify env loaded: `cat /proc/$(systemctl --user show n8n.service -p MainPID --value)/environ | tr '\0' '\n' | grep GLM5`

### Queue Worker Manual Trigger
```python
# Load full workflow, set as workflowData body
wf = requests.get(...).json()['data']
body = {
    'workflowData': wf,
    'destinationNode': {'nodeName': 'Code  Set Done'},  # double space!
    'triggerToStartFrom': {'name': 'Schedule Trigger'}
}
requests.post('.../rest/workflows/up1n75qEhbsXswii/run', json=body)
```
**Note:** `destinationNode` ต้องเป็น `'Code  Set Done'` (2 spaces ในชื่อ)

---

## Commands To Run First (Next Session)
```bash
# 1. Resume dev session
dev   # หรือ tmux attach -t dev

# 2. Check current state
cat docs/collab/HANDOFF.md | head -60

# 3. Verify workflow is healthy (Gemini URL restored)
source .env
curl -sS -c /tmp/cookie.txt -X POST http://localhost:5678/rest/login \
  -H "Content-Type: application/json" \
  -d "{\"emailOrLdapLoginId\":\"yterayut@gmail.com\",\"password\":\"Marn2530\"}"
curl -sS -b /tmp/cookie.txt "http://localhost:5678/rest/workflows/up1n75qEhbsXswii" | \
  python3 -c "import json,sys; wf=json.load(sys.stdin)['data']; [print(n['name'],':',n['parameters'].get('url','')[:60]) for n in wf['nodes'] if 'GenerateContent' in n['name']]"

# 4. If Zhipu AI topped up → run T2 test
```

---

## Last Checkpoint — 07:15
- ✅ T040 APPROVED (7/10) — GLM5 fallback queue path live, JWT auth, glm-5 model
- 🔄 T2 test blocked — Zhipu AI account has no credits (error 1113)
- ⏭️ Top up Zhipu AI → re-run T2 → Codex respond T040 → T040B spec
