# T044 — Single Source of Truth: Unified OCR Feedback Pipeline

**Author:** Claude Code (CC)
**Date:** 2026-03-01
**Assignee:** Codex
**Priority:** High
**Risk:** กลาง (แก้ Code nodes ใน 3 workflows — ไม่ได้เพิ่ม webhook ใหม่)
**Depends on:** ไม่มี (CC ได้ patch gg-data-gateway เรียบร้อยแล้ว)

---

## Overview

ปัจจุบัน OCR มี data quality ปัญหา 2 ประเด็น:

1. **TRAIN_CASES rows มี `vendor_name` ว่าง / `doc_type=other`** — โดยเฉพาะ `source=telegram_train` 13 rows ทั้งหมด (`vendor_name=''`) และ `feedback_kpi` 6 rows (`vendor_name='unknown'`/`''`)
2. **`ocr_accuracy_pct` ว่างสำหรับ telegram_train** — 13 rows ไม่มี accuracy score ทำให้ KPI report ไม่ครบ

ผลกระทบ: KPI report และ Dashboard แสดง doc_type="other", vendor="unknown" ซึ่งไม่ถูกต้อง → ตัวเลข accuracy ผิด

**เป้าหมาย:** ให้ TRAIN_CASES เป็น single source of truth — ทุก row มี `doc_type`, `vendor_name`, และ `ocr_accuracy_pct` ที่ถูกต้อง

**CC ได้ทำแล้ว (ก่อน assign Codex):**
- ✅ gg-data-gateway: เพิ่ม `VENDOR_MAP` output (Code node hardcoded) — test: `GET /webhook/gg-data?sheet=VENDOR_MAP` returns 5 vendors
- ✅ gg-data-gateway: เพิ่ม `VENDOR_MAP` ใน allowed sheets list

**Codex ทำ (Phase 1+2+3):**
- Phase 1: T029A (ocr-km-logger) — เพิ่ม vendor enrichment + accuracy calc
- Phase 2: T028 (ocr-training) — เพิ่ม vendor_name lookup จาก VENDOR_MAP
- Phase 3: T029B (ocr-km-suggest) — เปลี่ยน KPI report grouping

---

## Scope

**In scope:**
- Patch `Code (Compute Diffs)` ใน ocr-km-logger (`jmJHPPj0OM5LcZ0n`): เพิ่ม VENDOR_MAP lookup + accuracy calc
- Patch `Code (Prepare KM Log Payload)` ใน ocr-training (`KW0QRXxRh9MjdPaY`): เพิ่ม vendor_name enrichment
- Patch `Code (Analyze Patterns)` ใน ocr-km-suggest (`NkKd02QyzLRcpIJM`): เปลี่ยน KPI output format

**Out of scope:**
- ไม่แก้ schema TRAIN_CASES (columns ไม่เปลี่ยน)
- ไม่แก้ ocr-dashboard (CC จะทำ Phase 4 ทีหลัง)
- ไม่แก้ OCR_FEEDBACK (ยังคงอยู่สำหรับ backward compat)

---

## Technical Spec

### VENDOR_MAP (ข้อมูลอ้างอิง — ใช้ hardcoded JS ตามที่ CC กำหนด)

```js
const VENDOR_MAP = {
  '0105564172883': { vendor_name: 'Caltex',      doc_type: 'fuel' },
  '0105555130588': { vendor_name: 'PT MAX LPG',  doc_type: 'fuel' },
  '0107536000064': { vendor_name: 'Succo/Socco', doc_type: 'fuel' },
  '0107537000000': { vendor_name: 'PTT/OR',      doc_type: 'fuel' },
  '0100000000000': { vendor_name: 'Shell',        doc_type: 'fuel' },
};

function enrichFromVendorMap(vendor_tax_id, existing_doc_type, existing_vendor_name) {
  const normalized = String(vendor_tax_id || '').replace(/^0+/, '').replace(/[^0-9]/g, '');
  // Try both with and without leading zero
  const key1 = String(vendor_tax_id || '').trim();
  const key2 = '0' + normalized;
  const match = VENDOR_MAP[key1] || VENDOR_MAP[key2] || null;
  return {
    doc_type: (existing_doc_type && existing_doc_type !== 'other' && existing_doc_type !== 'unknown' && existing_doc_type !== '')
      ? existing_doc_type
      : (match ? match.doc_type : (existing_doc_type || 'other')),
    vendor_name: (existing_vendor_name && existing_vendor_name !== 'unknown' && existing_vendor_name !== '')
      ? existing_vendor_name
      : (match ? match.vendor_name : (existing_vendor_name || 'unknown')),
  };
}
```

### ocr_accuracy_pct computation

```js
// สำหรับ telegram_train (ไม่มี accuracy จาก feedback)
// Formula: (4 - min(diff_count, 4)) / 4 * 100
// 0 corrections = 100%, 1 = 75%, 2 = 50%, 3 = 25%, 4+ = 0%
function computeAccuracy(diff_count) {
  return Math.round((4 - Math.min(diff_count, 4)) / 4 * 100);
}
```

---

### Phase 1 — ocr-km-logger (`jmJHPPj0OM5LcZ0n`)

**แก้ `Code (Compute Diffs)`** — เพิ่มใน `trainCase` object:

```js
// เพิ่มหลัง `const trainCase = { ... };` และก่อน return:

// Vendor enrichment (VENDOR_MAP lookup)
const VENDOR_MAP = { /* ... ตามด้านบน */ };
function enrichFromVendorMap(vendor_tax_id, existing_doc_type, existing_vendor_name) { /* ... */ }

const enriched = enrichFromVendorMap(
  trainCase.vendor_tax_id,
  trainCase.doc_type,
  trainCase.vendor_name
);
trainCase.doc_type = enriched.doc_type;
trainCase.vendor_name = enriched.vendor_name;

// Compute ocr_accuracy_pct ถ้าไม่มี (เช่น telegram_train)
if (trainCase.ocr_accuracy_pct === '' || trainCase.ocr_accuracy_pct === null || trainCase.ocr_accuracy_pct === undefined) {
  trainCase.ocr_accuracy_pct = Math.round((4 - Math.min(diffCount, 4)) / 4 * 100);
}
```

**ไม่ต้องเพิ่ม node ใหม่** — แค่แก้ code ใน `Code (Compute Diffs)` ที่มีอยู่แล้ว

---

### Phase 2 — ocr-training (`KW0QRXxRh9MjdPaY`)

**แก้ `Code (Prepare KM Log Payload)`** — เพิ่ม vendor enrichment ก่อน return:

```js
// เพิ่มก่อน return [{json: {...}}]:

const VENDOR_MAP = { /* ... ตามด้านบน */ };
function enrichFromVendorMap(vendor_tax_id, existing_doc_type, existing_vendor_name) { /* ... */ }

const kmPayload = { source: 'telegram_train', ... };  // payload ที่มีอยู่แล้ว

const vendorTaxId = String(goldBills[0]?.vendor_tax_id || '');
const enriched = enrichFromVendorMap(
  vendorTaxId,
  kmPayload.doc_type,
  kmPayload.vendor_name
);
kmPayload.doc_type = enriched.doc_type;
kmPayload.vendor_name = enriched.vendor_name;

// ocr_accuracy_pct จะถูก compute โดย ocr-km-logger (Compute Diffs)
// ไม่ต้อง compute ที่นี่
```

---

### Phase 3 — ocr-km-suggest (`NkKd02QyzLRcpIJM`)

**แก้ `Code (Analyze Patterns)`** — เปลี่ยน KPI output:

1. **ลบ `doc_type` requirement** ออกจาก filter ใน `cases`:
   ```js
   // เดิม: if (!c.case_id || !c.created_at || !c.doc_type) return false;
   // ใหม่: if (!c.case_id || !c.created_at) return false;
   ```
   (doc_type อาจว่างสำหรับบาง record — ไม่ควร filter ออก)

2. **เพิ่ม KPI section ใหม่** ใน return object:
   ```js
   // Accuracy by doc_type
   const byDocType = {};
   for (const c of realCases) {
     const dt = String(c.doc_type || 'other');
     if (!byDocType[dt]) byDocType[dt] = { total: 0, sum: 0 };
     const pct = Number(c.ocr_accuracy_pct);
     if (!isNaN(pct)) { byDocType[dt].sum += pct; byDocType[dt].total++; }
   }

   // Accuracy by vendor_name
   const byVendor = {};
   for (const c of realCases) {
     const vn = String(c.vendor_name || 'unknown');
     if (!byVendor[vn]) byVendor[vn] = { total: 0, sum: 0 };
     const pct = Number(c.ocr_accuracy_pct);
     if (!isNaN(pct)) { byVendor[vn].sum += pct; byVendor[vn].total++; }
   }

   // Overall accuracy
   const allWithPct = realCases.filter(c => !isNaN(Number(c.ocr_accuracy_pct)));
   const overallAvg = allWithPct.length > 0
     ? Math.round(allWithPct.reduce((s, c) => s + Number(c.ocr_accuracy_pct), 0) / allWithPct.length)
     : null;
   ```

3. **เพิ่ม Telegram message section** ที่รวม doc_type + vendor accuracy:
   ```js
   // ใน Code (Build Telegram) — เพิ่มต่อจาก summary เดิม:
   // หรือ return ข้อมูล kpi ไว้ใน return object แล้วให้ Code (Build Telegram) ใช้
   ```

4. **Update KPI fields ใน return object** ของ `Code (Analyze Patterns)`:
   ```js
   return [{json: {
     // ... existing fields ...
     real_cases: realCases.length,
     overall_accuracy_pct: overallAvg,
     accuracy_by_doc_type: Object.entries(byDocType).map(([dt, s]) => ({
       doc_type: dt,
       count: s.total,
       avg_accuracy: s.total > 0 ? Math.round(s.sum / s.total) : null,
     })),
     accuracy_by_vendor: Object.entries(byVendor).map(([vn, s]) => ({
       vendor_name: vn,
       count: s.total,
       avg_accuracy: s.total > 0 ? Math.round(s.sum / s.total) : null,
     })),
     // ... rest of existing fields ...
   }}];
   ```

5. **แก้ `Code (Build Telegram)`** ให้แสดง doc_type/vendor breakdown:
   ```
   🎯 Overall Accuracy: 87%
   📝 Total: 28 bills (13 training + 15 production)

   📁 By Doc Type:
     fuel: 92% (13 docs)
     other: 70% (15 docs)

   🏪 By Vendor:
     Caltex: 98% (4 docs)
     Succo/Socco: 95% (4 docs)
     PTT/OR: 89% (5 docs)
   ```

   ถ้า Codex ไม่เจอ `Code (Build Telegram)` แยกต่างหาก → ดูใน `Code (Analyze Patterns)` แล้ว build ใน section เดียวกัน

---

## Workflow IDs (อย่าสับสน)

| Workflow | ID | Phase |
|----------|----|-------|
| ocr-km-logger | `jmJHPPj0OM5LcZ0n` | Phase 1 |
| ocr-training | `KW0QRXxRh9MjdPaY` | Phase 2 |
| ocr-km-suggest | `NkKd02QyzLRcpIJM` | Phase 3 |
| gg-data-gateway | `XtaSg9pLDuPERtI8` | ✅ Done (CC) |

---

## Security Considerations

1. มีจุดรับ input ใหม่ไหม? → **ไม่มี** — แก้ existing code nodes เท่านั้น
2. มี secret/credential ใหม่ไหม? → **ไม่มี**
3. มีข้อมูล sensitive รั่วไหม? → **ไม่มี** — enrichment ใช้แค่ vendor_tax_id จาก payload ที่มีอยู่แล้ว

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| VENDOR_MAP key format ไม่ตรง (leading zero) | enrichFromVendorMap() try both `'0xxx'` and raw key |
| ocr_accuracy_pct = NaN ถ้า diff_count ผิดรูป | ใช้ `Math.min(Number(diffCount)||0, 4)` |

---

## Discussion

_Codex: เพิ่ม concerns ที่นี่ก่อน implement_

---

## Test Plan

### Phase 1 — ocr-km-logger

| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | ส่ง feedback_kpi สำหรับ Caltex (vendor_tax_id=`0105564172883`) | POST /ocr-km-log | TRAIN_CASES row ใหม่: `doc_type=fuel`, `vendor_name=Caltex`, `ocr_accuracy_pct` มีค่า |
| T2 | ส่ง feedback_kpi สำหรับ vendor ที่ไม่รู้จัก | POST /ocr-km-log | `doc_type=other`, `vendor_name=unknown`, `ocr_accuracy_pct` มีค่า |
| T3 | ตรวจ TRAIN_CASES ใน GSheets | gg-data-gateway TRAIN_CASES | telegram_train rows มี `ocr_accuracy_pct` (ไม่ว่าง) |

### Phase 2 — ocr-training

| # | Test | Method | Expected |
|---|------|--------|----------|
| T4 | Telegram training: confirm บิล Caltex | Telegram flow | TRAIN_CASES row: `vendor_name=Caltex`, `doc_type=fuel` |
| T5 | Telegram training: confirm บิล vendor ไม่รู้จัก | Telegram flow | `vendor_name=unknown` (ไม่ crash) |

### Phase 3 — ocr-km-suggest

| # | Test | Method | Expected |
|---|------|--------|----------|
| T6 | Trigger KM suggest | POST /webhook/ocr-km-suggest | Response มี `accuracy_by_doc_type`, `accuracy_by_vendor`, `overall_accuracy_pct` |
| T7 | Telegram KPI message | Check Telegram | แสดง breakdown doc_type + vendor |
| T8 | Auth check | wrong key | 401 |

### Edge Cases

| # | Test | Expected |
|---|------|----------|
| T9 | vendor_tax_id ว่าง | fallback: `doc_type=other`, `vendor_name=unknown` (ไม่ crash) |
| T10 | diff_count=0 | `ocr_accuracy_pct=100` |
| T11 | diff_count=4 | `ocr_accuracy_pct=0` |

---

## Definition of Done

**Implemented:**
- [ ] Phase 1: `Code (Compute Diffs)` ใน `jmJHPPj0OM5LcZ0n` มี VENDOR_MAP lookup + accuracy calc
- [ ] Phase 2: `Code (Prepare KM Log Payload)` ใน `KW0QRXxRh9MjdPaY` มี vendor enrichment
- [ ] Phase 3: `Code (Analyze Patterns)` ใน `NkKd02QyzLRcpIJM` มี doc_type/vendor grouping + overall_accuracy
- [ ] Phase 3: Telegram KPI message แสดง breakdown

**Verified from system (required):**
- [ ] TRAIN_CASES row ใหม่ (หลัง Phase 1): `doc_type` + `vendor_name` + `ocr_accuracy_pct` ไม่ว่าง
- [ ] ocr-km-suggest response มี `accuracy_by_doc_type` + `accuracy_by_vendor`

**E2E Passed:**
- [ ] Exec ID: `_______` — Phase 1 T1 test
- [ ] Exec ID: `_______` — Phase 3 T6 test

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] `verify_nowThai_sync.sh` รัน ✅ (ถ้าแก้ Code nodes ที่มี nowThai)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
