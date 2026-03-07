## Last Checkpoint — 2026-03-07 BKK

### Git State
- Branch: `stable`
- Last commit: `6cd6c84 fix(caltex): verify Code (Parse Result) — no fix needed, probe rows excluded`

### Status
- ✅ CC v2.1 hooks + agents + MCP + skills — ติดตั้งและทดสอบแล้ว
- ✅ scg_prawet — 2 rows excluded (field_diffs=null historical)
- ✅ caltex probe rows — 2 rows excluded (maintenance probes t044/t052a)
- ✅ gg-data 401 — ไม่มีปัญหา (n8n process มี OCR_SHARED_API_KEY จาก root .env แล้ว)
- ⏭️ ไม่มี task ค้างอยู่ — พร้อมรับ task ใหม่

### Key Context
- gg-data gateway: ทำงาน 200 OK — auth ผ่านแล้ว
- VENDOR_MAP ครบ 10 vendors ใน 3 workflows + GSheets
- Custom sub-agents ใน `.claude/agents/` ไม่สามารถ invoke ผ่าน Agent tool `subagent_type` ได้ — Claude invoke อัตโนมัติตาม description
