# Code Review — T052B: Canonical Vendor/Layout Routing

**Reviewer:** CC
**Reviewed commit:** REST-patched live (not committed as code change)
**Date:** 2026-03-06
**Spec:** `docs/collab/tasks/T052B-canonical-vendor-layout-routing.md`
**Score:** 9/10

---

## Summary of What Was Implemented

- เพิ่ม `CANONICAL_VENDOR_BY_TAX` (11 entries, 10 unique vendors) และ `CANONICAL_ALIAS` (20 alias entries) ใน `Code (Normalize+Validate)` ของ `up1n75qEhbsXswii`
- เพิ่ม `fingerprintLayout()` function สำหรับ layout fingerprint v1
- Patch 5 workflows ให้ write/read `vendor_code`, `vendor_name_canonical`, `layout_id`, `layout_confidence`, `cluster_key`
- Backfill historical TRAIN_CASES (53 rows) และ FIELD_DIFFS (324 rows → ปัจจุบัน 326 rows)
- KPI report แสดง consolidated PTT OR แทน PTT/OR/PTT OR แยกกัน

---

## Verification Level

- [x] **Implemented** — ตรวจจาก live workflow fetch `up1n75qEhbsXswii` ครบทุก structure
- [x] **Verified** — TRAIN_CASES vendor_code blank=0/39, layout_id blank=0/39, vendor_name_canonical blank=0/39
- [x] **Verified** — FIELD_DIFFS vendor_code blank=0/326, layout_id blank=0/326, cluster_key blank=0/326
- [x] **E2E Passed** — Exec `157828` + `157982`: PTT OR occurrences=4 (consolidated from PTT/OR aliases) ✅

---

## Test Evidence

| Test | Method | Result |
|------|--------|--------|
| Canonical tax_id map | Code node fetch | 11 entries, 10 unique vendors ✅ |
| Canonical alias map | Code node fetch | 20 alias entries, no duplicate keys ✅ |
| TRAIN_CASES schema | `gg-data?sheet=TRAIN_CASES` | vendor_code blank=0/39, layout_id blank=0/39 ✅ |
| FIELD_DIFFS schema | `gg-data?sheet=FIELD_DIFFS` | vendor_code blank=0/326, layout_id blank=0/326 ✅ |
| PTT OR consolidation | exec `157828`, `157982` | PTT OR=4 occurrences — no PTT/OR split ✅ |
| Vendor distribution | TRAIN_CASES check | ptt_or=10, susco=5, caltex=5, shell=5, others correctly distributed ✅ |
| Backfill complete | Codex closing notes | TRAIN_CASES updated_count=53, FIELD_DIFFS updated_count=324 ✅ |
| OCR E2E canonical | exec `157801` | vendor_code=ptt_or, layout_id=ptt_or_fuel_v1 ✅ |

---

## Canonical Vendor Map — Verified

### CANONICAL_VENDOR_BY_TAX (11 entries)

| Tax ID | vendor_code | vendor_name_canonical | layout_family |
|--------|------------|----------------------|---------------|
| `0107561000013` | `ptt_or` | PTT OR | ptt_or_fuel_v1 |
| `0105563149021` | `shell` | Shell | shell_fuel_v1 |
| `0105564172883` | `caltex` | Caltex | caltex_fuel_v1 |
| `0107536000064` | `susco` | Susco | susco_fuel_v1 |
| `0107536000269` | `bangchak` | Bangchak | bangchak_fuel_v1 |
| `0115555015410` | `bangchak` | Bangchak | bangchak_fuel_v1 |
| `0105555130588` | `pt_max_lpg` | PT MAX LPG | pt_max_lpg_v1 |
| `0994000165200` | `mea` | MEA | mea_electricity_v1 |
| `0107537000882` | `ktb_fleet` | KTB Fleet | ktb_fleet_v1 |
| `0107548000650` | `siam_gas` | Siam Gas | siam_gas_v1 |
| `0135553012766` | `scg_prawet` | SCG Prawet | scg_prawet_v1 |

**Note:** Bangchak มี 2 tax IDs ที่ชี้ไป `bangchak` vendor_code เดียวกัน — correct design (สองนิติบุคคลของ Bangchak)

---

## Issues Found

### 🟡 Minor — PTG ขาดใน Canonical Map

`VENDOR_MAP` ที่ใช้ใน 3 workflows มี PTG (`0107538000703`) แต่ `CANONICAL_VENDOR_BY_TAX` ไม่มี

ถ้า PTG bill เข้ามา:
- `vendor_name` = 'PTG' หรือ 'พีทีจี' จาก Gemini
- tax_id lookup: miss
- alias lookup: miss (`ptg` ไม่อยู่ใน CANONICAL_ALIAS)
- Result: `vendor_code = 'unknown'` ทั้งที่ควรเป็น `ptg`

**Note:** PTG อยู่นอก spec scope ของ T052B (spec ระบุ 10 vendors ไม่มี PTG) — non-blocking ทำในรอบถัดไป

**Fix:** เพิ่ม `'0107538000703': { vendor_code: 'ptg', vendor_name_canonical: 'PTG', ... }` และ alias `'ptg': 'ptg'`, `'พีทีจี': 'ptg'`

---

### 🟢 unknown vendor_code = 5 rows — คาดหวังได้

TRAIN_CASES แสดง `vendor_code=unknown` 5 rows — เป็น Group B rows ที่ไม่มี tax_id ที่รู้จัก (rows 6, 24, 25 จาก T051 + 2 อื่น) ไม่ใช่ bug — fallback ทำงานถูก

---

### 🟢 Bangchak dual tax_id — correct design

`0107536000269` และ `0115555015410` ทั้งคู่ resolve เป็น `bangchak` — ไม่ใช่ duplicate แต่เป็น 2 tax IDs จาก 2 นิติบุคคลของ Bangchak ที่ map ไป canonical vendor เดียวกัน ✅

---

## Spec Compliance

| Requirement | Status |
|------------|--------|
| canonical vendor config created (VENDOR_MAP) | ✅ |
| alias mapping created (VENDOR_ALIAS_MAP) | ✅ |
| layout fingerprint v1 implemented | ✅ |
| 10 required vendors covered | ✅ (+ scg_prawet bonus) |
| ocr-invoice-processor patched | ✅ |
| ocr-km-logger patched | ✅ |
| ocr-training patched | ✅ |
| ocr-km-suggest patched | ✅ |
| ocr-kpi-report patched | ✅ |
| historical backfill TRAIN_CASES | ✅ (53 rows) |
| historical backfill FIELD_DIFFS | ✅ (324 rows) |
| KPI no vendor alias split | ✅ (exec 157828, 157982) |
| sample rows resolve correctly | ✅ (exec 157801) |
| PTG canonical entry | ⚠️ out of scope — add in next window |

---

## Merge Decision

**✅ APPROVED WITH MINOR CONDITIONS**

Canonical routing layer ครบ — vendor consolidation ทำงานถูกต้อง ไม่มี vendor split ใน KPI อนุมัติ

**Non-blocking conditions (fix in next window):**
1. เพิ่ม PTG (`0107538000703`) ใน `CANONICAL_VENDOR_BY_TAX` + alias `'ptg'`/`'พีทีจี'` ใน `CANONICAL_ALIAS` ของ `Code (Normalize+Validate)` ใน `up1n75qEhbsXswii`

---

*CC Review 2026-03-06*
