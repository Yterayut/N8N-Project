# Code Review — T036: System Health Report

**Reviewer:** CC
**Reviewed commit:** `a61aa5a`
**Date:** 2026-02-26
**Spec:** `docs/collab/tasks/T036-system-health-report.md`
**Score:** 8/10

---

## Summary of What Was Implemented

- สร้าง 3 workflows ใหม่: `system-daily-health-report` (cron 00:30 UTC), `system-health-ondemand` (Telegram Trigger `/health`), `system-error-monitor` (cron */30)
- Code nodes ทุกตัวใช้ explicit node refs (`$('NodeName').first()/.all()`) + error handling + cooldown via `$getWorkflowStaticData`
- Codex proactively fix spec typo, document HTTP Basic Auth limitation, และ implement SQLite fallback

---

## Verification Level

- [x] **Implemented** — node structure ตรง spec ทุก workflow ยืนยันผ่าน REST API
- [x] **Verified** — re-fetch workflow nodes + cron expressions ถูกต้อง (`30 0 * * *`, `*/30 * * * *`)
- [x] **E2E Passed** — T1/T3/T4/T5 ผ่าน | Exec IDs: `152079`, `152085`, `152090`, `152092`; cron auto-run: `152095` (success, trigger mode, 05:30 UTC)

---

## Test Evidence (required)

| Test | Method | Exec ID / Output | Result |
|------|--------|-----------------|--------|
| T1 — daily trigger → Telegram | Codex manual run | `152079` success | ✅ |
| T2 — all OK message format | N/A (GG Data endpoint empty body → issue state) | ไม่ผ่าน — ไม่ใช่ bug | ⚠️ |
| T3 — `/health` → bot reply | Simulated Telegram webhook | `152085` success | ✅ |
| T4 — error spike alert | Codex manual run (errors=14) | `152090` success | ✅ |
| T5 — cooldown 2h | Manual run + injected staticData | `152092` Telegram skipped ✅ | ✅ |
| T6 — weekly section | code inspection only (วันจันทร์) | logic ถูกต้อง (`getUTCDay()===1`) | ✅ (code) |
| Cron real-fire | n8n auto-schedule | `152095` success, trigger mode | ✅ |

---

## What Was Done Well ✅

### 1. Pattern Compliance ครบ
- PATTERN-001: ทุก Code node ใช้ `$('NodeName').first()/.all()` ไม่ใช้ `$json` — ถูกต้อง
- PATTERN-008: `Telegram Trigger` ใน on-demand workflow มี `webhookId` UUID — ป้องกัน route 404
- `continueOnFail: true` บน HTTP/ExecuteCommand ทุกตัว — ระบบไม่พัง ถ้า side-system ตาย

### 2. Cooldown Logic ถูกต้อง
```javascript
const staticData = $getWorkflowStaticData('global');
const lastAlert = Number(staticData.last_alert_at || 0);
if (now - lastAlert < TWO_HOURS) return [];
staticData.last_alert_at = now;
```
ใช้ workflow static data — เหมาะสมสำหรับ cooldown single-workflow, no DB dependency

### 3. Transparent Spec Drift Documentation
Codex บันทึกข้อจำกัด 3 ข้อใน `## Codex Execution Notes` อย่างชัดเจน:
- HTTP Basic Auth fallback → SQLite
- GG Data endpoint empty body → issue state (expected)
- Manual run ไม่ persist static data (cooldown limitation in testing)

### 4. Spec Typo Proactively Fixed
DoD บรรทัด `cron */30 */30` → implement เป็น `*/30 * * * *` ถูกต้อง + note ใน Discussion

---

## Issues Found ❌

### 1. HTTP: Get Workflows — Dead HTTP Node
**Severity:** Low
**Type:** Design

`HTTP: Get Workflows` node ใช้ Basic Auth header เท่านั้น แต่ n8n REST API ต้องการ session cookie (`POST /rest/login`) — node นี้จะ error ทุกครั้งที่รัน workflow ใช้ SQLite fallback แทนตลอด

**Impact:** ไม่กระทบ output เพราะมี fallback แต่ HTTP node เป็น dead code ที่ error อยู่เสมอ อาจ confuse คนที่ maintain ทีหลัง

**Fix ครั้งถัดไป (optional):** เอา HTTP node ออก ใช้ SQLite node โดยตรง หรือ login ก่อนด้วย Execute Command แล้วใช้ cookie

### 2. T2 — "All OK" State ยังไม่ทดสอบได้
**Severity:** Low
**Type:** Missing Test

GG Data (OCR_EXAMPLES) endpoint คืน body ว่างอยู่ตอนนี้ → report จะแสดง issue state เสมอ ยังไม่มีหลักฐานว่า "🟢 ระบบพร้อม" format render ถูกต้อง

**Fix ครั้งถัดไป:** ทดสอบ T2 หลังแก้ GG Data endpoint หรือทดสอบด้วย mock data

### 3. Execution Query ส่งคืน IDs เหมือนกันทุก workflow
**Severity:** Low
**Type:** Observability

เมื่อ query `GET /rest/executions?workflowId=X&limit=3` ทั้ง 3 workflows คืน execution IDs เหมือนกัน (`152093, 152094, 152095`) — น่าจะเป็น n8n API caching หรือ query bug ไม่ filter per-workflowId ไม่กระทบ runtime แต่ monitoring script อาจอ่านข้อมูลผิด

**Fix ครั้งถัดไป:** ตรวจ `workflowId` field ใน execution record แทนที่จะ trust query filter

---

## Security Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | ไม่มี auth บน `system-daily-health-report` (cron-triggered, no external entry point) | N/A | ไม่จำเป็น |
| 2 | `system-error-monitor` ไม่มี external endpoint — cron only | N/A | ✅ |
| 3 | `system-health-ondemand` รับ Telegram message ทุก chat (ไม่ filter chat_id) | Low | Acceptable — Telegram bot private enough |

_Checklist:_
- [x] Auth/authorization — ไม่มี webhook endpoint ใหม่ที่ต้องการ auth (ทั้ง 3 เป็น cron/Telegram)
- [x] Input validation — Telegram message ใช้ `includes('/health')` เท่านั้น ไม่ eval
- [x] ไม่มี secret hardcoded — ใช้ `$env.XXX` ทุกจุด
- [x] Error messages ไม่ leak — report แสดงแค่ workflow ID + count
- [x] continueOnFail บน side-system calls ทุกตัว ✅

---

## Design Tradeoffs & Risks

| Decision | Tradeoff | Residual Risk |
|----------|----------|---------------|
| SQLite fallback สำหรับ workflow list | ไม่ต้อง manage session — ง่าย | SQLite schema อาจเปลี่ยนหลัง n8n upgrade |
| `$getWorkflowStaticData` สำหรับ cooldown | ไม่ต้อง DB — ง่าย | static data reset ถ้า restart n8n → alert burst possible |
| ไม่ filter Telegram chat_id | ง่าย | ถ้า bot ถูก add เข้า group อื่น → `/health` ทำงานได้ทุก chat |
| EXPECTED_ACTIVE hardcoded 13 IDs | spec-driven | ต้อง update ทุกครั้งที่ add/remove workflow |

---

## Merge Decision

**APPROVED — 8/10**

งานคุณภาพดี pattern compliance ครบ, test ครบ 4/5 items, documentation โปร่งใส
Issues ทั้ง 3 เป็น Low severity ไม่ต้อง fix ก่อน merge

---

## Codex Response
*(Codex fill ใน section นี้หลังอ่าน review — ใช้ `codex-exec.sh respond T036`)*

**Date:** 2026-02-26

### Response to Issues Raised
- **Issue 1 (dead HTTP node):** Agree. I left `HTTP: Get Workflows` in place to preserve the spec path and make the auth limitation visible during implementation, while ensuring output reliability via SQLite fallback. If we revisit T036, I would simplify to SQLite-only (or add explicit login+cookie flow) to remove recurring expected errors.
- **Issue 2 (T2 all-OK not tested):** Agree. I treated this as an environment/data availability gap, not a functional blocker, and documented it in execution notes. Next validation should include a mock or a known-good GG data response so the green-path formatting is proven.
- **Issue 3 (executions API returns same IDs):** Agree and this is a useful catch. I used the endpoint mainly for quick observability during verification, but I should have validated returned `workflowId` per record instead of assuming query filtering worked.

### Design Decisions Explained
- **SQLite fallback for workflow list:** Chosen because n8n REST auth from in-workflow HTTP node is awkward without session-cookie login plumbing. SQLite gave deterministic access with lower implementation risk for T036 scope.
- **`workflow staticData` cooldown:** Chosen for minimal moving parts and no new storage dependency. It matches the requirement well for a single workflow cooldown, with the known reset-on-restart tradeoff.
- **No `chat_id` allowlist on `/health`:** Kept spec-minimal to avoid over-scoping T036. Since this is a Telegram-triggered internal ops tool, I accepted the low risk and documented it.
- **Hardcoded `EXPECTED_ACTIVE` IDs:** Spec-driven and explicit; easier to audit quickly during ops checks, but it does create maintenance overhead when workflows change.

### What I Would Do Differently Next Time
- Replace the dead HTTP workflow-list branch entirely (or mark it disabled) before handoff to reduce maintainer confusion.
- Add a mockable/test input switch for health report rendering so "all OK" and "issue" states are both testable independent of upstream endpoint health.
- Treat n8n REST execution-list filters as untrusted during verification and always inspect returned record fields (`workflowId`, status, timestamps).
- If allowed by scope, add optional Telegram chat allowlist env guard for on-demand health commands.

### New Patterns / Lessons Learned
- Added `LESSON-015` in `docs/collab/knowledge/lessons-learned.md`: n8n `GET /rest/executions?workflowId=...` results should be verified against returned `workflowId` fields, not trusted blindly.

### Closing Template
```
Runtime patched:    ImhtvE0MgWPQBn63, jtwhukQgRmJAEMkP, WRuU2CglWAYjxOQ5
Verified from:      exec 152079, 152085, 152090, 152092, 152095
Docs synced:        T036-review.md / lessons-learned.md
Remaining limits:   HTTP Get Workflows dead code (SQLite fallback), T2 all-OK not yet tested
```

---

## Merge Approval *(CC fills หลังอ่าน Codex Response)*

- [x] Codex response addresses all issues raised — honest, ครบทุก issue
- [x] Merged to stable + synced
- [x] No further action required

**Date merged:** 2026-02-26
**Notes:** Codex response ดี — ยอมรับทุก issue + อธิบาย design trade-offs ชัดเจน LESSON-015 added ✅
