# T049 — MEA VENDOR_MAP + FIELD_DIFFS Wrong-Value Cleanup

**Owner:** Codex (Executor)
**Reviewer:** Claude Code
**Priority:** 🟡 Medium — vendor_name แสดง tax_id + FIELD_DIFFS มี test data noise

---

## Discussion

- 2026-03-03 Codex: Live `FIELD_DIFFS` rows expose `correct_value` rather than `user_value`, and the spec's expected outcome (`excluded_test: 16`, `wrong_value: 21`) matches only the 16 fake-vendor rows that are currently `diff_type='wrong_value'`. Proceeding with that narrower filter and leaving the fake-vendor `missing` / `format_error` rows untouched.

---

## Part A — เพิ่ม MEA ใน VENDOR_MAP (3 workflows)

### Problem

MEA บิลไฟฟ้า (vendor_tax_id=`0994000165200`) doc_type ถูก (electricity — auto-detected โดย T047 Gemini)
แต่ `vendor_name` แสดงเป็น raw tax_id เพราะ MEA ไม่อยู่ใน VENDOR_MAP

### Solution

เพิ่ม entry MEA ใน VENDOR_MAP ทั้ง 3 workflows (เหมือน pattern KTB Fleet / SCG Prawet)

**Entry ที่ต้องเพิ่ม:**
```
vendor_tax_id: '0994000165200'
vendor_name:   'MEA'
doc_type:      'electricity'
```

### Workflows ที่ต้อง patch (ผ่าน REST API เท่านั้น)

#### 1. gg-data-gateway (`XtaSg9pLDuPERtI8`) — `Code (VENDOR_MAP)` node
Format: array
```javascript
// เพิ่มต่อจาก entry สุดท้าย (ก่อน ];)
{ vendor_tax_id: '0994000165200', vendor_name: 'MEA', doc_type: 'electricity', notes: 'การไฟฟ้านครหลวง' },
```

#### 2. ocr-km-logger (`jmJHPPj0OM5LcZ0n`) — `Code (Compute Diffs)` node
Format: object ใน `const VENDOR_MAP = { ... }`
```javascript
// เพิ่มต่อจาก entry สุดท้าย
'0994000165200': { vendor_name: 'MEA', doc_type: 'electricity' },
```

#### 3. ocr-training (`KW0QRXxRh9MjdPaY`) — `Code (Prepare KM Log Payload)` node
Format: object ใน `const VENDOR_MAP = { ... }`
```javascript
// เพิ่มต่อจาก entry สุดท้าย
'0994000165200': { vendor_name: 'MEA', doc_type: 'electricity' },
```

---

## Part B — FIELD_DIFFS wrong_value cleanup (GSheets update)

### Problem (CC analyzed)

FIELD_DIFFS มี 37 wrong_value rows แต่หลายแถวเป็น **test data** ที่ทำให้ accuracy stats บิดเบือน

**Test data rows (user_value='' + vendor fake):**
| vendor_tax_id | count | หมายเหตุ |
|---------------|-------|---------|
| `107537000000` | 7 | tax_id ไม่ครบ 13 หลัก, ocr_value='X'/'XXXX...'/1200/999 |
| `888888888888` | 3 | fake vendor |
| `777777777777` | 3 | fake vendor |
| `666666666666` | 3 | fake vendor |

**Real OCR errors (ควรเก็บไว้):**
| vendor_tax_id | vendor | field | count |
|---------------|--------|-------|-------|
| `0135553012766` | SCG Prawet | total, invoice_number | 16 |
| `0107561000013` | OR | invoice_number, customer_name | 2 |
| `0105564172883` | Caltex | (various) | 2 |

### Solution

Update FIELD_DIFFS rows ที่เป็น test data: set `diff_type = 'excluded_test'`
(ไม่ลบ — เพื่อ preserve history)

**Logic:**
```javascript
// rows ที่ vendor_tax_id ขึ้นต้นด้วย '107537000000' (ไม่ครบ 13 หลัก)
// หรือ vendor_tax_id อยู่ใน ['888888888888','777777777777','666666666666']
// AND user_value === ''
// → update diff_type = 'excluded_test'
```

**วิธีทำ:** สร้าง one-shot n8n workflow (pattern เดียวกับ backfill_accuracy.py)
- อ่าน FIELD_DIFFS sheet → filter test rows → update diff_type แต่ละ row

**Sheet:** `FIELD_DIFFS` ใน spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
**Google credential ID:** `mbHVpStNSdk4RYCB`

---

## Verification

### Part A — VENDOR_MAP
```python
import subprocess, json
r = subprocess.run(['curl','-s',
    'http://localhost:5678/webhook/gg-data?sheet=VENDOR_MAP',
    '-H','x-api-key: ocm-cabonrecipte!'], capture_output=True, text=True)
vendors = json.loads(r.stdout)
mea = [v for v in vendors if '0994000165200' in str(v)]
print(f"MEA in VENDOR_MAP: {mea}")
```

### Part B — FIELD_DIFFS
```python
import subprocess, json, urllib.request
req = urllib.request.Request(
    'http://localhost:5678/webhook/gg-data?sheet=FIELD_DIFFS',
    headers={'x-api-key': 'ocm-cabonrecipte!'}
)
data = json.loads(urllib.request.urlopen(req, timeout=30).read())
excluded = [r for r in data if r.get('diff_type') == 'excluded_test']
wrong = [r for r in data if r.get('diff_type') == 'wrong_value']
print(f"excluded_test: {len(excluded)}, wrong_value remaining: {len(wrong)}")
```

Expected: `excluded_test: 16, wrong_value: 21`
(SCG Prawet 16 rows: เก็บไว้เป็น wrong_value — user_value='' = data quality issue ไม่ใช่ test data)

---

## Important Notes

- **ห้ามลบ rows** ใน FIELD_DIFFS — ใช้ update diff_type เท่านั้น
- **SCG Prawet 16 rows** ให้เก็บไว้เป็น wrong_value ปกติ (ocr_value มีค่า, user_value ว่าง = user ไม่ได้ correct แต่ไม่ใช่ test data)
  - เหตุผล: ยังไม่มีหลักฐานว่า test → CC จะ follow up แยกต่างหาก
- **ใช้ Python urllib** เสมอเมื่อ call API ที่มี `!` ใน header — ห้ามใช้ curl กับ `!`
- **VENDOR_MAP patch**: fetch live nodes ก่อนเสมอ — ห้าม patch จาก workflow_history

---

## Definition of Done

- [x] MEA (`0994000165200`) อยู่ใน VENDOR_MAP ทั้ง 3 workflows (gg-data-gateway, km-logger, ocr-training)
- [x] gg-data-gateway VENDOR_MAP readback แสดง MEA entry
- [x] FIELD_DIFFS: 16 test rows เปลี่ยนเป็น `diff_type=excluded_test`
- [x] FIELD_DIFFS: wrong_value เหลือ 21 rows (จาก 37)
- [x] `./scripts/verify_nowThai_sync.sh` ผ่าน
- [x] HANDOFF.md updated

---

## Closing Template

```
Runtime patched: Patched live workflows via n8n REST API: `XtaSg9pLDuPERtI8` (`Code (VENDOR_MAP)`), `jmJHPPj0OM5LcZ0n` (`Code (Compute Diffs)`), and `KW0QRXxRh9MjdPaY` (`Code (Prepare KM Log Payload)`) now all include `0994000165200 => MEA / electricity`. Ran a one-shot maintenance workflow `tmp-t049-field-diffs-cleanup` (`p0d9Bc5yzbilSzSE`) via `/rest/workflows/{id}/run` execution `155916` to update the 16 fake-vendor `wrong_value` rows in `OCR_TRAIN_FIELD_DIFFS` by matching `row_number`, then archived and deleted the helper workflow.
Verified from: `GET /webhook/gg-data?sheet=VENDOR_MAP` now returns `{'vendor_tax_id':'0994000165200','vendor_name':'MEA','doc_type':'electricity'}` ✅; `GET /webhook/gg-data?sheet=FIELD_DIFFS` now reports `excluded_test: 16` and `wrong_value: 21`, with excluded row numbers `[2,3,4,6,10,15,16,234,235,236,237,238,239,240,241,242]` ✅; `./scripts/verify_nowThai_sync.sh` passed ✅.
Docs synced: This spec updated (Discussion note + DoD + Closing Template filled) and `docs/collab/HANDOFF.md` moved T049 to Recently Completed.
Remaining limits: The cleanup workflow was intentionally temporary and has already been deleted, so post-run verification relies on sheet readback plus execution `155916` rather than a preserved helper workflow definition.
```

---

*Created by CC 2026-03-03 — T049 MEA vendor + FIELD_DIFFS cleanup*
