#!/bin/bash
# sync.sh - Sync agents with stable branch
# Usage:
#   ./scripts/collab/sync.sh          # auto-detect: pull if on stable, merge if on agents/*
#   ./scripts/collab/sync.sh codex    # sync specific agent worktree
#   ./scripts/collab/sync.sh all      # sync all agent worktrees
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BRANCH="$(git branch --show-current)"
TARGET="${1:-auto}"

sync_stable() {
    echo "[sync] Pulling latest on stable..."
    git pull --ff-only origin stable 2>/dev/null || echo "[sync] No remote changes or not tracking remote"
    echo "[sync] stable is up to date"
}

sync_agent() {
    local agent_dir="$REPO_ROOT/agents/$1"
    if [ ! -d "$agent_dir" ]; then
        echo "[sync] ERROR: Agent worktree '$1' not found at $agent_dir"
        return 1
    fi
    echo "[sync] Syncing agent '$1' with stable..."
    git -C "$agent_dir" merge stable --no-edit 2>&1
    echo "[sync] Agent '$1' synced"
}

update_handoff() {
    local handoff="$REPO_ROOT/docs/collab/HANDOFF.md"
    if [ -f "$handoff" ]; then
        local today
        today=$(TZ='Asia/Bangkok' date '+%Y-%m-%d %H:%M')
        local agent_name="${1:-auto}"
        # Append to sync log
        sed -i "/^| Date /a | $today | sync | $agent_name | auto-sync |" "$handoff" 2>/dev/null || true
    fi
}

case "$TARGET" in
    auto)
        if [[ "$BRANCH" == "stable" || "$BRANCH" == "main" ]]; then
            sync_stable
        elif [[ "$BRANCH" == agents/* ]]; then
            echo "[sync] On agent branch '$BRANCH', merging stable..."
            git merge stable --no-edit 2>&1
            echo "[sync] Done"
        else
            echo "[sync] Unknown branch '$BRANCH'. Use: sync.sh [codex|all]"
            exit 1
        fi
        ;;
    all)
        sync_stable
        for agent_dir in "$REPO_ROOT"/agents/*/; do
            agent_name=$(basename "$agent_dir")
            sync_agent "$agent_name"
        done
        update_handoff "all"
        ;;
    *)
        sync_agent "$TARGET"
        update_handoff "$TARGET"
        ;;
esac
