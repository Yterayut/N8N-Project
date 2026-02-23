#!/bin/bash
# assign.sh - Create a task file for an agent
# Usage: ./scripts/collab/assign.sh <task-id> <owner> <title>
# Example: ./scripts/collab/assign.sh T007 codex "Review round3 fix"
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TASK_ID="${1:?Usage: assign.sh <task-id> <owner> <title>}"
OWNER="${2:?Usage: assign.sh <task-id> <owner> <title>}"
TITLE="${3:?Usage: assign.sh <task-id> <owner> <title>}"
DATE=$(TZ='Asia/Bangkok' date '+%Y-%m-%d %H:%M')

TASK_FILE="$REPO_ROOT/docs/collab/tasks/${TASK_ID}-$(echo "$TITLE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]').md"

cat > "$TASK_FILE" << EOF
# ${TASK_ID}: ${TITLE}

**Owner:** ${OWNER}
**Priority:** P1
**Status:** pending
**Created:** ${DATE}
**Depends On:** -

## Objective
_(describe what needs to be done)_

## Deliverable
_(describe expected output)_

## Notes
-
EOF

echo "[assign] Created task: $TASK_FILE"
echo "[assign] Owner: $OWNER"
echo "[assign] Don't forget to update HANDOFF.md"
