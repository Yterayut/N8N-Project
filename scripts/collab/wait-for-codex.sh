#!/bin/bash
# wait-for-codex.sh — Background poller: รอจนกว่า Codex จะ push commit สำหรับ task นี้
# Usage: ./scripts/collab/wait-for-codex.sh <task-id> [timeout-seconds]
# CC รัน script นี้เป็น background task หลัง assign Codex เสมอ
# เมื่อ Codex push เสร็จ → script exit → CC ได้รับ notification อัตโนมัติ

TASK_ID="${1:?Usage: wait-for-codex.sh <task-id> [timeout]}"
TIMEOUT="${2:-3600}"  # default 1 hour
POLL_INTERVAL=20      # check every 20 seconds

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CODEX_DIR="$REPO_ROOT/agents/codex"

# Snapshot commit before Codex starts
BEFORE=$(git -C "$CODEX_DIR" rev-parse HEAD 2>/dev/null || echo "none")

echo "[wait-for-codex] Waiting for Codex to complete $TASK_ID (timeout ${TIMEOUT}s)..."
echo "[wait-for-codex] Current HEAD: $BEFORE"

elapsed=0
while [ $elapsed -lt $TIMEOUT ]; do
    # Pull latest from remote
    git -C "$CODEX_DIR" fetch origin agents/codex --quiet 2>/dev/null || true

    AFTER=$(git -C "$CODEX_DIR" rev-parse origin/agents/codex 2>/dev/null || echo "none")

    if [ "$AFTER" != "$BEFORE" ]; then
        # New commit detected — check if it's for our task
        COMMIT_MSG=$(git -C "$CODEX_DIR" log origin/agents/codex --oneline -5 2>/dev/null)
        TASK_LOWER=$(echo "$TASK_ID" | tr '[:upper:]' '[:lower:]')

        if echo "$COMMIT_MSG" | grep -qi "$TASK_LOWER\|${TASK_ID}"; then
            LATEST=$(git -C "$CODEX_DIR" log origin/agents/codex --oneline -1)
            echo ""
            echo "========================================="
            echo "✅ CODEX COMPLETE: $TASK_ID"
            echo "Commit: $LATEST"
            echo "Elapsed: ${elapsed}s"
            echo "========================================="
            echo "CC: กรุณา review และ merge ทันที"
            exit 0
        else
            # New commit แต่ไม่ใช่ task นี้ — update BEFORE แล้วรอต่อ
            BEFORE="$AFTER"
        fi
    fi

    sleep $POLL_INTERVAL
    elapsed=$((elapsed + POLL_INTERVAL))
    echo "[wait-for-codex] ${elapsed}s — still waiting..."
done

echo "[wait-for-codex] TIMEOUT after ${TIMEOUT}s — Codex ยังไม่เสร็จ"
exit 1
