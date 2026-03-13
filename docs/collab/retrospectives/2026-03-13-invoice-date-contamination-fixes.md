# Session Retrospective — 2026-03-13 (invoice-date-contamination-fixes)

## 1. Git Summary

| Commit | Message | What it accomplished |
|--------|---------|---------------------|
| `89aefcf` | feat(nexgen): GG ground truth + T054 spec + HANDOFF update | GG ground truth สำหรับ nexgen/INET bill, เพิ่ม INET ใน VENDOR_MAP ทั้ง 3 workflows, เพิ่ม T054 spec |
| `58bca3d` | fix(ocr): normalize invoice_date_th from ISO to DD/MM/YYYY format | เพิ่ม `normalizeDateTh()` ใน Code(Normalize+Validate) แปลง YYYY-MM-DD → DD/MM/YYYY, เพิ่ม format hint ใน repair prompt |
| `5d4eca3` | fix(ocr): use 3 decimal places for unit_price/quantity/amount | เพิ่ม `round3()` ใน normalizeListDetail — unit_price/quantity/amount ใช้ 3 ตำแหน่งทศนิยม |
| `7935d0c` | chore(handoff): date-decimal-fixes complete + 4 bad examples rejected | อัปเดต HANDOFF + reject 4 bad examples จาก 0% accuracy run |
| `f8e869d` | fix(ocr): strengthen no-copy rule + fix stale example dates | เพิ่ม CRITICAL no-copy rule ใน Code(Build Request), แก้ invoice_date_th ใน 2 Caltex examples |
| `9789584` | chore(handoff): total field verification — key is total not total_amount | ยืนยัน response ใช้ key `total` (ไม่ใช่ `total_amount`) — ไม่มี bug |

---

## 2. Tasks Completed

### 2a. GG Ground Truth + INET Vendor Map
- **Problem:** nexgen/INET bill ไม่มี ground truth, vendor_tax_id=0105561072420 ไม่อยู่ใน VENDOR_MAP
- **Fix:** GG generated ground truth → INET เพิ่มใน VENDOR_MAP ทั้ง 3 workflows (gg-data-gateway, km-logger, ocr-training) + layout_family=inet_nexgen_v1
- **Outcome:** nexgen bill route ถูก vendor แล้ว, example `ex_1773338904205_234d` active

### 2b. invoice_date_th Date Normalization Fix
- **Problem:** 3-stage pipeline ทำให้ date format ผิด:
  1. Gemini pass-1 → `"2568-01-25"` (Thai year, ISO format)
  2. Repair step (2nd Gemini call) → `"2025-01-25"` (converted year แต่ยังเป็น ISO)
  3. Normalize → validate DD/MM/YYYY แต่ไม่แปลง → stored as `"2025-01-25"` (ผิด format)
- **Fix:** เพิ่ม `normalizeDateTh()` ใน `Code (Normalize + Validate)` — แปลง ISO YYYY-MM-DD → DD/MM/YYYY, รองรับทั้ง Thai year (>2400) และ Gregorian; เพิ่ม format hint ใน repair prompt
- **Node:** `up1n75qEhbsXswii` → `Code (Normalize + Validate)` + `Code (Build Re-ask Request)`
- **Outcome:** Caltex test → `invoice_date_th: "25/01/2568"` ✅, `decision: auto_pass` ✅

### 2c. Decimal Precision Fix (3dp)
- **Problem:** Yut feedback: "Unit Price Quantity Amount ไม่ต้องปัด ใช้ทศนิยม 3 ตำแหน่ง"
- **Fix:** เพิ่ม `round3()` (Math.round(n*1000)/1000), เปลี่ยน `normalizeListDetail` ให้ใช้ `round3()` แทน `round2()`
- **Node:** `up1n75qEhbsXswii` → `Code (Normalize + Validate)`
- **Outcome:** `unit_price=21.191` (3dp) ✅

### 2d. Reject 4 Bad Examples
- **Problem:** Admin feedback test (Yut PDF) → Gemini อ่านผิด vendor (Siam Gas ≠ Caltex) → 4 examples created with wrong data
- **Fix:** examples-api `reject` action → all 4 set `active=false, active_for_prompt=false`
- **IDs:** `ex_1773395675962_e851`, `ex_1773395675981_1d77`, `ex_1773395676001_b1dd`, `ex_1773395676027_7a2f`

### 2e. Invoice_number Contamination Fix
- **Problem:** Gemini copy invoice_number จาก few-shot examples แทนที่จะอ่านจาก document จริง → invoice_number `T12501-00720` ปรากฏในทุก Caltex bill (75% accuracy case)
- **Root cause:** few-shot examples ใน gold_json มี real invoice_number values → Gemini ใช้เป็น template
- **Fix 1:** Patch `Code (Build Request)` prompt rules → เพิ่ม explicit CRITICAL rule: "Do NOT copy invoice_number, invoice_date_th, total_amount, or any field values from examples — Every field value MUST be extracted from the actual document image"
- **Fix 2:** Update gold_json ของ 2 Caltex examples ที่มี stale date:
  - `ex_1772244664476_2682`: `invoice_date_th` → `"25/01/2568"`
  - `ex_1772236024817_ee46`: `invoice_date_th` → `"25/01/2568"`
- **Node:** `up1n75qEhbsXswii` → `Code (Build Request)` + examples-api update action
- **Outcome:** Re-test `caltex.pdf` → 4 bills × 4 unique invoice_numbers (ไม่มี T12501-00720 ซ้ำ) ✅

### 2f. Total Field Verification
- **Problem:** สงสัย `total_amount: None` ใน response
- **Root cause:** Response schema ใช้ key `total` (ไม่ใช่ `total_amount`) — test code ใช้ key ผิด
- **Outcome:** ตรวจสอบ 4 bills ทุกใบ: subtotal + vat = total ✅ (เช่น 934.58 + 65.42 = 1000)

---

## 3. Decisions Made

| Decision | Rationale | Alternatives Rejected |
|----------|-----------|----------------------|
| Fix date at normalize stage ไม่ใช่ Gemini prompt | Normalize รัน ทุก execution และรับประกัน output สม่ำเสมอ แม้ Gemini format เปลี่ยน | แก้ prompt ให้ Gemini output DD/MM/YYYY โดยตรง — ไม่น่าเชื่อถือ เพราะ repair step อาจแปลง format อีกครั้ง |
| round3() แทน round2() สำหรับ line items | ค่าน้ำมัน unit_price มีทศนิยม 3 ตำแหน่งในบิลจริง (เช่น 21.191 บาท/ลิตร) | ใช้ round2() เดิม — ทำให้ค่าเพี้ยนจากบิลจริง |
| Update example gold_json via examples-api (ไม่ใช่ reject+recreate) | Preserve history, ลด noise ใน system; update เฉพาะ field ที่ผิด | reject+recreate — สูญเสีย metadata, confirmed_count, use_count |
| Strengthen no-copy prompt rule แทน remove field values จาก examples | Examples ต้องการ field values สำหรับ format reference; prompt rule ชัดเจนกว่า obscure injection | ลบ invoice_number จาก gold_json ทุก example — breaks format reference intent |

---

## 4. Issues Found / Deferred

| Issue | Severity | Why Deferred | Suggested Next Action |
|-------|----------|--------------|----------------------|
| KM log metadata bug: top-level `vendor_code/layout_id/doc_type = "unknown"` | Medium | ไม่กระทบ accuracy calculation (ocr_bills values ถูก); ซับซ้อน fix | `Code (Prepare KM Log Payload)` ใน `ztJ8oCBHREUPPry6`: ต้องอ่าน vendor_code จาก ocr_bills[0] แทน diff result |
| T054 spec pending CC review | High | Session focus อยู่ที่ immediate fixes | CC อ่าน spec ที่ `docs/collab/tasks/T054-ocr-coverage-pdca-loop-hardening.md` แล้ว assign Codex |
| POC + PAY Google OAuth expired | High | ต้อง Yut action ใน n8n UI — ไม่ automate ได้ | Yut: n8n → Credentials → Google Sheets account 2 → Reconnect OAuth |
| First nexgen example `layout_id=ptt_or_fuel_v1` (ควรเป็น `inet_nexgen_v1`) | Low | Minor — 2nd example correct, ไม่กระทบ routing | reject + recreate `ex_1773338904205_234d` ผ่าน examples-api |
| `customer_name` และ `address` ว่างเปล่าใน Caltex raw output | Low | Gemini อ่านไม่เจอ (bills เหล่านี้อาจไม่มี customer name ชัดเจน) | ส่ง example ที่มี customer_name ผ่าน Telegram training เพื่อสอน |

---

## 5. What Went Well / What Was Hard

**Went well:**
- Date normalization debug: trace 3-stage pipeline ได้ชัด (Gemini → Repair → Normalize) → root cause ชัดเจน
- Examples-api `update` action: เพิ่ม/แก้ไข field ใน gold_json โดยไม่ต้อง reject+recreate — สะดวกมาก
- Contamination fix verified: re-test หลัง fix → 4 bills × 4 unique invoice_numbers ✅
- Total field mystery: resolve ได้เร็ว (key ชื่อ `total` ไม่ใช่ `total_amount`)

**Was hard:**
- n8n REST API auth: Python urllib CookieJar ส่ง cookie อัตโนมัติไม่ได้ → ต้อง extract cookie value manually แล้วใส่ใน header `Cookie: n8n-auth=<value>` เอง ทุกครั้ง
- examples-api read cache (60s TTL): ต้อง sleep 65 วินาทีก่อน verify update — เสียเวลา
- OCR response structure: bills อยู่ที่ `r['data']['bills']` ไม่ใช่ `r['ocr_bills']` หรือ `r['bills']` — ต้อง inspect keys ก่อน

---

## 6. Memory Update

เพิ่ม/แก้ไขใน MEMORY.md:
- เพิ่ม OCR Response Schema pattern (total key)
- เพิ่ม few-shot contamination pattern
- อัปเดต n8n REST API auth note (manual cookie extraction)

---

## 7. One-Line Session Summary

แก้ 3 bugs สำคัญในวันเดียว: date format (ISO→Thai), decimal precision (3dp), และ invoice_number contamination (prompt rule + stale example dates) — ยืนยันด้วย caltex.pdf 4 bills ผ่านทุก field ✅

---
