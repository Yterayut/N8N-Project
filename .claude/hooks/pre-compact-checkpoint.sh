#!/bin/bash
# PreCompact hook — auto-save FORWARD.md checkpoint before context compaction
# Replaces manual Level-2 Context Protocol

PROJECT_ROOT="/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE"
FORWARD_FILE="$PROJECT_ROOT/.claude/FORWARD.md"

cd "$PROJECT_ROOT" || exit 0

TIMESTAMP=$(TZ=Asia/Bangkok date '+%Y-%m-%d %H:%M BKK')
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")
PENDING_FILES=$(git diff --name-only HEAD 2>/dev/null | head -10 | tr '\n' ', ')

# Read current HANDOFF In Progress section
INPROGRESS=$(grep -A5 "### In Progress (CC)" "$PROJECT_ROOT/docs/collab/HANDOFF.md" 2>/dev/null | tail -5 | grep -v "###" | head -3)

cat > "$FORWARD_FILE" << CHECKPOINT
## Last Checkpoint — $TIMESTAMP (auto-saved by PreCompact hook)

### Git State
- Branch: \`$BRANCH\`
- Last commit: \`$LAST_COMMIT\`
- Uncommitted changes: ${PENDING_FILES:-none}

### Status
- ✅ Context compaction triggered — session auto-saved
- 🔄 ดู HANDOFF.md สำหรับ current task status
- ⏭️ รัน \`/recap\` เพื่อ resume งานต่อ

### Current Work (from HANDOFF.md)
${INPROGRESS:-_(not found — check HANDOFF.md directly)_}

### Note
Context ถูก compact อัตโนมัติ — hook บันทึก checkpoint ให้แล้ว
รัน \`/recap\` ใน session ใหม่เพื่อ reload context ทั้งหมด
CHECKPOINT

echo "✅ Checkpoint saved to .claude/FORWARD.md (pre-compact auto-save)" >&2
exit 0
