# T047 — Auto-detect doc_type from OCR Output (Gemini Classification)

**Owner:** Codex (Executor)
**Reviewer:** Claude Code
**Priority:** 🟠 Medium — ระบบทำงานได้แต่ electricity/fleet_card ไม่ถูกจัดหมวด

---

## Problem

ตอนนี้ `doc_type` ใน TRAIN_CASES ถูก set จาก VENDOR_MAP เท่านั้น:
- VENDOR_MAP มีแค่ fuel vendors → electricity/fleet_card bills ได้ `doc_type = 'other'`
- Dashboard และ accuracy report ไม่แสดง electricity/fleet_card category

**Root cause:** ไม่มี mechanism ระบุ doc_type จาก OCR output โดยตรง

---

## Solution: เพิ่ม `doc_type` field ใน base OCR prompt

ให้ Gemini ระบุ `doc_type` ใน JSON output เอง โดยเพิ่มใน base prompt และทุก structure definition

---

## Changes Required

### 1. PROMPTS GSheet — base key

เพิ่ม rule ใน base prompt:

```
- doc_type: ระบุประเภทเอกสาร ให้เลือกจาก "fuel" | "electricity" | "fleet_card" | "other"
  - "fuel"        = บิลน้ำมัน, LPG, แก๊สสำหรับยานพาหนะ
  - "electricity"  = บิลค่าไฟฟ้า, ใบแจ้งหนี้การไฟฟ้า (PEA, MEA)
  - "fleet_card"  = บิลบัตรน้ำมัน fleet card, PTT Fleet, Caltex StarCard
  - "other"       = เอกสารอื่น ๆ ที่ไม่ตรงกับข้างต้น
```

เพิ่ม `"doc_type": ""` ใน base JSON structure (ถ้ามี) และใน fuel/electricity/fleet_card structure แต่ละอัน:

```json
{
  "doc_type": "fuel",
  "vendor_tax_id": "",
  ...
}
```

### 2. ocr-invoice-processor — Code (Parse Result) + Code in JavaScript9

**Workflow ID:** `up1n75qEhbsXswii`

หลังจาก parse JSON จาก Gemini → extract `doc_type` field ถ้ามี:

```javascript
// Extract doc_type from OCR output if present
const ocrDocType = obj.doc_type || '';
const VALID_DOC_TYPES = ['fuel', 'electricity', 'fleet_card', 'other'];
if (ocrDocType && VALID_DOC_TYPES.includes(ocrDocType)) {
  result.doc_type = ocrDocType;
} else {
  // Fallback: keep existing doc_type from VENDOR_MAP or input
  result.doc_type = result.doc_type || 'other';
}
```

**Nodes ที่ต้อง patch (ใช้ pattern เดียวกับ Caltex swap fix):**
- `Code (Parse Result)` — queue/fallback path
- `Code in JavaScript9` — direct webhook path
- `Code in JavaScript24` — ตรวจว่ามีหรือไม่ก่อน patch

### 3. ocr-km-logger — Code (Compute Diffs)

**Workflow ID:** `jmJHPPj0OM5LcZ0n`

ใน `enrichFromVendorMap` function — ให้ prioritize doc_type จาก OCR output ก่อน VENDOR_MAP:

```javascript
// Priority: OCR-detected doc_type > VENDOR_MAP doc_type > 'other'
const validDocTypes = ['fuel', 'electricity', 'fleet_card', 'other'];
const ocrDocType = validDocTypes.includes(existing_doc_type) ? existing_doc_type : null;

return {
  doc_type: ocrDocType || (match ? match.doc_type : (existing_doc_type || 'other')),
  vendor_name: vendorNameOk
    ? existing_vendor_name
    : (match ? match.vendor_name : (existing_vendor_name || 'unknown')),
};
```

### 4. ocr-training — Code (Prepare KM Log Payload)

**Workflow ID:** `KW0QRXxRh9MjdPaY`

ตรวจสอบว่า `doc_type` จาก OCR result ถูกส่งผ่านมาใน payload ที่ส่งให้ km-logger ด้วย

---

## Verification Steps

### Step 1: ทดสอบ fuel bill (regression test)
```bash
# ส่ง fuel bill ผ่าน /webhook/ocr-dev → ตรวจ doc_type ใน response
# Expected: doc_type = "fuel"
```

### Step 2: ทดสอบ electricity bill
```bash
# ใช้ตัวอย่าง electricity bill จาก docs/gg/ หรือ test file
# Expected: doc_type = "electricity" ใน OCR response
```

### Step 3: ตรวจ km-logger
```bash
python3 << 'EOF'
import sqlite3, json
DB = '/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite'
conn = sqlite3.connect(DB)
# Check latest km-logger execution for doc_type
row = conn.execute("""
    SELECT id, startedAt FROM execution_entity
    WHERE workflowId='jmJHPPj0OM5LcZ0n'
    ORDER BY startedAt DESC LIMIT 1
""").fetchone()
print(f"Latest km-logger exec: {row}")
conn.close()
EOF
```

### Step 4: ตรวจ Code (Parse Result) — doc_type extraction
```bash
python3 << 'EOF'
import sqlite3, json
DB = '/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite'
conn = sqlite3.connect(DB)
row = conn.execute("SELECT nodes FROM workflow_history WHERE workflowId='up1n75qEhbsXswii' ORDER BY createdAt DESC LIMIT 1").fetchone()
nodes = json.loads(row[0])
for name in ['Code (Parse Result)', 'Code in JavaScript9']:
    n = next((n for n in nodes if n.get('name')==name), None)
    if n:
        code = n['parameters']['jsCode']
        has_doctype = 'doc_type' in code and 'VALID_DOC_TYPES' in code
        print(f"  {'✅' if has_doctype else '❌'} {name} — doc_type extraction")
conn.close()
EOF
```

---

## Important Notes

### ⚠️ ห้ามเปลี่ยน base JSON structure โดยไม่ระวัง
- การเพิ่ม `"doc_type"` ใน JSON structure อาจทำให้ Gemini ส่งคืน field เพิ่ม
- ต้องทดสอบ fuel bill regression ก่อน merge เสมอ

### ⚠️ fallback ต้องถูกต้อง
- ถ้า Gemini ไม่ส่ง doc_type มา → ต้อง fallback เป็น VENDOR_MAP → ถ้าไม่มีใน map → 'other'
- ห้ามทำให้ fuel bills ที่ทำงานอยู่แล้วเสียหาย

### ⚠️ nowThai sync
- ทุกครั้งที่ patch Code nodes → รัน `./scripts/verify_nowThai_sync.sh`

---

## Definition of Done

- [ ] base prompt มี doc_type classification rule
- [ ] fuel/electricity/fleet_card JSON structure มี `"doc_type"` field
- [ ] `Code (Parse Result)` extract doc_type จาก Gemini output
- [ ] `Code in JavaScript9` extract doc_type จาก Gemini output
- [ ] km-logger `Code (Compute Diffs)` prioritize OCR doc_type ก่อน VENDOR_MAP
- [ ] Fuel bill regression: doc_type='fuel' ยังถูกต้อง
- [ ] `./scripts/verify_nowThai_sync.sh` ผ่าน
- [ ] HANDOFF.md updated

---

## Discussion

_(Codex ใส่ comment ก่อน implement ถ้ามี concern)_

---

*Created by CC 2026-03-02 — T047 doc_type auto-detect*
