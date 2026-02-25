# T034 — GG Agent Health Check Endpoint

**Author:** Claude Code (CC) — DRAFT by GG, revised by CC
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** Medium
**Risk:** ต่ำ — workflow ใหม่แยกต่างหาก ไม่แตะ workflows เดิม
**Depends on:** T033 (GG Webhooks) ✅

---

## Overview

GG agent มี 6 roles ทำงานอัตโนมัติ (cron + on-demand) แต่ยังไม่มีวิธีตรวจว่า infrastructure ของ GG พร้อมทำงานหรือไม่ Task นี้สร้าง health check endpoint `GET /webhook/gg-health` ที่ตรวจ Gemini CLI, scripts, directories, และ data gateway — คืน JSON report สำหรับ monitoring

---

## Scope

**In scope:**
- สร้าง script `scripts/gg/gg-health.sh` — รัน checks และ output JSON
- สร้าง n8n workflow `gg-health-monitor` (GET /webhook/gg-health)

**Out of scope:**
- Auto-healing / re-auth
- Dashboard หรือ alerting (monitoring only สำหรับ phase นี้)

---

## Technical Spec

### Part 1: `scripts/gg/gg-health.sh`

Script source `scripts/gg/common.sh` แล้วรัน checks ต่อไปนี้:

```bash
#!/bin/bash
# Role: Health Check — ตรวจ GG infrastructure
GG_ROLE="health"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

RESULT='{"status":"ok","timestamp":"'"$TIMESTAMP"'","agent":"GG (Gemini)","checks":{}}'

check_cli() {
  local version
  version=$(gemini --version 2>/dev/null | head -1) && \
    echo '{"status":"ok","version":"'"$version"'"}' || \
    echo '{"status":"fail","version":null}'
}

check_api() {
  local t0 t1 ms
  t0=$(date +%s%3N)
  gemini -p "ping" --output-format text >/dev/null 2>&1 && STATUS="ok" || STATUS="fail"
  t1=$(date +%s%3N); ms=$((t1-t0))
  echo '{"status":"'"$STATUS"'","latency_ms":'"$ms"'}'
}

check_scripts() {
  local scripts=("common.sh" "gg-synthesize.sh" "gg-groundtruth.sh" "gg-prompt-engineer.sh" "gg-spec-draft.sh" "gg-validate.sh" "gg-curate.sh")
  local ok=0 missing=()
  for s in "${scripts[@]}"; do
    if [ -x "$SCRIPT_DIR/$s" ]; then ((ok++)); else missing+=("$s"); fi
  done
  local status="ok"
  [ ${#missing[@]} -gt 0 ] && status="warn"
  echo '{"status":"'"$status"'","found":'"$ok"',"missing":'"$(printf '%s\n' "${missing[@]}" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().splitlines()))')"'}'
}

check_storage() {
  local status="ok"
  touch "$PROPOSALS_DIR/.write_test" 2>/dev/null && rm -f "$PROPOSALS_DIR/.write_test" || status="fail"
  touch "$REPORTS_DIR/.write_test" 2>/dev/null && rm -f "$REPORTS_DIR/.write_test" || status="fail"
  echo '{"status":"'"$status"'","writable":'"$([ $status = ok ] && echo true || echo false)"'}'
}

check_data_gateway() {
  local result
  result=$(curl -sf --max-time 5 \
    -H "x-api-key: ${OCR_SHARED_API_KEY:-}" \
    "$GG_DATA_WEBHOOK?sheet=TRAIN_CASES" 2>/dev/null)
  [ $? -eq 0 ] && \
    echo '{"status":"ok","rows":'"$(echo "$result" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)"'}' || \
    echo '{"status":"fail","rows":0}'
}

check_recent_errors() {
  local count=0
  [ -f "$LOGS_DIR/gg-error.log" ] && \
    count=$(awk -v d="$(date -d '24 hours ago' '+%H:%M:%S' 2>/dev/null || date -v-24H '+%H:%M:%S' 2>/dev/null || echo '00:00:00')" '$1 >= d' "$LOGS_DIR/gg-error.log" 2>/dev/null | wc -l) || true
  echo '{"recent_errors":'"$count"'}'
}

CLI=$(check_cli)
API=$(check_api)
SCRIPTS=$(check_scripts)
STORAGE=$(check_storage)
GATEWAY=$(check_data_gateway)
ERRORS=$(check_recent_errors)

# Aggregate status
OVERALL="ok"
echo "$CLI$API$SCRIPTS$STORAGE$GATEWAY" | grep -q '"status":"fail"' && OVERALL="fail"
echo "$CLI$API$SCRIPTS$STORAGE$GATEWAY" | grep -q '"status":"warn"' && [ "$OVERALL" = "ok" ] && OVERALL="warn"

python3 -c "
import json
print(json.dumps({
  'status': '$OVERALL',
  'timestamp': '$TIMESTAMP',
  'agent': 'GG (Gemini)',
  'checks': {
    'cli': $CLI,
    'api': $API,
    'scripts': $SCRIPTS,
    'storage': $STORAGE,
    'data_gateway': $GATEWAY,
    $(echo $ERRORS | python3 -c 'import sys; d=__import__(\"json\").loads(sys.stdin.read()); [print(f\"\\\"{k}\\\": {v},\") for k,v in d.items()]')
  }
}, indent=2))
"
```

**Expected output:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-26T10:00:00",
  "agent": "GG (Gemini)",
  "checks": {
    "cli": { "status": "ok", "version": "gemini v0.30.0" },
    "api": { "status": "ok", "latency_ms": 450 },
    "scripts": { "status": "ok", "found": 7, "missing": [] },
    "storage": { "status": "ok", "writable": true },
    "data_gateway": { "status": "ok", "rows": 8 },
    "recent_errors": 0
  }
}
```

Aggregate `status`:
- `ok` — ทุก check ผ่าน
- `warn` — มี script missing แต่ core ยังทำงานได้
- `fail` — CLI / API / gateway fail

---

### Part 2: n8n Workflow `gg-health-monitor`

**Nodes:**
```
Webhook (GET /webhook/gg-health)
  └─► Code (Auth Validate)
        └─► Execute Command (bash scripts/gg/gg-health.sh)
              └─► Respond to Webhook (JSON)
```

#### Webhook node:
- Method: `GET`
- Path: `gg-health`
- **ไม่ใส่ authentication** (ใช้ Code node แทน — ดู PATTERN ด้านล่าง)
- **ต้องมี `webhookId` field** (UUID ใหม่) ใน node parameters (PATTERN-008)

#### Code (Auth Validate):
```javascript
const apiKey = $input.first().json.headers['x-api-key'] || '';
const expected = $env.OCR_SHARED_API_KEY || '';
if (!apiKey || apiKey !== expected) {
  return [{ json: { error: 'unauthorized' }, statusCode: 401 }];
}
return [{ json: { authorized: true } }];
```

#### Execute Command node:
- Command: `bash /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/scripts/gg/gg-health.sh`
- `continueOnFail: true`

#### Respond to Webhook:
- Response Body: `{{ $json.stdout }}`
- Content-Type: `application/json`
- Status: 200

---

## Security Considerations

| จุด | Mitigation |
|-----|-----------|
| Expose system paths | ไม่ include absolute paths ใน JSON output — ใช้ relative หรือ status flag |
| Expose env vars | ไม่ include secret values ใน output — เฉพาะ status ok/fail |
| Unauthorized access | x-api-key auth via Code node |
| Command injection | Command hardcoded — ไม่รับ input จาก query params |

---

## Test Plan

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | No auth | `GET /webhook/gg-health` (ไม่มี key) | 401 |
| T2 | Healthy state | `GET /webhook/gg-health` + correct key | 200 + `status: "ok"` |
| T3 | Script missing | rename script ชั่วคราว แล้วรัน | `status: "warn"`, `scripts.status: "warn"` |
| T4 | JSON valid | ตรวจ output ด้วย `python3 -m json.tool` | parse สำเร็จ ไม่ error |

---

## Definition of Done

**Implemented:**
- [ ] `scripts/gg/gg-health.sh` สร้างแล้ว + executable (`chmod +x`)
- [ ] n8n workflow `gg-health-monitor` active (GET /webhook/gg-health)
- [ ] webhookId UUID บน Webhook node (PATTERN-008)

**Verified:**
- [ ] T1 ผ่าน (401 ไม่มี key)
- [ ] T2 ผ่าน (200 + valid JSON + status ok)
- [ ] T4 ผ่าน (JSON valid)

**Docs:**
- [ ] HANDOFF.md อัปเดต workflow ID ของ `gg-health-monitor`
- [ ] `docs/collab/GG.md` เพิ่ม health check endpoint

---

## Discussion
*(Codex pre-execution questions ใส่ที่นี่)*

Codex note before implementation:
- Spec diagram (`Webhook -> Code -> Execute Command -> Respond`) cannot return clean `401` for T1 by itself because unauthorized requests would still continue to `Execute Command`. Implemented with an added `IF (Authorized?)` + `Respond (401)` branch while preserving the intended auth + command + JSON response flow.
- `check_recent_errors()` draft logic assumed date-bearing log lines, but `common.sh` currently writes time-only lines (e.g. `[ERROR][HH:MM:SS] ...`). Implemented a best-effort 24h check using file mtime gate + line count.

---

## Codex Execution Notes (2026-02-26)

### Implemented
- Added `scripts/gg/gg-health.sh` (executable) to check Gemini CLI/API, GG scripts, storage write access, gg-data gateway, and recent error log count; outputs JSON with aggregate `ok|warn|fail`.
- Added timeout guard (`timeout 20s`) around Gemini API ping in health script to avoid webhook hangs.
- Created new n8n workflow `gg-health-monitor` (`BlCrCNITw9ThtfOx`) with:
  - `Webhook (gg-health)` GET + `webhookId=2ad4c423-b055-4323-ad28-635d1832400f`
  - `Code (Auth Validate)` using `x-api-key` vs `$env.OCR_SHARED_API_KEY` (timing-safe compare helper)
  - `IF (Authorized?)` + `Respond (401)` branch
  - `Execute Command (GG Health)` (`continueOnFail: true`)
  - `Code (Parse Health JSON)` + `Respond (health JSON)`
- Activated workflow via `POST /rest/workflows/{id}/activate` with `versionId` (this n8n build required `versionId`; `PATCH {\"active\":true}` alone did not persist active status).

### Verification evidence
- T1 (no auth): `GET /webhook/gg-health` -> `401 {"ok":false,"error":"unauthorized"}`
- T2 (correct key): `GET /webhook/gg-health` -> `200` + valid JSON, observed `status:"ok"` with `checks.api.latency_ms: 15816`
- T4 (JSON valid): parsed response body with `python3 -m json.tool` successfully
- T3 (optional script missing smoke): temporarily removed execute bit from `gg-curate.sh` -> response showed `status:"warn"` and `checks.scripts.status:"warn"`; restored execute bit
- n8n executions (workflow `BlCrCNITw9ThtfOx`): `151884` (T1), `151885` (T2), `151887` (T3 optional)

### Definition of Done (Completed)

**Implemented:**
- [x] `scripts/gg/gg-health.sh` สร้างแล้ว + executable (`chmod +x`)
- [x] n8n workflow `gg-health-monitor` active (GET /webhook/gg-health)
- [x] webhookId UUID บน Webhook node (PATTERN-008)

**Verified:**
- [x] T1 ผ่าน (401 ไม่มี key)
- [x] T2 ผ่าน (200 + valid JSON + status ok)
- [x] T4 ผ่าน (JSON valid)

**Docs:**
- [x] HANDOFF.md อัปเดต workflow ID ของ `gg-health-monitor`
- [x] `docs/collab/GG.md` เพิ่ม health check endpoint
