#!/bin/bash
# PostToolUse hook — Bash tool (async)
# After n8n REST API PATCH → auto-run verify_nowThai_sync.sh
# After git commit → remind to run sync.sh all
# Input: JSON on stdin with tool_input.command + tool_result

PROJECT_ROOT="/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE"

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('command', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ── After n8n workflow PATCH → verify nowThai sync ───────────────────────
if echo "$COMMAND" | grep -qE "(rest/workflows|PATCH.*workflow)" && \
   echo "$COMMAND" | grep -qiE "(PATCH|method.*PATCH)"; then
  echo "🔄 Auto-verify nowThai() sync after n8n PATCH..." >&2
  if [ -f "$PROJECT_ROOT/scripts/verify_nowThai_sync.sh" ]; then
    cd "$PROJECT_ROOT" && bash ./scripts/verify_nowThai_sync.sh >&2
  fi
fi

# ── After git commit → remind sync ──────────────────────────────────────
if echo "$COMMAND" | grep -qE "git commit" && ! echo "$COMMAND" | grep -q "\-\-dry-run"; then
  RESULT=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('tool_result', ''))
except:
    print('')
" 2>/dev/null || echo "")
  if echo "$RESULT" | grep -qE '\[stable|master|main'; then
    echo "📌 Committed! ต้องรัน: ./scripts/collab/sync.sh all" >&2
  fi
fi

exit 0
