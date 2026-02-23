#!/bin/bash
# status.sh - Show collaboration status at a glance
# Usage: ./scripts/collab/status.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "========================================"
echo "  Multi-Agent Collaboration Status"
echo "========================================"
echo ""

# Current agent identity
echo "[Identity]"
echo "  Path:   $(pwd)"
echo "  Branch: $(git branch --show-current)"
echo "  Commit: $(git log --oneline -1)"
echo ""

# Worktree list
echo "[Worktrees]"
git worktree list | while read -r line; do
    echo "  $line"
done
echo ""

# Pending changes per worktree
echo "[Uncommitted Changes]"
for wt in $(git worktree list --porcelain | grep "^worktree " | cut -d' ' -f2); do
    name=$(basename "$wt")
    changes=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l)
    branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "detached")
    if [ "$changes" -gt 0 ]; then
        echo "  $name ($branch): $changes files changed"
    else
        echo "  $name ($branch): clean"
    fi
done
echo ""

# Branch divergence
echo "[Branch Divergence]"
for wt in $(git worktree list --porcelain | grep "^worktree " | cut -d' ' -f2); do
    branch=$(git -C "$wt" branch --show-current 2>/dev/null || echo "")
    if [[ "$branch" == agents/* ]]; then
        name=$(basename "$wt")
        ahead=$(git -C "$wt" rev-list stable.."$branch" --count 2>/dev/null || echo "?")
        behind=$(git -C "$wt" rev-list "$branch"..stable --count 2>/dev/null || echo "?")
        echo "  $name: $ahead ahead, $behind behind stable"
    fi
done
echo ""

# Recent task activity
echo "[HANDOFF Status]"
if [ -f "$REPO_ROOT/docs/collab/HANDOFF.md" ]; then
    # Show In Progress tasks
    grep -A 20 "^### In Progress" "$REPO_ROOT/docs/collab/HANDOFF.md" 2>/dev/null | head -5 | sed 's/^/  /'
else
    echo "  No HANDOFF.md found"
fi
echo ""
echo "========================================"
