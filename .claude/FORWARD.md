# Forward Handoff — 2026-02-25

## Where We Are
- Branch: `stable`
- Last commit: `29fb8ae` review(T029C): CC review score 8/10 APPROVED + HANDOFF updated
- Phase: **T029 OCR Closed Learning Loop — COMPLETE** (T029A/B/C done, T029D deferred)

## What Was Accomplished This Session

- ✅ T029B review (7.5/10 APPROVED WITH CONDITIONS) — `docs/collab/reviews/T029B-review.md`
- ✅ T029B-patch (CC) — fix P2/P3 dedup key, strip count/pct from patternText — exec 151689
- ✅ T029C spec finalized — IF gate architecture + ocr-rules-reader (post Codex discuss)
- ✅ T029C implement (Codex) — commit `971f51d` — 3 new nodes main OCR + ocr-rules-reader workflow
- ✅ T029C review (8/10 APPROVED) — `docs/collab/reviews/T029C-review.md`
- ✅ Supabase migration proposal committed as T030 draft — `T029-architecture.md Discussion`
- ✅ OCR_EXAMPLES ex_seed_001 duplicate deactivated — 6 active examples, no dups

## Current State of Live System

| Workflow | ID | Status | หมายเหตุ |
|----------|----|--------|---------|
| ocr-invoice-processor | `up1n75qEhbsXswii` | Active, 114 nodes | +3 runtime rules nodes (flag=false) |
| ocr-rules-reader | `dFzVzAFjdRJHbQqe` | Active | GET /webhook/ocr-rules, auth x-api-key |
| ocr-km-logger | `jmJHPPj0OM5LcZ0n` | Active | logs TRAIN_CASES + FIELD_DIFFS |
| ocr-km-suggest | `NkKd02QyzLRcpIJM` | Active, 16 nodes | daily 06:00 Bangkok, dedup fixed |
| ocr-feedback-receiver | `ztJ8oCBHREUPPry6` | Active | → km-logger + learning-path1 |
| ocr-examples-api | `LzYmwkdRfOxbCrwB` | Active | 6 active examples, no dups |

## What To Do Next (In Order)

1. **Codex respond to T029C review** — `./scripts/collab/codex-exec.sh respond T029C` — Codex ควรอ่าน review + ตอบ
2. **Commit uncommitted HANDOFF.md** — `git add docs/collab/HANDOFF.md && git commit -m "chore: sync" && ./scripts/collab/sync.sh all`
3. **T030 Supabase decision** — อ่าน `docs/collab/tasks/T029-architecture.md ## Discussion` → decide: implement M1 dual-write หรือรอก่อน
4. **T029D** — รอจนมี test documents ใน GDrive (≥5 files/doc_type + ground_truth JSON)
5. **flag=true manual test** — ก่อน enable `OCR_RUNTIME_RULES_ENABLED=true` ต้อง test path นี้ก่อน (ดู T029C-review.md)

## Pending Tasks (from HANDOFF.md)

| ID | Task | Owner | Depends on |
|----|------|-------|-----------|
| T029D | Benchmark Runner (DEFERRED) | Codex | Ground truth test docs in GDrive |
| T030 | Supabase migration (proposal ready) | — | CC decision on scope |
| T029C respond | Codex respond to review | Codex | T029C review done ✅ |

## Uncommitted Changes

- `M docs/collab/HANDOFF.md` — sync log entries added by auto-sync hook, minor updates

## Context That Took Time To Build (Don't Lose)

### T029C Architecture
- IF node (not code check) เป็น gate ก่อน Sheets/HTTP call — guarantee flag=false = zero network call
- ocr-rules-reader แยก workflow (GET /webhook/ocr-rules) — testable อิสระจาก main OCR
- Connection path: `Code (Normalize + Validate)` → `IF (Runtime Rules Enabled?)` → true: HTTP reader → `Code (Apply Runtime Rules)` → `If (Need Re-ask)` | false: direct → `If (Need Re-ask)`
- flag=false = pure pass-through ไม่มี audit fields เพิ่ม
- field_format rule_type ยัง NOT fully implemented (placeholder) — `field_default` + `skip_validation` ทำงานได้

### Codex Session Pattern
- Codex interactive session (`codex` tmux) มักติดเมื่อพยายามรัน `codex-exec.sh` จาก within CLI
- วิธีถูก: รัน `./scripts/collab/codex-exec.sh implement T0xx 2>&1 | tee /log` จาก **bash shell** (dev tmux) ไม่ใช่จาก codex interactive
- Codex sandbox blocks git commit — CC ต้อง merge agents/codex แล้ว commit เสมอ

### OCR Learning Loop State
- TRAIN_CASES ปัจจุบัน 7 rows (source=manual) — pattern analysis excluded by default
- Real feedback data เพิ่งเริ่ม (admin ทดสอบ invoice_number correction วันนี้) — ต้องรอ ≥3 cases ต่อ pattern ก่อน lesson จะ generate
- OCR_KM_RUNTIME_RULES sheet ว่างอยู่ (แค่ seed inactive row) — feature flag OFF

### Supabase
- `Google Sheets to Supabase` workflow (`newlJxGvIuRXSkw6`) เป็นคนละโปรเจ็ค — ห้ามยุ่ง
- T030 proposal อยู่ใน `docs/collab/tasks/T029-architecture.md ## Discussion` — Codex เขียนไว้ pending CC decision

## Commands To Run First

```bash
# 1. Commit uncommitted HANDOFF
git add docs/collab/HANDOFF.md && git commit -m "chore: sync log" && ./scripts/collab/sync.sh all

# 2. Check if Codex responded to T029C review
cat docs/collab/reviews/T029C-review.md | grep -A 10 "## Codex Response"

# 3. Check live system health
curl -s -b cookie.txt http://localhost:5678/rest/workflows | python3 -c "import sys,json; r=json.load(sys.stdin); print('Active:', sum(1 for w in r.get('data',[]) if w.get('active')))"

# 4. ถ้าต้องการทำ T030 — อ่าน proposal ก่อน
cat docs/collab/tasks/T029-architecture.md | grep -A 60 "## Discussion"
```
