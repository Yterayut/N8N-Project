# Session Retrospective

Run a full retrospective of this session. Follow these steps:

## 1. Git Summary
Run `git log --oneline` from the start of this session and identify all commits made. List each commit with its message and what it accomplished.

## 2. Tasks Completed
List every task that was completed this session:
- Task ID (if applicable, e.g. T015)
- What problem it solved
- Which files/nodes were changed
- Outcome/impact

## 3. Decisions Made
List important architectural or technical decisions made this session with rationale:
- What was decided
- Why (trade-offs considered)
- Any alternative approaches that were rejected

## 4. Issues Found / Deferred
List any bugs, risks, or issues discovered this session that were NOT fixed:
- Description
- Severity (critical / high / medium / low)
- Why deferred
- Suggested next action

## 5. What Went Well / What Was Hard
Brief honest assessment:
- What worked smoothly
- What took longer or was more complex than expected

## 6. Memory Update
Review `memory/MEMORY.md` and update it with any new stable patterns, preferences, or architectural insights learned this session. Remove outdated entries.

## 7. One-Line Session Summary
End with a single sentence summarizing the session outcome.

## 8. Save Retrospective
Choose a short descriptive slug (2-4 words, kebab-case) summarizing the session's main theme.
Save the full retrospective to `docs/collab/retrospectives/YYYY-MM-DD-<slug>.md` using today's date.
Example: `2026-02-24-improve-plan-complete.md`

Then commit the file:
```
git add docs/collab/retrospectives/YYYY-MM-DD-<slug>.md
git commit -m "docs(retro): session retrospective YYYY-MM-DD-<slug>"
```
