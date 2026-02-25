#!/bin/bash
# codex-exec.sh — CC สั่ง Codex CLI โดยตรง
# Usage:
#   ./scripts/collab/codex-exec.sh discuss <task-id> "<question>"
#   ./scripts/collab/codex-exec.sh implement <task-id>
#   ./scripts/collab/codex-exec.sh respond <task-id>
#   ./scripts/collab/codex-exec.sh ask "<free-form question>"
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CODEX_DIR="$REPO_ROOT/agents/codex"
MODE="${1:?Usage: codex-exec.sh <discuss|implement|respond|ask> [task-id] [message]}"

# Sync before work
echo "[codex-exec] Syncing agents/codex with stable..."
git -C "$CODEX_DIR" merge stable --no-edit 2>/dev/null || true

# Find task spec file by ID
find_spec() {
    local tid="$1"
    find "$REPO_ROOT/docs/collab/tasks/" -name "${tid}-*" -o -name "${tid,,}-*" 2>/dev/null | head -1
}

# Preamble ที่ Codex ต้องอ่านทุกครั้ง
PREAMBLE="You are Codex agent. Read these files first (IN THIS ORDER) before doing anything:
1. $CODEX_DIR/CODEX.md — your identity and rules
2. $REPO_ROOT/docs/collab/HANDOFF.md — current task board
3. $REPO_ROOT/docs/collab/knowledge/n8n-patterns.md — known patterns
4. $REPO_ROOT/docs/collab/knowledge/lessons-learned.md — avoid past mistakes

IMPORTANT RULES:
- You work on branch agents/codex in worktree $CODEX_DIR
- Never edit workflow JSON directly — use n8n REST API
- After completing work: git add, git commit, git push origin agents/codex
- Source .env for API credentials: source $REPO_ROOT/.env"

case "$MODE" in
    discuss)
        TASK_ID="${2:?Usage: codex-exec.sh discuss <task-id> <question>}"
        MESSAGE="${3:?Usage: codex-exec.sh discuss <task-id> <question>}"
        SPEC_FILE=$(find_spec "$TASK_ID")

        PROMPT="$PREAMBLE

MODE: DISCUSS (do NOT implement, do NOT commit — only give your opinion)

Claude Code asks you about task $TASK_ID.
$([ -n "$SPEC_FILE" ] && echo "Read the spec at: $SPEC_FILE" || echo "No spec file found for $TASK_ID")

Question from Claude Code:
$MESSAGE

Reply with your analysis, concerns, and suggestions. Be concise and direct."

        echo "[codex-exec] discuss $TASK_ID — sending question to Codex..."
        cd "$CODEX_DIR"
        codex exec -s danger-full-access "$PROMPT" 2>&1
        ;;

    implement)
        TASK_ID="${2:?Usage: codex-exec.sh implement <task-id>}"
        SPEC_FILE=$(find_spec "$TASK_ID")

        if [ -z "$SPEC_FILE" ]; then
            echo "[codex-exec] ERROR: No spec file found for $TASK_ID in docs/collab/tasks/"
            exit 1
        fi

        PROMPT="$PREAMBLE

MODE: IMPLEMENT (execute the task, commit, and push)

Your assigned task: $TASK_ID
Spec file: $SPEC_FILE

Steps:
1. Read the spec file completely
2. Read Discussion section — if you have concerns, note them but proceed
3. Implement the task as described in the spec
4. Run any tests specified in the spec
5. Update docs/collab/HANDOFF.md — move task to Completed
6. git add the relevant files (NOT .env or credentials)
7. git commit with descriptive message: feat($TASK_ID): <summary>
8. git push origin agents/codex
9. Report what you did and test results"

        echo "[codex-exec] implement $TASK_ID — Codex starting work..."
        cd "$CODEX_DIR"
        codex exec -s danger-full-access "$PROMPT" 2>&1
        ;;

    respond)
        TASK_ID="${2:?Usage: codex-exec.sh respond <task-id>}"
        REVIEW_FILE="$REPO_ROOT/docs/collab/reviews/${TASK_ID}-review.md"

        if [ ! -f "$REVIEW_FILE" ]; then
            echo "[codex-exec] ERROR: No review file at $REVIEW_FILE"
            exit 1
        fi

        PROMPT="$PREAMBLE

MODE: RESPOND (fill in Codex Response section of the review)

Claude Code wrote a code review for $TASK_ID at:
$REVIEW_FILE

Steps:
1. Read the review file completely
2. Find the '## Codex Response' section
3. Fill it in with:
   - Your response to issues raised
   - Explanation of your design decisions
   - What you would do differently next time
   - Any new patterns or lessons learned
4. If you found new patterns → add to docs/collab/knowledge/n8n-patterns.md
5. If you learned lessons → add to docs/collab/knowledge/lessons-learned.md
6. git add the changed files
7. git commit -m 'response($TASK_ID): Codex feedback on review'
8. git push origin agents/codex"

        echo "[codex-exec] respond $TASK_ID — Codex reviewing feedback..."
        cd "$CODEX_DIR"
        codex exec -s danger-full-access "$PROMPT" 2>&1
        ;;

    ask)
        MESSAGE="${2:?Usage: codex-exec.sh ask <question>}"

        PROMPT="$PREAMBLE

MODE: ASK (answer a question — do NOT commit anything)

Claude Code asks:
$MESSAGE

Reply concisely and directly."

        echo "[codex-exec] ask — sending question to Codex..."
        cd "$CODEX_DIR"
        codex exec -s danger-full-access "$PROMPT" 2>&1
        ;;

    *)
        echo "Usage: codex-exec.sh <discuss|implement|respond|ask> [task-id] [message]"
        echo ""
        echo "Modes:"
        echo "  discuss   <task-id> <question>  — Ask Codex for opinion on a task (no commit)"
        echo "  implement <task-id>             — Tell Codex to implement a task (commit+push)"
        echo "  respond   <task-id>             — Tell Codex to respond to CC's review (commit+push)"
        echo "  ask       <question>            — Ask Codex a free-form question (no commit)"
        exit 1
        ;;
esac
