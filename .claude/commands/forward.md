# Forward — Create Handoff for Next Session

Prepare a complete handoff so the next session can continue exactly where this one left off, with zero ramp-up time.

## Step 1: Capture Current State
Run these checks and record results:
- `git status --short` — uncommitted changes
- `git log --oneline -10` — recent commits
- `git branch` — current branch
- Read `docs/collab/HANDOFF.md` — task board state

## Step 2: Write Handoff Document
Create or overwrite `.claude/FORWARD.md` with:

```markdown
# Forward Handoff — <date>

## Where We Are
- Branch: <branch>
- Last commit: <hash> <message>
- Phase: <current phase name>

## What Was Accomplished This Session
<bullet list of completed tasks with commit refs>

## Current State of Key Files
<list of files changed and their purpose>

## What To Do Next (In Order)
1. <highest priority next action — be specific>
2. <second action>
3. <third action>
...

## Pending Tasks (from HANDOFF.md)
<copy Pending table from HANDOFF.md>

## Uncommitted Changes (if any)
<list files with status M/A/D and what they contain>

## Context That Took Time To Build (Don't Lose)
<key technical insights, gotchas, non-obvious things learned this session>

## Commands To Run First
<exact commands to run at start of next session to resume>
```

## Step 3: Update HANDOFF.md
If `docs/collab/HANDOFF.md` exists:
- Update "Last Sync" timestamp to now
- Ensure all completed tasks are in the Completed table
- Ensure all pending tasks are in the Pending table

## Step 4: Update Memory
Open `memory/MEMORY.md` and add/update any stable patterns from this session that should persist across sessions.

## Step 5: Confirm
Print a summary:
- "Handoff saved to `.claude/FORWARD.md`"
- List the top 3 next actions so the user can verify they're correct
