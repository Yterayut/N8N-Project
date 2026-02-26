#!/bin/bash
# codex-exec.sh — CC สั่ง Codex CLI โดยตรง
# Usage:
#   ./scripts/collab/codex-exec.sh discuss <task-id> "<question>"
#   ./scripts/collab/codex-exec.sh implement <task-id>
#   ./scripts/collab/codex-exec.sh verify <task-id>
#   ./scripts/collab/codex-exec.sh respond <task-id>
#   ./scripts/collab/codex-exec.sh ask "<free-form question>"
set -euo pipefail

# Codex CLI binary (full path — ไม่ใช้ alias เพราะอาจ conflict กับ tmux alias)
CODEX_CLI="/home/oneclimate-uat/.nvm/versions/node/v20.19.0/bin/codex"
CODEX_EXEC="$CODEX_CLI exec -c 'sandbox_permissions=[\"disk-full-read-access\",\"network=true\"]'"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ใช้ git-common-dir เพื่อหา main repo root — ทำงานถูกต้องทั้งใน stable และ agents/codex worktree
_GIT_COMMON="$(git -C "$SCRIPT_DIR" rev-parse --git-common-dir 2>/dev/null || echo "")"
case "$_GIT_COMMON" in
  /*)  REPO_ROOT="$(dirname "$_GIT_COMMON")" ;;  # worktree → absolute path
  *)   REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)" ;;  # main repo → relative .git
esac
CODEX_DIR="$REPO_ROOT/agents/codex"
MODE="${1:?Usage: codex-exec.sh <discuss|implement|verify|respond|ask> [task-id] [message]}"

# Load env for API keys (notify + n8n base URL)
if [ -f "$REPO_ROOT/.env" ]; then
  set -a; source "$REPO_ROOT/.env" 2>/dev/null; set +a
fi
N8N_BASE="${N8N_BASE_URL:-http://localhost:5678}"

# Change 1: Notify CC via Telegram เมื่อ Codex เสร็จงาน
codex_notify() {
  local task_id="$1"
  local status="${2:-done}"
  local last_commit
  last_commit=$(git -C "$CODEX_DIR" log --oneline -1 2>/dev/null || echo "no commit")
  curl -sf -X POST "$N8N_BASE/webhook/gg-notify" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${OCR_SHARED_API_KEY:-}" \
    -d "{\"role\":\"Codex\",\"message\":\"[$task_id] $status\\n$last_commit\"}" \
    >/dev/null 2>&1 || echo "[codex-exec] notify skipped (webhook not ready)"
}

# Sync before work
echo "[codex-exec] Syncing agents/codex with stable..."
git -C "$CODEX_DIR" merge stable --no-edit 2>/dev/null || true

# Find task spec file by ID
find_spec() {
    local tid="$1"
    find "$REPO_ROOT/docs/collab/tasks/" -name "${tid}-*" -o -name "${tid,,}-*" 2>/dev/null | head -1
}

# Change 4: GG awareness — ดู proposals + reports ล่าสุด
GG_PROPOSALS=$(ls "$REPO_ROOT/docs/gg/proposals/" 2>/dev/null | grep -v '^$' | head -5 | tr '\n' ' ' || echo "none")
GG_REPORTS=$(ls "$REPO_ROOT/docs/gg/reports/" 2>/dev/null | grep -v '^$' | head -3 | tr '\n' ' ' || echo "none")

# Preamble ที่ Codex ต้องอ่านทุกครั้ง
PREAMBLE="You are Codex agent. Read these files first (IN THIS ORDER) before doing anything:
1. $CODEX_DIR/CODEX.md — your identity and rules
2. $REPO_ROOT/docs/collab/HANDOFF.md — current task board
3. $REPO_ROOT/docs/collab/knowledge/n8n-patterns.md — known patterns (PATTERN-001 to PATTERN-012)
4. $REPO_ROOT/docs/collab/knowledge/lessons-learned.md — avoid past mistakes

GG Agent context (Intelligence Layer):
- GG recent proposals: ${GG_PROPOSALS:-none} (in $REPO_ROOT/docs/gg/proposals/)
- GG recent reports:   ${GG_REPORTS:-none} (in $REPO_ROOT/docs/gg/reports/)
- GG spec guidelines:  $REPO_ROOT/docs/gg/spec-guidelines.md
- If your task involves GG output → read the relevant proposal/report file before implementing

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
        "$CODEX_CLI" exec -c 'sandbox_permissions=["disk-full-read-access","network=true"]' "$PROMPT" 2>&1
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

PRE-SUBMIT CHECKLIST (verify before commit — do NOT skip):
- [ ] continueOnFail: true on ALL side-system calls (Sheets, Drive, Telegram, HTTP)
- [ ] Use \$('NodeName').first().json.field (NOT \$json) for any multi-input node reads
- [ ] Every REST-created webhook node has a webhookId UUID field (PATTERN-008)
- [ ] Auth check (x-api-key vs OCR_SHARED_API_KEY) on every new webhook endpoint
- [ ] No hardcoded credentials, API keys, or passwords anywhere
- [ ] Binary data through Code nodes: verify binary lineage not broken (PATTERN-009)
- [ ] Closing Template filled in spec file before commit

5. Update docs/collab/HANDOFF.md — move task to Completed
6. git add the relevant files (NOT .env or credentials)
7. git commit with descriptive message: feat($TASK_ID): <summary>
8. git push origin agents/codex
9. Report what you did and test results (include exec ID if E2E ran)"

        # Change 2: Dependency check ก่อนเริ่ม
        DEPS=$(grep -iE "^\*\*Depends on:\*\*|^Depends on:" "$SPEC_FILE" 2>/dev/null | grep -oP 'T\d+' | tr '\n' ' ')
        for dep in $DEPS; do
          if ! grep -qiE "${dep}.*(complet|done)|✅.*${dep}" "$REPO_ROOT/docs/collab/HANDOFF.md" 2>/dev/null; then
            echo "[WARN] Dependency $dep may not be completed — verify HANDOFF.md before proceeding"
          fi
        done

        echo "[codex-exec] implement $TASK_ID — Codex starting work (danger-full-access for localhost)..."
        cd "$CODEX_DIR"
        # ใช้ -s danger-full-access เพราะ implement ต้องการ curl localhost:5678
        # sandbox_permissions network=true ไม่ allow loopback/localhost
        "$CODEX_CLI" exec -s danger-full-access "$PROMPT" 2>&1
        # Change 1: Notify CC เมื่อ Codex เสร็จงาน
        codex_notify "$TASK_ID" "implement complete"
        ;;

    verify)
        TASK_ID="${2:?Usage: codex-exec.sh verify <task-id>}"
        SPEC_FILE=$(find_spec "$TASK_ID")

        PROMPT="$PREAMBLE

MODE: VERIFY (read-only system check — do NOT implement, do NOT commit)

Claude Code asks you to verify the live system state after implementing $TASK_ID.
$([ -n "$SPEC_FILE" ] && echo "Spec file for reference: $SPEC_FILE" || echo "No spec file found for $TASK_ID")

Steps:
1. Read the spec Definition of Done section
2. For each DoD item, check the live system (n8n REST API, SQLite, Sheets) — do NOT rely on code inspection alone
3. Run: curl -s http://127.0.0.1:5678/rest/workflows | jq '[.data[] | {id,name,active}]'
4. For each new workflow, check: is it active? does the webhook route respond (HTTP 200/401)?
5. For each patched node, verify via: GET /rest/workflows/{id} and inspect the node parameters
6. For any new Sheets tab: verify at least 1 row was written with correct columns
7. Output a verification table:
   | DoD Item | Method | Result | Evidence |
   |----------|--------|--------|----------|
   with PASS / FAIL / SKIP (+ reason) per row
8. If any FAIL → describe exact fix needed (do NOT fix yourself — report to CC)"

        echo "[codex-exec] verify $TASK_ID — Codex checking live system state..."
        cd "$CODEX_DIR"
        "$CODEX_CLI" exec -s danger-full-access "$PROMPT" 2>&1
        codex_notify "$TASK_ID" "verify complete"
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
        "$CODEX_CLI" exec -c 'sandbox_permissions=["disk-full-read-access","network=true"]' "$PROMPT" 2>&1
        codex_notify "$TASK_ID" "respond complete"
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
        "$CODEX_CLI" exec -c 'sandbox_permissions=["disk-full-read-access","network=true"]' "$PROMPT" 2>&1
        ;;

    *)
        echo "Usage: codex-exec.sh <discuss|implement|verify|respond|ask> [task-id] [message]"
        echo ""
        echo "Modes:"
        echo "  discuss   <task-id> <question>  — Ask Codex for opinion on a task (no commit)"
        echo "  implement <task-id>             — Tell Codex to implement a task (commit+push)"
        echo "  verify    <task-id>             — Codex checks live system state after implement (no commit)"
        echo "  respond   <task-id>             — Tell Codex to respond to CC's review (commit+push)"
        echo "  ask       <question>            — Ask Codex a free-form question (no commit)"
        exit 1
        ;;
esac
