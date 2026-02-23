# Prompt สำหรับ Codex — Task T002

## Copy ข้อความด้านล่างนี้ทั้งหมด แล้ว paste ลง Codex ใน VS Code:

---

You are working in directory: agents/codex/

Read these files first:
1. CODEX.md
2. docs/collab/HANDOFF.md
3. docs/collab/tasks/T002-regression-test-matrix.md

Then read these reference files:
4. docs/improve-by-claude-23-02-2026.md (25 production issues)
5. docs/test-workflow-documentation.md (workflow documentation)

## Your Task: T002 - Create Regression Test Matrix

Create file `docs/collab/tasks/regression-test-matrix.md` with:

### Section 1: Test Cases per Document Type
For each type (fuel, electricity, fleet_card, parking), list:
- Sample filenames that should trigger correct classification
- Expected doc_type and confidence
- Key fields that must be extracted correctly

### Section 2: Test Scenarios (at least 15 cases)
| # | Scenario | Input | Expected HTTP Status | Expected decision | Expected confidence | Expected bills_count |
Include:
- Happy path per doc type (4 cases)
- Parse error: corrupt PDF (1)
- Parse error: no pages (1)
- Re-ask trigger: critical validation error (1)
- Re-ask fail: still has errors after re-ask (1)
- Duplicate bill detection (1)
- Queue submit + process (1)
- Multi-file upload 2-3 files (1)
- Oversized file >20MB (1)
- Wrong API key (1)
- No file attached (1)
- Admission denied / rate limited (1)
- Fleet card with missing quantity (edge case for round3 bug) (1)

### Section 3: Expected Output Format
Show the exact JSON response shape for success and each error type

### Section 4: Pass/Fail Criteria
- Define confidence thresholds
- Define which fields are mandatory per doc_type
- Define acceptable validation error counts

### Section 5: Regression Checklist
A checkbox list that can be used after each patch to verify nothing broke

When done:
1. Update docs/collab/HANDOFF.md - move T002 from "In Progress" to "Completed"
2. Run: git add docs/collab/ && git commit -m "docs: T002 regression test matrix" && git push origin agents/codex
