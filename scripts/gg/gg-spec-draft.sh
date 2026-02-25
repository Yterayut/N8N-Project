#!/bin/bash
# Role I — Spec Drafter
# Trigger: On-demand — CC รัน: ./gg-spec-draft.sh "requirement text"
# Purpose: Draft T0xx spec จาก high-level requirement

GG_ROLE="spec-draft"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

REQUIREMENT="${1:-}"
if [ -z "$REQUIREMENT" ]; then
  echo "Usage: $0 \"<requirement description>\""
  echo "Example: $0 \"เพิ่ม email notification เมื่อ OCR error rate สูงเกิน 30%\""
  exit 1
fi

log "=== GG Role I: Spec Drafter started ==="
log "Requirement: $REQUIREMENT"

# โหลด context จาก completed tasks + HANDOFF
HANDOFF_SUMMARY=$(head -80 "$PROJECT_DIR/docs/collab/HANDOFF.md" 2>/dev/null || echo "")
RECENT_TASKS=$(ls "$PROJECT_DIR/docs/collab/tasks/"*.md 2>/dev/null | tail -5 | xargs cat 2>/dev/null || echo "")
TEMPLATE=$(cat "$PROJECT_DIR/docs/collab/reviews/_TEMPLATE.md" 2>/dev/null || echo "")

# โหลด spec guidelines (CC feedback สะสม — สอน GG pattern ที่ถูกต้อง)
SPEC_GUIDELINES=$(cat "$PROJECT_DIR/docs/gg/spec-guidelines.md" 2>/dev/null || echo "")

# หา task ID ถัดไป
LAST_TASK_ID=$(ls "$PROJECT_DIR/docs/collab/tasks/T"*.md 2>/dev/null | grep -oP 'T\d+' | sort | tail -1 || echo "T031")
NEXT_ID=$(echo "$LAST_TASK_ID" | python3 -c "import sys; t=sys.stdin.read().strip(); print(f'T{int(t[1:])+1:03d}')" 2>/dev/null || echo "T032")

PROMPT="You are GG (Gemini), the intelligence agent for an n8n OCR automation system.
Your job: write a detailed implementation spec for a new task that Claude Code (CC) will review.

## MANDATORY RULES — READ BEFORE WRITING ANYTHING
$SPEC_GUIDELINES

---

## System Context
This is an n8n-based OCR invoice processing system with:
- Main workflow: ocr-invoice-processor (up1n75qEhbsXswii)
- Learning loop: TRAIN_CASES → runtime rules → better OCR
- 3 agents: Claude Code (planner), Codex (executor), GG/Gemini (intelligence)
- Stack: n8n, Google Sheets, Google Drive, Telegram, SQLite

## Recent HANDOFF context:
$HANDOFF_SUMMARY

## New Requirement:
\"$REQUIREMENT\"

## Task: Write spec file for task ID $NEXT_ID

IMPORTANT: Start your response with \`# $NEXT_ID\` immediately. No preamble. No reasoning. No \"I will...\". Pure markdown spec only.

Follow this structure exactly:
\`\`\`markdown
# $NEXT_ID — [Task Title]

**Author:** Claude Code (CC) — DRAFT by GG
**Date:** $DATE_TAG
**Assignee:** [Codex / CC / GG]
**Priority:** [High/Medium/Low]
**Depends on:** [task IDs or 'none']

---

## Overview
[2-3 sentences: what problem this solves + why now]

## Scope

**In scope:**
- [specific deliverable 1]
- [specific deliverable 2]

**Out of scope:**
- [what we explicitly won't do]

## Technical Spec

### Step 1: [Name]
[Detailed steps with code examples where relevant]

### Step 2: ...

## Security Considerations
[Auth, input validation, credential handling]

## Test Plan

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | | | |

## Definition of Done

**Implemented:**
- [ ] [specific build criteria]

**Verified:**
- [ ] [specific test that must pass]
- [ ] [if webhook: webhookId UUID บน webhook node (PATTERN-008)]

**Docs:**
- [ ] HANDOFF.md อัปเดต (ถ้ามี workflow ใหม่)

## Discussion
*(for Codex pre-execution questions)*
\`\`\`

Important:
- Be specific enough that Codex can implement without asking questions
- Include all n8n node names, webhook paths, sheet names that are relevant
- Apply ALL rules from the MANDATORY RULES section above
- When in doubt about a CLI flag or API — leave a note in Discussion instead of guessing"

# Run GG
log "Running Gemini spec drafting..."
OUTPUT=$(gg_run "$PROMPT") || {
  log_error "Gemini CLI failed"
  exit 1
}

# Save as DRAFT (CC must review before assigning to Codex)
SLUG=$(echo "$REQUIREMENT" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-30)
FILENAME="DRAFT-${NEXT_ID}-${SLUG}.md"
FILEPATH="$PROJECT_DIR/docs/collab/tasks/$FILENAME"
echo "$OUTPUT" > "$FILEPATH"

log "Draft spec saved: $FILEPATH"
echo ""
echo "✅ Draft saved: $FILEPATH"
echo "👉 CC ต้องตรวจสอบและ rename (ลบ DRAFT- prefix) ก่อน assign ให้ Codex"
