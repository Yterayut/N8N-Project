# Task Queue - Orchestration Loop

## วิธีใช้
1. Claude Code เตรียม prompt ไว้ใน `docs/collab/prompts/`
2. คุณ copy prompt → paste ลง Codex ใน VS Code
3. Codex ทำเสร็จ → commit + push
4. คุณบอก Claude Code: "Codex เสร็จ T00X แล้ว"
5. Claude Code review → assign งานถัดไป → loop

## Task Execution Order

### Round 1: Codex ทำ (ขนานกับ Claude Code)
| Order | Task ID | Owner | Prompt File | Status |
|-------|---------|-------|-------------|--------|
| 1 | T002 | Codex | `prompts/T002-codex-prompt.md` | pending |

### Round 2: Claude Code ทำ P0/P1 (ระหว่าง Codex ทำ T002)
| Order | Task ID | Owner | Description | Status |
|-------|---------|-------|-------------|--------|
| 2 | T001 | Claude Code | Audit improve.md vs live | pending |
| 3 | T003 | Claude Code | Fix round3 undefined | pending |
| 4 | T004 | Claude Code | Fix re-ask normalize loop | pending |
| 5 | T005 | Claude Code | Fix queue worker retry | pending |

### Round 3: Codex ทำ docs (หลัง Claude Code fix P0/P1)
| Order | Task ID | Owner | Prompt File | Status |
|-------|---------|-------|-------------|--------|
| 6 | T006 | Codex | `prompts/T006-codex-prompt.md` | pending |

## Workflow Summary

```
เริ่ม
  │
  ├─► คุณ: paste T002 prompt ลง Codex
  │     Codex ทำ regression test matrix
  │
  ├─► (ขนาน) Claude Code: ทำ T001 → T003 → T004 → T005
  │
  ▼
Codex เสร็จ T002 → คุณบอก Claude Code
Claude Code review T002
  │
  ▼
Claude Code เสร็จ P0/P1 → sync ให้ Codex
  │
  ▼
คุณ: paste T006 prompt ลง Codex
Codex ทำ docs update
  │
  ▼
Codex เสร็จ T006 → คุณบอก Claude Code
Claude Code review T006
  │
  ▼
Claude Code สรุปผลทั้งหมดให้คุณ
  │
จบ
```
