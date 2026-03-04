# T051 — Backfill vendor_name + Exclude T032 Smoke ใน TRAIN_CASES

**Owner:** Codex (Executor)
**Reviewer:** Claude Code
**Priority:** 🟠 Medium — KPI report แสดง unknown 14 docs + raw tax IDs แทน vendor names

---

## Problem

KPI Report 2026-03-04 แสดง:
- `unknown: 100% (14 docs)` — vendor_name ว่างในแถวเก่า
- raw tax IDs แทน vendor names: `105563149021`, `105555130588` ฯลฯ — ขาด leading `0`
- `T032 Smoke: 100% (1 doc)` — test data ปนใน production report

**Root cause:** TRAIN_CASES rows ที่ถูก log ก่อน VENDOR_MAP ครบ มี:
1. `vendor_name = ''` (blank) — km-logger เก่า
2. `vendor_name = '105563149021'` (12-digit numeric) — km-logger ขาด leading `0` → lookup ไม่เจอ

---

## Data Analysis (CC pre-analyzed)

**Spreadsheet:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
**Tab:** `OCR_TRAIN_CASES`
**GSheets credential:** `mbHVpStNSdk4RYCB`

### Group A — Blank vendor_name, resolvable (10 rows)
| row_number | vendor_tax_id (stored) | → normalized (13-digit) | → vendor_name |
|------------|----------------------|------------------------|---------------|
| 10 | `107536000064` | `0107536000064` | Succo/Socco |
| 11 | `105564172883` | `0105564172883` | Caltex |
| 19 | `107536000064` | `0107536000064` | Succo/Socco |
| 20 | `105564172883` | `0105564172883` | Caltex |
| 21 | `105564172883` | `0105564172883` | Caltex |
| 22 | `107536000064` | `0107536000064` | Succo/Socco |
| 23 | `107561000013` | `0107561000013` | OR |
| 26 | `105563149021` | `0105563149021` | Shell |
| 27 | `105563149021` | `0105563149021` | Shell |
| 28 | `105555130588` | `0105555130588` | PT MAX LPG |
| 29 | `105555130588` | `0105555130588` | PT MAX LPG |

### Group B — Blank vendor_name, NOT in VENDOR_MAP (leave blank)
| row_number | vendor_tax_id | หมายเหตุ |
|------------|---------------|---------|
| 6 | `` (empty) | doc_type=other — ไม่มีข้อมูล |
| 24 | `105536080112` | ไม่รู้จัก |
| 25 | `105532107890` | ไม่รู้จัก |

### Group C — Raw numeric as vendor_name (9 rows)
| row_number | vendor_name (stored) | → normalized | → vendor_name |
|------------|---------------------|-------------|---------------|
| 42 | `105563149021` | `0105563149021` | Shell |
| 43 | `105555130588` | `0105555130588` | PT MAX LPG |
| 44 | `107561000013` | `0107561000013` | OR |
| 45 | `105563149021` | `0105563149021` | Shell |
| 46 | `107536000064` | `0107536000064` | Succo/Socco |
| 47 | `115555015410` | `0115555015410` | Bangchak |
| 48 | `107548000650` | `0107548000650` | Siam Gas |
| 49 | `994000165200` | `0994000165200` | MEA |
| 50 | `107537000882` | `0107537000882` | KTB Fleet |

### Group D — T032 Smoke exclusion (1 row)
| row_number | case_id | vendor_name | action |
|------------|---------|-------------|--------|
| 9 | `tc_1772034775859_h12o6d` | `T032 Smoke` | `status = 'excluded'` |

---

## VENDOR_MAP Reference

```javascript
const VENDOR_MAP = {
  '0105564172883': { vendor_name: 'Caltex', doc_type: 'fuel' },
  '0105555130588': { vendor_name: 'PT MAX LPG', doc_type: 'fuel' },
  '0107536000064': { vendor_name: 'Succo/Socco', doc_type: 'fuel' },
  '0107561000013': { vendor_name: 'OR', doc_type: 'fuel' },
  '0107538000703': { vendor_name: 'PTG', doc_type: 'fuel' },
  '0105563149021': { vendor_name: 'Shell', doc_type: 'fuel' },
  '0107536000269': { vendor_name: 'Bangchak', doc_type: 'fuel' },
  '0115555015410': { vendor_name: 'Bangchak', doc_type: 'fuel' },
  '0107548000650': { vendor_name: 'Siam Gas', doc_type: 'fuel' },
  '0107537000882': { vendor_name: 'KTB Fleet', doc_type: 'fleet_card' },
  '0994000165200': { vendor_name: 'MEA', doc_type: 'electricity' },
};
```

---

## Implementation

### วิธีทำ: One-shot n8n maintenance workflow (pattern เดียวกับ T049 Part B)

1. **Login n8n REST API** (cookie auth)
2. **สร้าง temporary workflow** ชื่อ `tmp-t051-backfill-vendor` ผ่าน REST API
3. Workflow logic (Code node):

```javascript
// Normalize tax_id: เติม leading '0' ถ้า 12 หลัก
function normalizeTaxId(tid) {
  const s = String(tid || '').trim();
  if (/^\d{12}$/.test(s)) return '0' + s;
  if (/^\d{13}$/.test(s)) return s;
  return s;
}

const VENDOR_MAP = {
  '0105564172883': 'Caltex',
  '0105555130588': 'PT MAX LPG',
  '0107536000064': 'Succo/Socco',
  '0107561000013': 'OR',
  '0107538000703': 'PTG',
  '0105563149021': 'Shell',
  '0107536000269': 'Bangchak',
  '0115555015410': 'Bangchak',
  '0107548000650': 'Siam Gas',
  '0107537000882': 'KTB Fleet',
  '0994000165200': 'MEA',
};

const rows = $input.all().map(i => i.json);
const updates = [];

for (const row of rows) {
  const rowNum = row.row_number;
  let vendorName = String(row.vendor_name || '');
  const vendorTaxId = String(row.vendor_tax_id || '');

  // Group D: T032 Smoke → exclude
  if (vendorName === 'T032 Smoke') {
    updates.push({ row_number: rowNum, field: 'status', value: 'excluded' });
    continue;
  }

  // Group A: blank vendor_name → resolve from vendor_tax_id
  const isBlank = vendorName === '' || vendorName === null;
  // Group C: raw numeric vendor_name (10-13 digits)
  const isRawTaxId = /^\d{10,13}$/.test(vendorName);

  if (isBlank || isRawTaxId) {
    // Determine which tax_id to use for lookup
    const lookupId = isBlank
      ? normalizeTaxId(vendorTaxId)
      : normalizeTaxId(vendorName);  // Group C uses vendor_name as the raw tax_id

    const resolved = VENDOR_MAP[lookupId];
    if (resolved) {
      updates.push({ row_number: rowNum, field: 'vendor_name', value: resolved });
    }
    // If not in VENDOR_MAP → leave as is (Group B)
  }
}

return updates.map(u => ({ json: u }));
```

4. **GSheets Update node**: อัปเดตแต่ละ row ใน `OCR_TRAIN_CASES` โดย match `row_number`
   - Column to match: `row_number`
   - Update column: `vendor_name` หรือ `status` (แยก node ถ้าจำเป็น)
5. **Archive + delete** temporary workflow หลังรัน

### หรือ: Python script โดยตรง (ถ้า one-shot workflow ซับซ้อนเกิน)

ใช้ Google Sheets API ผ่าน n8n webhook `gg-data` ไม่ได้ (read-only)
→ ใช้ n8n GSheets Update node ผ่าน temporary workflow เท่านั้น

---

## Expected Result After Fix

```
KPI Report (next run):
unknown: 0 or ≤3 (rows 6, 24, 25 เท่านั้น)
Shell: 100% (4 docs)
Caltex: ~% (4 docs)
Succo/Socco: ~% (4 docs)
OR: ~% (2 docs)
PT MAX LPG: 100% (3 docs)
Bangchak: ~% (1 doc)
Siam Gas: ~% (1 doc)
MEA: 100% (1 doc)
KTB Fleet: ~% (1 doc)
T032 Smoke: ไม่แสดง (excluded)
```

---

## Verification

```python
import urllib.request, json

req = urllib.request.Request(
    'http://localhost:5678/webhook/gg-data?sheet=TRAIN_CASES',
    headers={'x-api-key': 'ocm-cabonrecipte!'}
)
rows = json.loads(urllib.request.urlopen(req, timeout=30).read())

blank = [r for r in rows if r.get('status') != 'excluded' and not r.get('vendor_name')]
raw   = [r for r in rows if r.get('status') != 'excluded' and str(r.get('vendor_name','')).isdigit()]
smoke = [r for r in rows if r.get('vendor_name') == 'T032 Smoke']
excl  = [r for r in rows if r.get('status') == 'excluded']

print(f"Blank vendor_name (active): {len(blank)}")   # expect ≤3 (rows 6, 24, 25)
print(f"Raw tax ID vendor (active): {len(raw)}")     # expect 0
print(f"T032 Smoke active: {len(smoke)}")            # expect 0
print(f"Excluded rows: {len(excl)}")                 # expect ≥1 (T032 + any pre-existing)
```

---

## Important Notes

- **ห้ามลบ rows** — update เท่านั้น
- **Group B rows** (6, 24, 25) — ไม่ต้องแก้ vendor_name (ไม่รู้จัก tax_id หรือไม่มี tax_id)
- **vendor_tax_id column** — ไม่ต้องแก้ (ปล่อยไว้ 12 หลักได้ — KPI report ใช้แค่ vendor_name)
- **Temporary workflow** — archive + delete หลังรัน (pattern เดียวกับ T049)
- **ใช้ Python urllib** เมื่อ call API ที่มี `!` ใน header

---

## Definition of Done

- [x] Group A: 10 blank vendor_name rows → filled with correct vendor_name
- [x] Group C: 9 raw tax ID rows → replaced with correct vendor_name
- [x] Group D: T032 Smoke row → `status = 'excluded'`
- [x] Verification script: `blank=≤3`, `raw=0`, `T032 Smoke active=0`
- [x] `./scripts/verify_nowThai_sync.sh` ผ่าน (ถ้า patch Code node)
- [x] HANDOFF.md updated

## Closing Template

```
Runtime patched: Created one-shot maintenance workflow `tmp-t051-backfill-vendor` (`IocTDzYIMHvj1bIT`) via n8n REST API, with `continueOnFail=true` on all Google Sheets nodes. The workflow read `OCR_TRAIN_CASES`, normalized 12-digit tax IDs to 13 digits inside `Code (Build Updates)`, backfilled 11 blank `vendor_name` rows and 9 raw-tax-id `vendor_name` rows, and updated row 9 (`tc_1772034775859_h12o6d`) to `status=excluded`. Ran it via `POST /rest/workflows/IocTDzYIMHvj1bIT/run` using full `workflowData` + `triggerToStartFrom: {name:'Manual Trigger'}`; execution `156250` finished with `status=success`. Archived and deleted the helper workflow afterward; `GET /rest/workflows/IocTDzYIMHvj1bIT` now returns `404`.
Verified from: `GET /webhook/gg-data?sheet=TRAIN_CASES` now reports `blank_active=2`, `raw_active=0`, `T032 Smoke active=0` ✅. Remaining blank rows are only row 24 (`vendor_tax_id=105536080112`) and row 25 (`vendor_tax_id=105532107890`); row 6 was already `status=excluded`, so it is not counted as active. Spot-check rows confirm row 10/19/22 => `Succo/Socco`, 11/20/21 => `Caltex`, 23/44 => `OR`, 26/27/42/45 => `Shell`, 28/29/43 => `PT MAX LPG`, 47 => `Bangchak`, 48 => `Siam Gas`, 49 => `MEA`, 50 => `KTB Fleet`, and row 9 now has `status=excluded` ✅. `./scripts/verify_nowThai_sync.sh` passed ✅.
Docs synced: This spec updated (DoD checked + Closing Template filled) and `docs/collab/HANDOFF.md` moved T051 to Recently Completed.
Remaining limits: The helper workflow was intentionally deleted after execution, so post-run evidence is based on execution `156250`, REST cleanup checks, and `gg-data` sheet readback rather than a preserved workflow definition.
```

---

*Created by CC 2026-03-04 — T051 backfill vendor_name TRAIN_CASES*
