#!/bin/bash
# Stop hook (async) — remind ถ้า HANDOFF.md มีการเปลี่ยนแปลงที่ยังไม่ commit
# หรือถ้ามี sync.sh all ที่ยังไม่ได้รัน

PROJECT_ROOT="/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE"
cd "$PROJECT_ROOT" || exit 0

# Check unstaged/staged HANDOFF.md changes
HANDOFF_CHANGED=$(git status --short docs/collab/HANDOFF.md 2>/dev/null | grep -c "HANDOFF" || echo 0)

if [ "$HANDOFF_CHANGED" -gt 0 ]; then
  echo "📋 HANDOFF.md มีการเปลี่ยนแปลงที่ยังไม่ commit — รัน sync.sh all ด้วย" >&2
fi

# Check if agents/codex is behind stable (need sync)
CODEX_BEHIND=$(git -C agents/codex log --oneline stable..HEAD 2>/dev/null | wc -l | tr -d ' ')
if [ "${CODEX_BEHIND:-0}" -gt 0 ]; then
  echo "🔄 agents/codex branch ล้าหลัง stable $CODEX_BEHIND commit — ควรรัน sync.sh all" >&2
fi

exit 0
