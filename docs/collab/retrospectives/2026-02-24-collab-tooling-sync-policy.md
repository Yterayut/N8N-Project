# Session Retrospective — 2026-02-24 (collab-tooling-sync-policy)

---

## 1. Git Summary

| Commit | Message | ทำอะไร |
|--------|---------|--------|
| `3f47cb3` | docs(retro): rename retrospective to include slug title | เปลี่ยนชื่อไฟล์ retro ก่อนหน้าให้มี slug |
| `27ac3ad` | feat(skills): add /recap + /fyi skills and Golden Rules to CLAUDE.md | สร้าง /recap, /fyi skills + Golden Rules 9 ข้อ |
| `2a17bd7` | docs(collab): notify Codex of Golden Rules + new skills | อัปเดต HANDOFF.md แจ้ง Codex + sync |
| `c78b584` | policy: sync-every-action mandatory for all agents | เพิ่ม Sync Policy ใน CLAUDE.md + HANDOFF.md |
| `306926c` | test(hook): verify post-commit auto-sync fires on stable | ทดสอบ hook รอบแรก (มี error race condition) |
| `d1b898e` | test(hook): verify post-commit sync after sleep fix | ลอง sleep 0.5s (ยังไม่แก้) |
| `ef944bd` | test(hook): verify post-commit sync — unset GIT env vars fix | แก้ root cause: unset GIT_DIR/INDEX env vars |

---

## 2. Tasks Completed

### /recap skill (`ef944bd`)
- **ปัญหา:** เปิด session ใหม่ต้องพิมพ์ "อ่าน FORWARD.md แล้วต่อ" เอง
- **แก้:** `.claude/commands/recap.md` — fresh-start orientation อัตโนมัติ
- **ไฟล์:** `.claude/commands/recap.md`
- **ผล:** พิมพ์ `/recap` ทีเดียวได้ orientation ครบ

### /fyi skill
- **ปัญหา:** การ log ลง MEMORY.md ต้องรอ Claude แก้ไฟล์ เสียเวลา
- **แก้:** `.claude/commands/fyi.md` — one-liner memory log
- **ไฟล์:** `.claude/commands/fyi.md`
- **ผล:** `/fyi <ข้อมูล>` → append MEMORY.md ทันที ไม่มีพิธี

### Golden Rules (CLAUDE.md)
- **ปัญหา:** ไม่มีกฎชัดเจนว่าห้ามทำอะไรบ้าง
- **แก้:** เพิ่ม `## Golden Rules` section ใน CLAUDE.md 9 ข้อ
- **ไฟล์:** `CLAUDE.md`
- **ผล:** ทั้ง Claude Code และ Codex มี guardrail ชัดเจน

### Sync Policy + post-commit hook
- **ปัญหา:** sync ทำแค่ตอน task เสร็จ — Codex อาจทำงานบน stale code
- **แก้:**
  1. เพิ่ม `## Sync Policy — MANDATORY` ใน CLAUDE.md
  2. ติดตั้ง `.git/hooks/post-commit` — auto-sync ทุก commit
- **ไฟล์:** `CLAUDE.md`, `docs/collab/HANDOFF.md`, `.git/hooks/post-commit`
- **ผล:** ทุก commit บน stable → auto `sync.sh all` ทันที / ทุก commit บน agents/codex → auto push

---

## 3. Decisions Made

### ใช้ git post-commit hook แทน manual policy
- **ตัดสินใจ:** ติดตั้ง hook ใน `.git/hooks/post-commit` แทนที่จะพึ่งแค่ CLAUDE.md
- **เหตุผล:** Manual policy → agent ลืมได้ / Hook → บังคับทุก commit ไม่มีข้อยกเว้น
- **ทางเลือกที่ไม่เลือก:** wrapper script (`commit-and-sync.sh`) — ต้องจำว่าต้องรัน script ไหน hook ดีกว่าเพราะ transparent

### unset GIT_DIR/INDEX ใน hook แทน sleep
- **ตัดสินใจ:** `unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE GIT_PREFIX` ต้นไฟล์ hook
- **เหตุผล:** root cause คือ git inject env vars ให้ hook ที่ทำให้ sub-git commands งง — ไม่ใช่ timing
- **ทางเลือกที่ไม่เลือก:** `sleep 0.5` — แก้ symptom ไม่ใช่ root cause

### /recap ใช้ FORWARD + HANDOFF + MEMORY ทั้ง 3 ไฟล์
- **ตัดสินใจ:** recap อ่าน 3 sources พร้อมกันแล้วสรุปออกมาเดียว
- **เหตุผล:** แต่ละไฟล์มีข้อมูล overlap บางส่วน — รวมทีเดียวดีกว่าให้อ่านแยก
- **ผลลัพธ์:** orientation ครบ 1 คำสั่ง

---

## 4. Issues Found / Deferred

### hook อยู่ใน `.git/hooks/` — ไม่ถูก commit เข้า repo
- **severity:** medium
- **รายละเอียด:** `.git/hooks/` ไม่ถูก track โดย git — ถ้า clone ใหม่หรือ worktree ใหม่ ต้องติดตั้ง hook ใหม่เอง
- **defer:** ยังไม่จำเป็นตอนนี้ (single machine, single worktree pair)
- **next action:** สร้าง `scripts/collab/install-hooks.sh` ที่ symlink hook เข้าไป ถ้าต้องการ reproducibility

### Codex post-commit branch ยัง push แบบ no-verify ไม่ได้ตรวจ
- **severity:** low
- **รายละเอียด:** Hook ฝั่ง Codex แค่ `git push origin agents/codex` แต่ถ้า Codex commit แล้ว push fail จะมีแค่ WARNING ไม่มีการ retry
- **defer:** ยอมรับได้ Claude Code จะ sync เองตอน stable commit ถัดไป

---

## 5. What Went Well / What Was Hard

### ดี
- Oracle collab framework เป็น reference ที่ดีมาก — ได้ไอเดีย /recap, /fyi, Golden Rules ครบ
- hook แก้ปัญหา enforcement ได้สมบูรณ์กว่า manual policy มาก
- debug root cause (GIT env vars) ใช้เวลาน้อย — ทดสอบไม่กี่ round

### ยาก / ใช้เวลานานกว่าคาด
- race condition ใน hook ทดสอบ 2 รอบก่อนเจอ root cause จริง (คิดว่าเป็น timing ก่อน)
- git worktree internal path (`--git-common-dir` return relative vs absolute) ต้องระวัง

---

## 6. Memory Update

อัปเดต MEMORY.md:
- Collaboration section: เปลี่ยน sync command เป็น `sync.sh all`
- เพิ่ม section "Collab Tooling" — hook, skills ที่ติดตั้งแล้ว

---

## 7. One-Line Session Summary

ติดตั้ง collab tooling ชุดใหม่ (/recap, /fyi, Golden Rules, post-commit hook) เพื่อให้ Claude Code และ Codex sync กันอัตโนมัติทุก commit โดยไม่ต้องพึ่ง memory ของ agent
