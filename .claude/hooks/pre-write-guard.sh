#!/bin/bash
# PreToolUse hook — Write|Edit tools
# Blocks: แก้ไฟล์ .env โดยตรง, แก้ database.sqlite โดยตรง
# Input: JSON on stdin with tool_input.file_path

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except:
    print('')
" 2>/dev/null || echo "")

if [ -z "$FILE" ]; then
  exit 0
fi

deny() {
  local reason="$1"
  python3 -c "
import json, sys
reason = sys.argv[1]
print(json.dumps({
  'hookSpecificOutput': {
    'hookEventName': 'PreToolUse',
    'permissionDecision': 'deny',
    'permissionDecisionReason': reason
  }
}))
" "$reason"
  exit 2
}

# ── Block: แก้ .env โดยตรง ──────────────────────────────────────────────
if echo "$FILE" | grep -qE '(^|/)\.env$'; then
  deny "🚫 BLOCKED: ห้าม commit .env — Golden Rule #3 (no credentials in commits)"
fi

# ── Block: แก้ database.sqlite โดยตรง ───────────────────────────────────
if echo "$FILE" | grep -qE 'database\.sqlite'; then
  deny "🚫 BLOCKED: ห้ามแก้ database.sqlite โดยตรง — ใช้ n8n REST API"
fi

exit 0
