#!/bin/bash
# PreToolUse hook — Bash tool
# Blocks: git push --force on main/stable, sed/awk on workflows, rm -rf without prompt
# Input: JSON on stdin with tool_input.command

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

# ── Block: git push --force on main or stable ─────────────────────────────
if echo "$COMMAND" | grep -qE 'git push.*(--force|-f)'; then
  BRANCH=$(echo "$COMMAND" | grep -oE 'main|stable' | head -1)
  if [ -n "$BRANCH" ]; then
    deny "🚫 BLOCKED: git push --force บน branch ห้ามทำ — Golden Rule #1"
  fi
fi

# ── Block: sed/awk แก้ไข workflow หรือ n8n json โดยตรง ────────────────────
if echo "$COMMAND" | grep -qE '(sed|awk)' && echo "$COMMAND" | grep -qE '(workflow|\.n8n|database\.sqlite)'; then
  deny "🚫 BLOCKED: ห้ามแก้ workflow/n8n ด้วย sed/awk — ใช้ n8n REST API เท่านั้น (Golden Rule #6)"
fi

# ── Block: เขียนตรงไปที่ database.sqlite ──────────────────────────────────
if echo "$COMMAND" | grep -qiE 'sqlite3.*database\.sqlite.*(INSERT|UPDATE|DELETE|DROP)'; then
  deny "🚫 BLOCKED: ห้ามแก้ database.sqlite โดยตรง — ใช้ n8n REST API เท่านั้น"
fi

# ── Warn: rm -rf (allow แต่ log) ──────────────────────────────────────────
if echo "$COMMAND" | grep -qE 'rm\s+-rf'; then
  echo "⚠️  WARN: rm -rf detected — ตรวจสอบว่ามี backup ก่อน" >&2
fi

exit 0
