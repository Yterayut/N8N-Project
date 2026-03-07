# Pre-commit Sync Check

Run all pre-commit checks before committing or ending a session.

## Checks

1. **nowThai sync**
   ```bash
   ./scripts/verify_nowThai_sync.sh
   ```
   Expect: `OK — all 5 nodes have identical nowThai() ✓`

2. **Git status**
   ```bash
   git status --short
   git log --oneline -3
   ```
   Check for: uncommitted changes, untracked sensitive files

3. **HANDOFF.md updated**
   - Check if today's work is reflected in Recently Completed or In Progress
   - If not: remind user to update before committing

4. **Sync agents**
   ```bash
   ./scripts/collab/sync.sh all
   ```
   Confirm: `[sync] Agent 'codex' synced`

5. **Secret scan** (if available)
   ```bash
   bash ./scripts/tests/secret_scan.sh 2>/dev/null || echo "secret_scan not run"
   ```

## Report Format
```
=== Pre-commit Sync Check ===
✅ nowThai sync: OK
✅ Git status: clean / ⚠️ N files pending
✅ HANDOFF.md: updated today / ⚠️ needs update
✅ agents/codex sync: OK
✅ No secrets detected

Overall: READY TO COMMIT ✅ / NEEDS ATTENTION ⚠️
```

## Usage
```
/sync-check
```
Run before every commit and before ending a session.
