# T052D-fix — OCR_EXAMPLES active_for_prompt Backfill

**Owner:** Codex (Executor)
**Reviewer:** Claude Code
**Priority:** 🔴 High — 28/30 active examples excluded from OCR prompts (only ptt_or examples remain)
**Depends on:** T052D (reviewed)
**Date:** 2026-03-06

---

## Problem

T052D เพิ่ม filter `active_for_prompt: true` ใน `Code (Build Few-shot Query)` ของ ocr-invoice-processor
แต่ backfill `active_for_prompt=TRUE` สำหรับ historical rows ยังไม่ได้ทำ

**ผล:** 28/30 active examples ถูก exclude จาก prompt — เหลือแค่ 2 ptt_or examples
→ Shell, Caltex, Succo, PT MAX LPG, MEA, KTB Fleet, Siam Gas, Bangchak = 0 examples ใน OCR prompt

---

## Data (CC pre-analyzed)

**Spreadsheet:** `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
**Tab:** `OCR_EXAMPLES`
**GSheets credential:** `mbHVpStNSdk4RYCB`

### 28 rows to backfill

| row | source | vendor (raw) | doc_type | → canonical_vendor | → layout_id |
|-----|--------|-------------|----------|--------------------|-------------|
| 3 | original | generic | fuel | unknown | layout_unknown_v1 |
| 6 | test_cc_review | PTT/OR | fuel | ptt_or | ptt_or_fuel_v1 |
| 8 | admin_feedback | Bangchak | fuel | bangchak | bangchak_fuel_v1 |
| 11 | manual_training | 107561000013 | fuel | ptt_or | ptt_or_fuel_v1 |
| 12 | manual_training | 105564172883 | fuel | caltex | caltex_fuel_v1 |
| 13 | manual_training | 107536000064 | fuel | susco | susco_fuel_v1 |
| 19 | manual_training | 107536000064 | fuel | susco | susco_fuel_v1 |
| 20 | manual_training | 105564172883 | fuel | caltex | caltex_fuel_v1 |
| 30 | manual_training | 107536000064 | fuel | susco | susco_fuel_v1 |
| 31 | manual_training | 105564172883 | fuel | caltex | caltex_fuel_v1 |
| 32 | manual_training | 105564172883 | fuel | caltex | caltex_fuel_v1 |
| 33 | manual_training | 107536000064 | fuel | susco | susco_fuel_v1 |
| 34 | manual_training | 107561000013 | fuel | ptt_or | ptt_or_fuel_v1 |
| 35 | manual_training | 105536080112 | fuel | unknown | layout_unknown_v1 |
| 36 | manual_training | 105532107890 | fuel | unknown | layout_unknown_v1 |
| 37 | manual_training | 105563149021 | fuel | shell | shell_fuel_v1 |
| 38 | manual_training | 105563149021 | fuel | shell | shell_fuel_v1 |
| 40 | manual_training | 105555130588 | fuel | pt_max_lpg | pt_max_lpg_v1 |
| 41 | manual_training | 105563149021 | fuel | shell | shell_fuel_v1 |
| 42 | manual_training | 105563149021 | fuel | shell | shell_fuel_v1 |
| 44 | manual_training | 105555130588 | fuel | pt_max_lpg | pt_max_lpg_v1 |
| 45 | manual_training | 107561000013 | fuel | ptt_or | ptt_or_fuel_v1 |
| 46 | manual_training | 105563149021 | fuel | shell | shell_fuel_v1 |
| 47 | manual_training | 107536000064 | fuel | susco | susco_fuel_v1 |
| 48 | manual_training | 115555015410 | fuel | bangchak | bangchak_fuel_v1 |
| 49 | manual_training | 107548000650 | fuel | siam_gas | siam_gas_v1 |
| 50 | manual_training | 994000165200 | electricity | mea | mea_electricity_v1 |
| 51 | manual_training | 107537000882 | fleet_card | ktb_fleet | ktb_fleet_v1 |

---

## Source → Class Mapping

| source | example_class | trust_level |
|--------|--------------|-------------|
| admin_feedback | trusted_gold | high |
| manual_training | accepted_example | medium |
| original | accepted_example | medium |
| test_cc_review | experimental | low |

---

## Tax ID → Canonical Vendor Mapping

```javascript
const CANONICAL_BY_TAX = {
  '107561000013': { vendor_code: 'ptt_or',    layout_id: 'ptt_or_fuel_v1' },
  '105564172883': { vendor_code: 'caltex',    layout_id: 'caltex_fuel_v1' },
  '107536000064': { vendor_code: 'susco',     layout_id: 'susco_fuel_v1' },
  '107536000269': { vendor_code: 'bangchak',  layout_id: 'bangchak_fuel_v1' },
  '115555015410': { vendor_code: 'bangchak',  layout_id: 'bangchak_fuel_v1' },
  '105555130588': { vendor_code: 'pt_max_lpg',layout_id: 'pt_max_lpg_v1' },
  '994000165200': { vendor_code: 'mea',       layout_id: 'mea_electricity_v1' },
  '107537000882': { vendor_code: 'ktb_fleet', layout_id: 'ktb_fleet_v1' },
  '107548000650': { vendor_code: 'siam_gas',  layout_id: 'siam_gas_v1' },
  '105563149021': { vendor_code: 'shell',     layout_id: 'shell_fuel_v1' },
  '135553012766': { vendor_code: 'scg_prawet',layout_id: 'scg_prawet_v1' },
};

// Normalize: strip leading 0 for lookup (vendor column stores 12-digit raw tax_id)
function normTax(v) {
  const s = String(v||'').replace(/\D/g,'');
  return s.startsWith('0') ? s.slice(1) : s;  // strip leading 0 for 13-digit → 12-digit lookup
}
// OR: normalize to 13-digit (add leading 0 if 12-digit) — use whichever matches stored format
```

**Note:** `vendor` column ใน OCR_EXAMPLES เก็บ 12-digit (ไม่มี leading `0`) — map ตาม table ด้านบนโดยตรงได้เลย

---

## Implementation

### วิธีทำ: One-shot n8n maintenance workflow (pattern เดียวกับ T051)

1. **Login n8n REST API** (cookie auth, `yterayut@gmail.com`)
2. **สร้าง temporary workflow** ชื่อ `tmp-t052d-fix-examples`
3. **Workflow nodes:**

```
Webhook (manual trigger)
→ Google Sheets (Read OCR_EXAMPLES)
→ Code (Compute Updates)
→ Google Sheets (Update OCR_EXAMPLES)   ← match on row_number
→ Respond
```

4. **Code (Compute Updates) logic:**

```javascript
const SOURCE_CLASS = {
  'admin_feedback':  { example_class: 'trusted_gold',    trust_level: 'high'   },
  'manual_training': { example_class: 'accepted_example', trust_level: 'medium' },
  'original':        { example_class: 'accepted_example', trust_level: 'medium' },
  'test_cc_review':  { example_class: 'experimental',    trust_level: 'low'    },
};

const CANONICAL_BY_TAX = {
  '107561000013': { vendor_code: 'ptt_or',    layout_id: 'ptt_or_fuel_v1' },
  '105564172883': { vendor_code: 'caltex',    layout_id: 'caltex_fuel_v1' },
  '107536000064': { vendor_code: 'susco',     layout_id: 'susco_fuel_v1' },
  '107536000269': { vendor_code: 'bangchak',  layout_id: 'bangchak_fuel_v1' },
  '115555015410': { vendor_code: 'bangchak',  layout_id: 'bangchak_fuel_v1' },
  '105555130588': { vendor_code: 'pt_max_lpg',layout_id: 'pt_max_lpg_v1' },
  '994000165200': { vendor_code: 'mea',       layout_id: 'mea_electricity_v1' },
  '107537000882': { vendor_code: 'ktb_fleet', layout_id: 'ktb_fleet_v1' },
  '107548000650': { vendor_code: 'siam_gas',  layout_id: 'siam_gas_v1' },
  '105563149021': { vendor_code: 'shell',     layout_id: 'shell_fuel_v1' },
  '135553012766': { vendor_code: 'scg_prawet',layout_id: 'scg_prawet_v1' },
};

// vendor column stores raw 12-digit (no leading 0)
function resolveCanonical(vendorRaw) {
  const key = String(vendorRaw||'').replace(/\D/g,'');
  return CANONICAL_BY_TAX[key] || { vendor_code: 'unknown', layout_id: 'layout_unknown_v1' };
}

const rows = $input.all().map(i => i.json);
const updates = [];

for (const row of rows) {
  const isTrue = (v) => ['true','1','yes','y'].includes(String(v||'').toLowerCase().trim());
  const active = isTrue(row.active);
  const activeForPrompt = isTrue(row.active_for_prompt);

  // Only backfill rows that are active=TRUE but active_for_prompt blank/false
  if (!active || activeForPrompt) continue;

  const source = String(row.source || '').toLowerCase().trim();
  const cls = SOURCE_CLASS[source] || { example_class: 'experimental', trust_level: 'low' };
  const canonical = resolveCanonical(row.vendor);

  updates.push({
    row_number: row.row_number,
    active_for_prompt: 'TRUE',
    example_class: cls.example_class,
    trust_level: cls.trust_level,
    canonical_vendor: canonical.vendor_code,
    layout_id: row.layout_id || canonical.layout_id,  // keep existing if already set
  });
}

return updates.map(u => ({ json: u }));
```

5. **GSheets Update node** — match column: `row_number`, update columns: `active_for_prompt`, `example_class`, `trust_level`, `canonical_vendor`, `layout_id`
   - **ต้องรวม `row_number` ใน columns.value ด้วย** (LESSON: matchingColumns ต้องมี match column ด้วย)
6. **Delete temporary workflow** หลังรัน

---

## Verification

```python
import urllib.request, json
from collections import Counter

req = urllib.request.Request(
    'http://localhost:5678/webhook/gg-data?sheet=OCR_EXAMPLES',
    headers={'x-api-key': 'ocm-cabonrecipte!'}
)
rows = json.loads(urllib.request.urlopen(req, timeout=30).read())

active = [r for r in rows if str(r.get('active','')).lower() in ['true','1','yes']]
active_prompt = [r for r in active if str(r.get('active_for_prompt','')).lower() in ['true','1','yes','y']]
excluded = [r for r in active if str(r.get('active_for_prompt','')).lower() not in ['true','1','yes','y']]

print(f"active rows: {len(active)}")
print(f"active_for_prompt=True: {len(active_prompt)}")  # expect 30
print(f"still excluded: {len(excluded)}")               # expect 0
print(f"vendor dist: {dict(Counter(r.get('canonical_vendor','?') for r in active_prompt))}")
# expect: ptt_or, caltex, susco, shell, pt_max_lpg, bangchak, mea, ktb_fleet, siam_gas, unknown
```

---

## Important Notes

- **ห้ามแก้ rows ที่ active_for_prompt='True' อยู่แล้ว** (2 probe rows — keep as-is)
- **ห้ามแก้ rows ที่ active='FALSE'** — ปล่อยไว้ excluded ตามเดิม
- **layout_id**: ถ้า row มี layout_id อยู่แล้ว → ใช้ค่าเดิม; ถ้าว่าง → ใช้ค่าจาก CANONICAL_BY_TAX
- **ห้ามลบ rows** — update เท่านั้น
- **ใช้ Python urllib** เมื่อ call API ที่มี `!` ใน header
- **Temporary workflow** — archive + delete หลังรัน

---

## Definition of Done

- [ ] `active_for_prompt=TRUE` สำหรับ 28 rows (active=TRUE, was blank)
- [ ] `example_class` + `trust_level` backfilled ตาม source mapping ครบ
- [ ] `canonical_vendor` + `layout_id` backfilled ตาม tax_id mapping ครบ
- [ ] Verification: `active_for_prompt=True` count = 30, `excluded` = 0
- [ ] Verification: vendor distribution มี shell/caltex/susco/ptt_or/pt_max_lpg ฯลฯ ≠ ptt_or only
- [ ] Temporary workflow ถูกลบหลังรัน
- [ ] HANDOFF.md updated

---

*Created by CC 2026-03-06 — T052D backfill fix*
