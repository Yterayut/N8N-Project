# Learn — Study Codebase with Parallel Agents

Study the codebase thoroughly using parallel exploration agents. The goal is to build a complete mental model quickly.

## Step 1: Identify Scope
Determine what to study based on $ARGUMENTS (if provided) or the full project if no arguments given.
- If `$ARGUMENTS` is a specific file/folder/feature: focus there
- If empty: study the entire project

## Step 2: Launch Parallel Exploration Agents
Spawn multiple Explore agents simultaneously, each focusing on a different dimension:

**Agent A — Architecture & Entry Points**
- Identify all entry points (webhooks, triggers, API endpoints, CLIs)
- Map the high-level data flow from input to output
- List all major subsystems/modules

**Agent B — Core Business Logic**
- Find where the main processing happens
- Identify key algorithms, transformations, and decision points
- List all conditional branches and their meanings

**Agent C — Data Models & Storage**
- Find all data structures (JSON schemas, DB tables, Google Sheets)
- Identify how data is created, read, updated, deleted
- Note any data validation logic

**Agent D — Configuration & Environment**
- List all env vars used and their purpose/defaults
- Find all hardcoded values that could be config
- Identify external service dependencies (APIs, credentials)

**Agent E — Error Handling & Edge Cases**
- Find all error handlers, fallback paths, retry logic
- Identify unhandled edge cases or TODOs
- Note any disabled/legacy code

## Step 3: Synthesize
After all agents return, synthesize their findings into a structured document:

```
## Architecture Overview
[data flow diagram in text]

## Key Components
[component → responsibility → file/node]

## Data Models
[schema summaries]

## Configuration Reference
[env var table]

## Risk Areas / Open Questions
[issues found, things to investigate further]
```

Save the output to `docs/learn-<topic>-<date>.md` where topic comes from $ARGUMENTS (or "codebase" if empty) and date is today.

## Step 4: Update Memory
Add key architectural facts to `memory/MEMORY.md` if they are stable patterns worth remembering.
