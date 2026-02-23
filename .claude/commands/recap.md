# Recap — Fresh-Start Orientation

Load full context from the last session so you can continue immediately without ramp-up time.

## Step 1: Load All Context Files
Read these files in order:
1. `.claude/FORWARD.md` — last session's handoff (if exists)
2. `docs/collab/HANDOFF.md` — current task board
3. `memory/MEMORY.md` — persistent project knowledge

## Step 2: Check Live State
Run:
- `git log --oneline -5` — recent commits
- `git status --short` — any uncommitted changes
- `git branch` — confirm we're on `stable`

## Step 3: Print Orientation Summary

Output in this format:

```
## Session Recap — <date>

### Where We Left Off
- Branch: <branch>
- Last commit: <hash> <message>
- Last session focus: <1 line from FORWARD.md>

### Active Tasks (from HANDOFF.md)
<In-Progress tasks>

### Pending Tasks
<Pending tasks, highest priority first>

### What To Do Next
1. <most urgent action — be specific>
2. <second>
3. <third>

### Key Context (Don't Forget)
<top 3 gotchas or insights from FORWARD.md / MEMORY.md>

### First Command To Run
<exact command to resume where we left off>
```

## Step 4: Ask
"Ready to continue? Which task should we start with?"
