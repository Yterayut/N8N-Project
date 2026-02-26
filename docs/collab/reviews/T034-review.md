# Code Review — T034: GG Agent Health Check Endpoint

**Reviewer:** CC
**Reviewed commit:** `e206f23` (gg-health.sh added) + HANDOFF entries
**Date:** 2026-02-26
**Spec:** `docs/collab/tasks/T034-gg-health-monitor.md`
**Score:** 8.5/10

---

## Summary of What Was Implemented

- `scripts/gg/gg-health.sh` — checks GG CLI, API (timeout 20s), scripts, storage, data gateway, recent errors; outputs structured JSON with aggregate `ok|warn|fail`
- n8n workflow `gg-health-monitor` (`BlCrCNITw9ThtfOx`) — GET `/webhook/gg-health` with x-api-key auth, Execute Command node, JSON response
- Codex added `IF (Authorized?)` + `Respond (401)` branch that the spec diagram was missing — necessary for clean 401 path

---

## Verification Level

- [x] **Implemented** — code/config เขียนถูกต้องตาม spec
- [x] **Verified** — re-fetch จาก n8n API / SQLite ยืนยัน node/workflow ตรง
- [x] **E2E Passed** — execution จริง ผ่านครบ | Exec IDs: `151884` (T1), `151885` (T2), `151887` (T3 optional)

---

## Test Evidence

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| T1 — No auth | GET /webhook/gg-health (ไม่มี key) | exec 151884 → `401 {"ok":false,"error":"unauthorized"}` | ✅ |
| T2 — Healthy state | GET /webhook/gg-health + correct key | exec 151885 → `200` + `status:"ok"` | ✅ |
| T3 — Script missing (optional) | remove exec bit จาก gg-curate.sh ชั่วคราว | exec 151887 → `status:"warn"`, `scripts.status:"warn"` | ✅ |
| T4 — JSON valid | `python3 -m json.tool` บน response body | parse สำเร็จ ไม่ error | ✅ |

---

## What Was Done Well ✅

### 1. `json_obj()` helper แทน string interpolation
Spec draft ใช้ `echo '{"status":"'"$STATUS"'",...}'` ซึ่ง fragile มาก Codex เขียน `json_obj()` helper ที่ใช้ Python รับ key-value pairs แล้ว `json.dumps()` — ป้องกัน injection จาก string values ที่มี quote หรือ special chars ได้อย่างสมบูรณ์

### 2. `timeout 20s` บน Gemini API ping
ป้องกัน webhook timeout กรณี Gemini API ช้า — CC ไม่ได้ระบุใน spec แต่ Codex เพิ่มเอง เป็น production-awareness ที่ดีมาก

### 3. Smart spec deviation — IF (Authorized?) branch
Spec diagram: `Webhook → Code → Execute Command → Respond` — ไม่สามารถคืน clean 401 ได้ถ้า unauthorized request ยังวิ่งต่อไปหา Execute Command
Codex แก้ด้วยการเพิ่ม `IF (Authorized?)` + `Respond (401)` branch ซึ่งถูกต้องกว่า spec โดยไม่ต้องถาม CC ก่อน และ comment เหตุผลใน Discussion section ก่อน implement

### 4. Temp file สำหรับ curl response
`check_data_gateway()` ใช้ `mktemp` + `rm -f` แทนการอ่านผ่าน `$()` — ป้องกันปัญหา large output ใน shell variable

### 5. Auth upgrade เป็น timing-safe
Spec ระบุ `apiKey !== expected` (plain equality) แต่ Codex ใช้ timing-safe compare helper จาก T032 — consistency ดี และ secure กว่า

---

## Issues Found ❌

### 1. `check_recent_errors()` — approximation ที่ over-report ได้
**Severity:** Low
**Type:** Design

`find ... -mmin -1440` ตรวจว่า log file ถูกแตะใน 24h ที่ผ่านมา ถ้าใช่ → นับ `wc -l` ทั้งไฟล์
ปัญหา: ถ้าไฟล์มี 500 error lines เก่า และมี 1 line ใหม่เพิ่งถูกเพิ่ม 1 ชม.ที่แล้ว → report `recent_errors: 501` แทน `1`

Root cause: log format ใน `common.sh` ใช้ time-only timestamps (ไม่มี date) ทำให้ grep by date ทำไม่ได้

**Fix for T035 / backlog:** เพิ่ม date prefix ใน `common.sh` error log format (`[ERROR][YYYY-MM-DD HH:MM:SS]`) แล้ว `check_recent_errors()` จะ grep ได้ตรงๆ

### 2. Shell variable expansion ใน Python heredoc — theoretical injection risk
**Severity:** Low
**Type:** Security (theoretical)

`gg-health.sh` lines 153–168 ทำ:
```python
python3 - <<PY
...
    "cli": json.loads('''$CLI'''),
...
PY
```

ถ้า `$CLI` มี `'''` (triple single-quote) จะทำให้ Python syntax error หรือ inject Python code ได้
ในทางปฏิบัติ `json_obj()` output เป็น compact JSON ที่ไม่มี triple-quote อยู่แล้ว แต่เป็น design ที่ fragile

**Fix for T035 / backlog:** เขียน JSON checks ลงไฟล์ temp แล้ว `json.load(open(path))` แทน — ไม่มี shell expansion เลย

---

## Security Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Auth ใช้ x-api-key ผ่าน Code node + IF branch | — | ✅ Clean |
| 2 | ไม่มี secrets ใน JSON output (status flag เท่านั้น) | — | ✅ Clean |
| 3 | Command hardcoded ไม่รับ query params | — | ✅ Clean |
| 4 | Triple-quote heredoc injection (theoretical) | Low | Acceptable / backlog |

_Checklist ที่ตรวจ:_
- [x] Auth/authorization บน webhook ใหม่ทุกตัว
- [x] Input validation + size limits ที่ entry points
- [x] ไม่มี secret/credential hardcoded
- [x] Error messages ไม่ leak internal info
- [x] continueOnFail บน side-system calls (`Execute Command: continueOnFail: true`)

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| `check_recent_errors()` ใช้ file mtime gate | ทำงานได้แม้ log format ไม่มี date | Over-report ถ้า log file เก่าแต่ถูก touch |
| Shell heredoc expansion สำหรับ JSON merge | สั้น ไม่ต้องใช้ temp files | Triple-quote injection (theoretical) |
| Workflow activation ต้องใช้ `versionId` | Codex discover undocumented n8n behavior | ต้องจำไว้สำหรับ future workflow activations |

---

## Merge Decision

**APPROVED**

งานนี้ passed ทุก test ที่ spec กำหนด Codex ยังแก้ spec flaw (401 branch) และเพิ่ม production improvements (timeout, json_obj helper) Issues ที่พบเป็น Low severity ทั้งหมดและยอมรับได้ในระยะนี้

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T034`)*

**Date:**

### Response to Issues Raised
[ตอบทีละ issue — เห็นด้วย/ไม่เห็นด้วย + เหตุผล]

### Design Decisions Explained
[อธิบาย trade-off ที่เลือก]

### What I Would Do Differently Next Time
[honest reflection]

### New Patterns / Lessons Learned
[เพิ่มใน n8n-patterns.md หรือ lessons-learned.md ถ้ามี]

### Closing Template
```
Runtime patched:    gg-health-monitor (BlCrCNITw9ThtfOx) — new workflow
Verified from:      exec 151884/151885/151887
Docs synced:        HANDOFF.md + GG.md + T034 spec (Discussion + Execution Notes)
Remaining limits:   check_recent_errors approximation; triple-quote heredoc (theoretical)
```

---

## Merge Approval *(CC fills หลังอ่าน Codex Response)*

- [ ] Codex response addresses all issues raised
- [x] Merged to stable + synced (merged 2026-02-26 via `git merge agents/codex`)
- [x] No further action required (issues are Low / backlog)

**Date merged:** 2026-02-26
**Notes:** APPROVED unconditionally — issues tracked as backlog items for T035 or future maintenance
