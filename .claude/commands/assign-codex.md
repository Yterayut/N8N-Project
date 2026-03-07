# Assign to Codex

Assign task $ARGUMENTS to Codex for implementation.

## Steps

1. **Verify spec**
   - Find `docs/collab/tasks/T$ARGUMENTS-*.md`
   - Confirm spec has: Problem, Implementation, Definition of Done sections
   - If spec is missing or incomplete: stop and tell user

2. **Check Codex pane is at bash**
   ```bash
   tmux list-panes -t codex -F "#{pane_current_command}" 2>/dev/null
   ```
   - If not at bash: send C-c and wait 3 seconds

3. **Assign task**
   ```bash
   tmux send-keys -t codex "/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/scripts/collab/codex-exec.sh implement T$ARGUMENTS" Enter
   ```

4. **Confirm started** (wait 8 seconds)
   ```bash
   sleep 8 && ps aux | grep "node.*codex" | grep -v grep | grep -v vscode || true
   ```

5. **Report**
   - "Codex assigned T$ARGUMENTS — monitoring agents/codex branch for commits"
   - Update HANDOFF.md: move task to "In Progress (Codex)"

## Usage
```
/assign-codex 053
/assign-codex 052G
```
