#!/bin/bash
# orchestrate.sh - Check Codex agent progress
# Usage: ./scripts/collab/orchestrate.sh check    # check for new commits
#        ./scripts/collab/orchestrate.sh pull      # pull Codex changes
#        ./scripts/collab/orchestrate.sh diff      # show what Codex changed
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CODEX_DIR="$REPO_ROOT/agents/codex"
ACTION="${1:-check}"

case "$ACTION" in
    check)
        echo "[orchestrate] Checking Codex agent status..."
        echo ""
        echo "Branch: $(git -C "$CODEX_DIR" branch --show-current)"
        echo "Latest commit:"
        git -C "$CODEX_DIR" log --oneline -5
        echo ""
        echo "Uncommitted changes:"
        git -C "$CODEX_DIR" status --short
        echo ""
        # Check divergence from stable
        AHEAD=$(git -C "$CODEX_DIR" rev-list stable..agents/codex --count 2>/dev/null || echo "0")
        echo "Commits ahead of stable: $AHEAD"
        ;;
    pull)
        echo "[orchestrate] Pulling Codex remote changes..."
        git -C "$CODEX_DIR" pull origin agents/codex 2>&1 || echo "No remote changes"
        ;;
    diff)
        echo "[orchestrate] Files changed by Codex (vs stable):"
        git -C "$CODEX_DIR" diff --name-status stable..agents/codex
        echo ""
        echo "Full diff:"
        git -C "$CODEX_DIR" diff stable..agents/codex -- docs/
        ;;
    *)
        echo "Usage: orchestrate.sh [check|pull|diff]"
        exit 1
        ;;
esac
