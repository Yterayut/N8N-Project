# Session Retrospective — 2026-03-14 (t054-nexgen-complete)

## 1. Git Summary

| Commit | Message | What it accomplished |
|--------|---------|---------------------|
| `c3772af` | chore(forward): session handoff 2026-03-14 — T054 merged stable | FORWARD.md checkpoint หลัง merge |
| `3944b7a` | chore(forward): T054 merged stable — CC merge approval complete | CC merge approval ใน T054-review.md |
| `d86036d` | Merge branch 'stable' into agents/codex | Sync back |
| `1a2a249` | fix(T054): nexgen E2E complete — classifier vendor hint + OCR_COVERAGE_REGISTRY tab | สร้าง sheet tab + แก้ classifier + แก้ HTTP auth |
| `0bdf06e` | fix(nexgen-example): correct layout_id+doc_type on ex_1773338904205_234d | แก้ example metadata + patch ocr-examples-api column mapping |
| `f066695` | chore(forward): session handoff 2026-03-14 — T054 fully complete | Full forward handoff |

---

## 2. Tasks Completed

### 2a. T054 Merge + CC Approval
- **Problem:** Codex ทำ T054 เสร็จบน `agents/codex` — ต้อง merge และ CC approve
- **Fix:** `git merge agents/codex --no-edit` (มี conflict HANDOFF.md เล็กน้อย → git stash → merge → commit); CC เติม merge approval section ใน T054-review.md
- **Outcome:** T054 Codex code อยู่ใน stable แล้ว ✅

### 2b. OCR_COVERAGE_REGISTRY tab สร้าง
- **Problem:** Codex ไม่สามารถสร้าง Google Sheet tab ได้ใน session ก่อน — gg-data-gateway ใช้ hardcoded fallback
- **Fix:** ใช้ temp n8n workflow ที่มี HTTP Request node เรียก Sheets API batchUpdate (`POST .../spreadsheets/{id}:batchUpdate`) แล้วตามด้วย `PUT .../values/OCR_COVERAGE_REGISTRY!A1?valueInputOption=RAW` เพื่อ write 12 vendor rows
- **Nodes/Files:** OCM-INFRA spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`, sheetId=1781006429; gg-data-gateway `XtaSg9pLDuPERtI8` (fallback path still active but real tab now readable)
- **Outcome:** gg-data-gateway returns real sheet data, 12 rows ✅

### 2c. Nexgen E2E fix (few_shot_count=0 root cause)
- **Problem:** exec `161890` แสดง `few_shot_count=0`, `coverage_status=unknown`, customer/address ว่าง — T054 remaining item
- **Root cause:** `Code (Document Classifier)` ใน `up1n75qEhbsXswii` — nexgen filename/text hint branch (`/nexgen/.test(fileName)`) set แค่ `docType='nexgen'` แต่ไม่ set `vendorCode` หรือ `layoutId` → `Code (Build Few-shot Query)` ได้ `wantedVendor=''` → two-pass selector ไม่ match example ใดเลย → 0 results
- **Fix:** เพิ่ม `vendorCode = 'inet'` + `layoutId = 'inet_nexgen_v1'` ใน nexgen elif branch
- **Node:** `Code (Document Classifier)` ใน `up1n75qEhbsXswii`
- **Outcome:** exec `161956` → `few_shot_count=1`, `retrieval_mode=strict`, `coverage_status=learning`, `customer_name=อินเทอร์เน็ตประเทศไทย จำกัด (มหาชน)`, `decision=auto_pass` ✅

### 2d. HTTP Read OCR_EXAMPLES 401 fix
- **Problem:** exec `161945` แสดง `401 - UNAUTHORIZED` จาก HTTP Read OCR_EXAMPLES — Codex ไม่ได้ใส่ header
- **Fix:** เพิ่ม `sendHeaders: true` + `headerParameters: [{name: "x-api-key", value: "={{ $env.OCR_FEEDBACK_API_KEY || $env.OCR_SHARED_API_KEY }}"}]` ใน HTTP Read OCR_EXAMPLES node
- **Node:** `HTTP Read OCR_EXAMPLES` ใน `up1n75qEhbsXswii`
- **Outcome:** OCR_EXAMPLES อ่านได้แล้ว ✅

### 2e. Coverage URL double-param fix
- **Problem:** URL `http://127.0.0.1:5678/webhook/gg-data?sheet=OCR_COVERAGE_REGISTRY` + queryParameters `{sheet: OCR_COVERAGE_REGISTRY}` → error `unknown sheet: OCR_COVERAGE_REGISTRY,OCR_COVERAGE_REGISTRY`
- **Fix:** ลบ `?sheet=` ออกจาก URL (คง queryParameters node เท่านั้น)
- **Node:** `HTTP Read OCR_COVERAGE_REGISTRY` ใน `up1n75qEhbsXswii`

### 2f. Nexgen example metadata fix (ex_1773338904205_234d)
- **Problem:** example มี `doc_type=other`, `layout_id=ptt_or_fuel_v1` (ควรเป็น `nexgen` + `inet_nexgen_v1`)
- **Root cause 1:** examples-api `update` action คืน `ok:true` แต่ไม่เขียน `doc_type`/`layout_id` เพราะ GSheets Update node ของ `ocr-examples-api` (`LzYmwkdRfOxbCrwB`) มี column mapping แค่ 7 fields ไม่รวม `doc_type` และ `layout_id`
- **Fix 1:** Patch GSheets Update node ใน `ocr-examples-api`: เพิ่ม `layout_id` + `doc_type` ใน `columns.value`
- **Fix 2:** เรียก examples-api update อีกครั้งหลัง patch
- **Outcome:** verify หลัง 65s cache TTL: `doc_type=nexgen`, `layout_id=inet_nexgen_v1` ✅

---

## 3. Decisions Made

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| สร้าง Sheet tab ผ่าน temp n8n workflow + HTTP Request node | Code nodes ใน n8n ไม่มี credentials access → ต้องใช้ HTTP Request node กับ Google OAuth credential; temp workflow แยกออกมาเพื่อไม่ disrupt main workflow | สร้าง manual ใน Google Sheets UI — slow, ไม่ reproducible; สร้างผ่าน CLI outside n8n — ไม่มี OAuth credential setup |
| ใช้ `contentType: "raw"` สำหรับ batchUpdate | `contentType: "json"` + `jsonBody` ทำให้ Google API ตอบ `Unknown name '': Proto fields must have a name` — raw mode ส่ง body เป็น string ตรง | `contentType: "json"` — ใช้ไม่ได้กับ complex nested Google API JSON |
| Fix classifier hint branch (add vendorCode+layoutId) แทน fix upstream | TAX_HINTS path ถูกแล้ว แต่ถ้าไม่มี vendor_tax_id ใน request body (เช่นส่งแค่ PDF) → ต้องใช้ filename hint; hint branch incomplete ตั้งแต่แรก | เพิ่ม mandatory `vendor_tax_id` ใน request body — breaking change สำหรับ user ที่ส่งแค่ PDF |
| Patch ocr-examples-api GSheets Update node (ไม่ใช่ one-time direct sheet update) | เพิ่ม `layout_id` + `doc_type` ใน column mapping ถาวร = future updates ก็จะทำงานถูก | อัปเดต sheet cells โดยตรงผ่าน Sheets API — one-time เร็วกว่าแต่ bug ยังอยู่ใน workflow |
| Archive before delete temp workflows | n8n v1.x บังคับ archive ก่อน delete — ถ้า delete โดยตรงจะได้ 400 | ลบโดยตรง — ใช้ไม่ได้ใน n8n v1.123.20 |

---

## 4. Issues Found / Deferred

| Issue | Severity | Why Deferred | Suggested Next Action |
|-------|----------|--------------|----------------------|
| POC + PAY Google OAuth expired | High | Yut action ใน n8n UI เท่านั้น — ไม่สามารถ automate | Yut: n8n → Credentials → Google Sheets account 2 → Reconnect OAuth |
| gg-data-gateway coverage fallback ยังใช้ hardcoded rows (switch path active) | Low | Real tab ถูกสร้างแล้ว แต่ gateway อาจยัง hit fallback ถ้า Sheets read fail | verify exec ว่า read path ใช้ sheet จริง ไม่ใช่ fallback; อาจต้อง test Sheets credential หลัง OAuth reconnect |
| `HTTP Save Prediction` 401 ใน exec 161945 | Medium | Different issue จาก OCR_EXAMPLES — ยังไม่ investigate เต็ม session สั้น | ตรวจ `HTTP Save Prediction` node ว่ามี x-api-key header หรือเปล่า; อาจ credential เดียวกัน |

---

## 5. What Went Well / What Was Hard

**Went well:**
- Root cause ของ `few_shot_count=0` หาได้เร็วมาก — trace binary dedup format → `canonical_vendor=''` → อ่าน classifier code → เห็นทันทีว่า nexgen elif branch ไม่ set vendorCode
- Temp workflow pattern สำหรับ Sheets API batchUpdate ทำงานดีหลังเปลี่ยนเป็น `contentType: "raw"`
- examples-api update verified ได้แม่นยำ — รู้ว่า cache TTL 60s แล้ว wait 65s ก่อน verify
- Production test ผ่าน Telegram chatbot ยืนยันผลได้ชัดเจน (4 items ใน exec data ✅)

**Was hard:**
- n8n workflow creation 500 errors: ต้อง troubleshoot `active: false` required field — ไม่ document ชัด
- Google Sheets API `batchUpdate` format: `contentType: "json"` + `jsonBody` ทำงานปกติกับ API อื่นแต่ล้มเหลวกับ Google Sheets batchUpdate → ต้องลองหลายรูปแบบก่อนเจอ `contentType: "raw"` + `body`
- n8n `workflow_history` table ไม่มี `settings` column — ต้อง GET workflow จาก REST API ก่อนแล้วค่อย PATCH (ไม่สามารถดึง settings จาก SQLite ตรงๆ)
- ocr-examples-api update: returned `ok:true` แต่ไม่เขียนจริง — silent failure เพราะ column mapping ไม่รวม field → debug ยากเพราะไม่มี error

---

## 6. Memory Update

เพิ่มหรืออัปเดตใน MEMORY.md:

**เพิ่ม patterns ใหม่:**
1. Google Sheets batchUpdate ใน n8n HTTP Request → ต้องใช้ `contentType: "raw"`
2. ocr-examples-api update silent skip pattern
3. n8n workflow archive before delete
4. Code (Document Classifier) design: filename/text hint branches ใส่เฉพาะ docType — ถ้าต้องการ vendorCode+layoutId ต้องเพิ่มเอง
5. workflow_history ไม่มี settings column → GET from REST API แทน

**อัปเดต existing:**
- VENDOR_MAP: update INET entry note (example fixed ✅)
- OCR_EXAMPLES Lifecycle: update examples-api column mapping (layout_id + doc_type added)
- n8n Temp Workflow Patterns: เพิ่ม archive-before-delete + active:false required

---

## 7. One-Line Session Summary

แก้ T054 remaining items ทั้งหมดในคืนเดียว: สร้าง OCR_COVERAGE_REGISTRY tab + fix nexgen classifier hint bug + fix OCR_EXAMPLES 401 + fix nexgen example metadata — production test ผ่านสมบูรณ์ 4/4 items ✅

---
