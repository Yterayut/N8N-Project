# T050 — Migrate ocr-kpi-report จาก OCR_FEEDBACK → TRAIN_CASES + FIELD_DIFFS

**Owner:** Codex (Executor)
**Reviewer:** Claude Code
**Priority:** 🟠 Medium — KPI report แสดงข้อมูลผิด (เก่า/legacy sheet)

---

## Problem

`ocr-kpi-report` (`yCqvdl3vrHGgiBMt`) ยังอ่านจาก sheet `OCR_FEEDBACK` (legacy pre-T044)
ทำให้ report แสดงข้อมูลผิด:
- 16 docs (เก่า) แทนที่จะเป็น 33+ docs (ปัจจุบัน)
- doc_type = 'other' ทั้งหมด (ไม่มี enrichment)
- vendor = 'unknown' ทั้งหมด (column เก่า)

**Source of truth ปัจจุบัน (ตั้งแต่ T044):** `TRAIN_CASES` + `FIELD_DIFFS`

---

## Current Workflow Structure

```
Schedule Trigger (08:00)
Manual Trigger
  → Google Sheets (OCR_FEEDBACK)  ← ต้อง migrate
  → Code node: Aggregate KPI      ← ต้อง rewrite
  → Telegram (OCR KPI Report)     ← chatId OK
```

**Spreadsheet ID:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
**GSheets credential ID:** `mbHVpStNSdk4RYCB`

---

## Solution

### Step 1: เปลี่ยน GSheets node — OCR_FEEDBACK → TRAIN_CASES

Patch `Google Sheets (OCR_FEEDBACK)` node ใน `yCqvdl3vrHGgiBMt` ผ่าน REST API:
- `sheetName.value` = `"TRAIN_CASES"` (mode: `"name"`)
- `sheetName.cachedResultName` = `"TRAIN_CASES"`
- ล้าง schema ออก (ถ้ามี)

### Step 2: เพิ่ม GSheets node อ่าน FIELD_DIFFS

**ไม่จำเป็นต้องเพิ่ม node ใหม่** — ให้ Code node คำนวณ field accuracy โดยใช้ข้อมูลจาก TRAIN_CASES เท่านั้น (ดู logic ด้านล่าง)

### Step 3: Rewrite Code node: Aggregate KPI

**Field mapping เปลี่ยนเป็น:**

| เดิม (OCR_FEEDBACK) | ใหม่ (TRAIN_CASES) |
|--------------------|--------------------|
| `accuracy_score` | `ocr_accuracy_pct` |
| `vendor` | `vendor_name` |
| `doc_type` | `doc_type` (เหมือนเดิม) |
| filter: non-empty `accuracy_score` | filter: `status != 'excluded'` AND `ocr_accuracy_pct` != '' |

**Field accuracy (vendor_tax_id, invoice_number ฯลฯ):**
- OCR_FEEDBACK มี `${field}_match` columns ซึ่ง TRAIN_CASES ไม่มี
- ให้เอา field breakdown ออกจาก report ก่อน (เพราะข้อมูล FIELD_DIFFS ต้องการ node แยก)
- หรือถ้าต้องการ: คำนวณจาก `ocr_accuracy_pct` แทน (rough estimate)

**New Code (แทน Aggregate KPI ทั้งหมด):**

```javascript
const rows = $input.all().map(i => i.json || {});

// Filter: active + scored
const valid = rows.filter(r =>
  r.status !== 'excluded' &&
  r.ocr_accuracy_pct !== '' &&
  r.ocr_accuracy_pct !== null &&
  r.ocr_accuracy_pct !== undefined &&
  String(r.ocr_accuracy_pct) !== ''
);

if (!valid.length) return [{ json: { report: 'ยังไม่มีข้อมูล feedback', total_feedback: 0 } }];

const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// By doc_type
const byType = {};
valid.forEach(r => {
  const t = String(r.doc_type || 'other');
  (byType[t] ||= []).push(num(r.ocr_accuracy_pct));
});

// By vendor_name
const byVendor = {};
valid.forEach(r => {
  const v = String(r.vendor_name || 'unknown');
  (byVendor[v] ||= []).push(num(r.ocr_accuracy_pct));
});

const overall = avg(valid.map(r => num(r.ocr_accuracy_pct)));

// [SHARED] nowThai
const nowThai = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const date = new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });

const typeLines = Object.entries(byType)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([t, a]) => `  ${t}: ${avg(a)}% (${a.length} docs)`);

const vendorLines = Object.entries(byVendor)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10)
  .map(([v, a]) => `  ${v}: ${avg(a)}% (${a.length} docs)`);

const report = [
  `📊 OCR KPI Report — ${date}`,
  '',
  `🎯 Overall Accuracy: ${overall}%`,
  `📝 Total: ${valid.length} scored / ${rows.filter(r => r.status !== 'excluded').length} total bills`,
  '',
  `📁 แยกตาม Doc Type:`,
  ...typeLines,
  '',
  `🏪 แยกตาม Vendor (top 10):`,
  ...vendorLines,
].join('\n');

return [{ json: { report, overall, total_feedback: valid.length, byType, byVendor } }];
```

---

## Implementation Steps

1. Login n8n REST API (cookie auth)
2. GET workflow `yCqvdl3vrHGgiBMt`
3. Find `Google Sheets (OCR_FEEDBACK)` node → patch sheetName → `TRAIN_CASES`
4. Find `Code node: Aggregate KPI` → replace jsCode กับ new code ด้านบน
5. PATCH workflow กลับ
6. Verify: GET workflow กลับ ตรวจ sheetName = TRAIN_CASES + jsCode มี `ocr_accuracy_pct`
7. Trigger test: POST `/rest/workflows/yCqvdl3vrHGgiBMt/run` หรือ Manual trigger
8. ตรวจ output: `total_feedback` ควรเป็น 33+ และ doc_type มี fuel/electricity/fleet_card
9. `./scripts/verify_nowThai_sync.sh`

---

## Verification

```python
import subprocess, json

def curl_json(*args):
    r = subprocess.run(['curl','-s','-c','/tmp/n8n_cookies.txt','-b','/tmp/n8n_cookies.txt']+list(args), capture_output=True, text=True)
    return json.loads(r.stdout)

curl_json('-X','POST','http://localhost:5678/rest/login','-H','Content-Type: application/json','-d','{"emailOrLdapLoginId":"yterayut@gmail.com","password":"Marn2530"}')

wf = curl_json('http://localhost:5678/rest/workflows/yCqvdl3vrHGgiBMt')
nodes = wf.get('data', wf).get('nodes', [])

gs = next((n for n in nodes if 'OCR_FEEDBACK' in n.get('name','') or 'TRAIN' in str(n.get('parameters',{}))), None)
code = next((n for n in nodes if n.get('name','') == 'Code node: Aggregate KPI'), None)

print("GSheets sheet:", gs['parameters']['sheetName'] if gs else 'not found')
print("Code has ocr_accuracy_pct:", 'ocr_accuracy_pct' in code['parameters']['jsCode'] if code else False)
```

**Expected output after fix:**
```
📊 OCR KPI Report — 3/3/2569
🎯 Overall Accuracy: 96%
📝 Total: 33 scored / 49 total bills
📁 แยกตาม Doc Type:
  fuel: 96% (31 docs)
  electricity: 100% (1 docs)
  fleet_card: 100% (1 docs)
🏪 แยกตาม Vendor (top 10):
  PTT: ...
  ...
```

---

## Important Notes

- **ห้ามลบ sheet `OCR_FEEDBACK`** — เก็บไว้เป็น archive
- **`nowThai()` block ต้องมี `// [SHARED]` comment** ใน jsCode — เพื่อ verify_nowThai_sync.sh
- **`vendor_name` column**: บาง rows อาจว่าง (ตอนนี้ 13 rows) → แสดงเป็น 'unknown' ได้ (ถูกต้อง)
- **Telegram chatId**: `={{ $env.TELEGRAM_OCR_CHAT_ID }}` — ไม่ต้องแก้ (n8n อ่านจาก env ได้แล้ว)
- **ห้าม patch workflow JSON โดยตรง** — ใช้ REST API เท่านั้น

---

## Definition of Done

- [ ] `Google Sheets (OCR_FEEDBACK)` node อ่านจาก sheet `TRAIN_CASES`
- [ ] `Code node: Aggregate KPI` ใช้ `ocr_accuracy_pct` + `vendor_name` + `status` filter
- [ ] `nowThai()` block มี `// [SHARED]` comment
- [ ] Workflow fetch verify: sheetName=TRAIN_CASES + `ocr_accuracy_pct` ใน code
- [ ] Test run: total_feedback >= 33, doc_type มี fuel (ไม่ใช่แค่ other)
- [ ] `./scripts/verify_nowThai_sync.sh` ผ่าน
- [ ] HANDOFF.md updated

---

*Created by CC 2026-03-03 — T050 KPI report migrate TRAIN_CASES*
