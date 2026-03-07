# Review Task

Review task $ARGUMENTS using the ocr-reviewer subagent.

## Steps

1. **Verify spec exists**
   - Find `docs/collab/tasks/T$ARGUMENTS-*.md`
   - If not found: report "spec not found for T$ARGUMENTS"

2. **Delegate to ocr-reviewer subagent**
   - Pass: task number, spec file path, workflow IDs mentioned in spec
   - Ask reviewer to:
     - Read spec fully
     - Fetch current n8n workflow code for affected nodes
     - Check test execution evidence (SQLite exec data)
     - Run `./scripts/verify_nowThai_sync.sh`
     - Write review to `docs/collab/reviews/T$ARGUMENTS-review.md`

3. **Review the output**
   - Read the review file after subagent completes
   - Confirm score and merge decision are present

4. **Update HANDOFF.md** if review is APPROVED
   - Add to Recently Completed section if merged

## Usage
```
/review-task 052C
/review-task 053
```
