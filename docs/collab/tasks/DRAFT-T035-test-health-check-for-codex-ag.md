# T035 — Health Check for Codex Agent

**Author:** Claude Code (CC) — DRAFT by GG
**Date:** 2026-02-26
**Assignee:** Codex
**Priority:** Medium
**Risk:** ต่ำ — เป็นการเพิ่ม script และ workflow ใหม่เพื่อตรวจสอบสถานะของ Codex agent โดยเฉพาะ ไม่กระทบ flow งานหลัก
**Depends on:** none

---

## Overview
สร้างระบบ Health Check สำหรับ Codex Agent เพื่อตรวจสอบความพร้อมของสภาพแวดล้อมในการทำงาน (Worktree, Git branch, Database access) ผ่านทาง n8n API และ script เพื่อให้ CC หรือ GG สามารถตรวจสอบสถานะของ Codex ได้โดยไม่ต้องเข้าไปใน shell โดยตรง

## Scope

**In scope:**
- สร้าง Bash script `scripts/codex/codex-health.sh` เพื่อรวบรวมสถานะของ Codex environment
- สร้าง n8n workflow `codex-health-monitor` พร้อม Webhook endpoint
- รองรับการตรวจสอบผ่าน API ด้วย `x-api-key`

**Out of scope:**
- การซ่อมแซม environment อัตโนมัติ (เฉพาะการ report สถานะ)
- การตรวจสอบความถูกต้องของ code ใน branch (ตรวจสอบแค่ชื่อ branch)

## Technical Spec

### Step 1: Create Health Check Script
สร้างไฟล์ `scripts/codex/codex-health.sh` โดยให้ส่งผลลัพธ์เป็น JSON:
```bash
#!/bin/bash
# scripts/codex/codex-health.sh

CODEX_DIR="/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/agents/codex"
DB_PATH="/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite"

status="ok"
errors=()

# 1. Check if worktree directory exists
if [ ! -d "$CODEX_DIR" ]; then
  status="error"
  errors+=("Worktree directory not found")
fi

# 2. Check Git branch
if [ -d "$CODEX_DIR/.git" ] || [ -f "$CODEX_DIR/.git" ]; then
  cd "$CODEX_DIR" || exit 1
  current_branch=$(git branch --show-current)
  if [ "$current_branch" != "agents/codex" ]; then
    status="warn"
    errors+=("Unexpected branch: $current_branch (expected agents/codex)")
  fi
else
  status="error"
  errors+=("Not a git repository/worktree")
fi

# 3. Check SQLite DB access
if [ ! -r "$DB_PATH" ]; then
  status="error"
  errors+=("Cannot read SQLite database at $DB_PATH")
fi

# Output JSON
echo "{\"status\": \"$status\", \"agent\": \"codex\", \"branch\": \"$current_branch\", \"worktree\": \"$CODEX_DIR\", \"errors\": $(printf '%s\n' "${errors[@]}" | jq -R . | jq -s .), \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"}"
```

### Step 2: Create n8n Workflow `codex-health-monitor`
สร้าง workflow ใหม่ผ่าน REST API ประกอบด้วย nodes ดังนี้:

1.  **Webhook Node**:
    *   HTTP Method: `GET`
    *   Path: `codex-health`
    *   Webhook ID: `40d0460c-26f6-4993-9c8e-3a9d554a991f` (PATTERN-008)

2.  **Code Node (Auth Validate)**: (RULE-SG-004)
    *   ตรวจสอบ header `x-api-key` เทียบกับ `$env.OCR_SHARED_API_KEY`
    *   ถ้าผิด return 401

3.  **Execute Command Node**:
    *   Command: `bash /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/scripts/codex/codex-health.sh`

4.  **Respond to Webhook Node**:
    *   ส่งผลลัพธ์ JSON กลับไปยังผู้เรียก

## Security Considerations
- ใช้ **RULE-SG-004** (Code node auth) เสมอ
- Header: `x-api-key`
- ไม่อนุญาตให้ผ่าน Webhook โดยไม่มี auth

## Test Plan

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Unauthenticated Request | `curl -i GET .../webhook/codex-health` | 401 Unauthorized |
| T2 | Valid Health Check | `curl -H "x-api-key: [KEY]" GET .../webhook/codex-health` | 200 OK + JSON with status "ok" or "warn" |
| T3 | Script Execution | `bash scripts/codex/codex-health.sh` | Valid JSON output |

## Definition of Done

**Implemented:**
- [ ] Directory `scripts/codex/` ถูกสร้าง (ถ้ายังไม่มี)
- [ ] ไฟล์ `scripts/codex/codex-health.sh` ถูกสร้างและ chmod +x
- [ ] Workflow `codex-health-monitor` ถูกสร้างและ Active บน n8n

**Verified:**
- [ ] ทดสอบ T1-T3 ผ่านทั้งหมด
- [ ] `webhookId` UUID ปรากฏใน parameter ของ Webhook node (PATTERN-008)
- [ ] Auth logic ใช้ Code node ตาม RULE-SG-004

**Docs:**
- [ ] HANDOFF.md อัปเดต ID ของ workflow `codex-health-monitor`

## Discussion
- Path `/webhook/codex-health` ตรวจสอบแล้วว่าไม่ชนกับ workflow อื่นในปัจจุบัน (PATTERN-011)
- หาก `jq` ไม่ถูกติดตั้งใน environment ให้ใช้คำสั่งอื่นในการสร้าง JSON string ใน shell script แทน (โปรดตรวจสอบ `jq --version` ก่อนเริ่มงาน)
