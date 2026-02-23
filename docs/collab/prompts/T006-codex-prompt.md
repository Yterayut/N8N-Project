# Prompt สำหรับ Codex — Task T006

## Copy ข้อความด้านล่างนี้ทั้งหมด แล้ว paste ลง Codex ใน VS Code:

---

You are working in directory: agents/codex/

Read these files first:
1. CODEX.md
2. docs/collab/HANDOFF.md

## Your Task: T006 - Update Documentation After P0/P1 Fixes

Claude Code has completed P0/P1 patches. Your job is to update all documentation to reflect the changes.

### Steps:

1. Read the latest `docs/collab/HANDOFF.md` to see which tasks (T003, T004, T005) are completed and what was changed

2. Update `docs/test-workflow-documentation.md`:
   - Update any sections affected by the P0/P1 fixes
   - Add notes about re-ask normalization loop
   - Update queue worker retry behavior
   - Note the round3 fix

3. Update `docs/improve-by-claude-23-02-2026.md`:
   - Mark completed items with [FIXED] prefix
   - Add date of fix
   - Add brief note of how it was fixed

4. Update `improved-by-codex.md`:
   - Update Phase 1 status
   - Note which items are completed
   - Update "ลำดับลงมือที่แนะนำ" section

5. Create `docs/collab/completed/phase1-summary.md`:
   - Summary of all P0/P1 fixes
   - What changed in each node
   - Test results (from HANDOFF.md notes)
   - Remaining items for Phase 2

When done:
1. Update docs/collab/HANDOFF.md - move T006 to "Completed"
2. Run: git add docs/ improved-by-codex.md && git commit -m "docs: T006 update docs after P0/P1 fixes" && git push origin agents/codex
