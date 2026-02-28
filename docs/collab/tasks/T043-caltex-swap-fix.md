# T043 — Caltex Unit Price / Quantity Swap Fix

**Status:** READY FOR IMPLEMENTATION
**Assigned:** Codex
**Priority:** High
**Created:** 2026-02-28

---

## Background

Caltex fuel bills (vendor_tax_id `0105564172883`) — Gemini OCR consistently swaps:
- `unit_price` ← ควรเป็น ~21.xxx บาท/ลิตร (ราคาต่อลิตร)
- `quantity`   ← ควรเป็น ~47.xxx ลิตร (จำนวนลิตร)

แต่ Gemini อ่านกลับกัน: `unit_price=47.19`, `quantity=21.191`

### Rule
```
IF vendor_tax_id == '0105564172883'
AND unit_price (as parsed float) > 30
AND quantity (as parsed float) > 0 AND < 30
THEN swap(unit_price, quantity)
```
ใช้กับ **ทั้ง** bill-level fields (`b.unit_price`, `b.quantity`) และ list_detail-level fields (`b.list_detail[].unit_price`, `b.list_detail[].quantity`)

---

## Objective

แก้ค่า unit_price/quantity ใน Caltex bill **ก่อนที่ `raw_json` จะถูก stringify** ใน `Code (Parse Result)` เพื่อให้ทุก node downstream (รวมถึง `Respond to Webhook6` ที่อ่านจาก `raw_json` โดยตรง) ได้ค่าที่ถูกต้อง

---

## Target Node

**Workflow:** `up1n75qEhbsXswii` (ocr-invoice-processor)
**Node:** `Code (Parse Result)` (id: `87c34b55-7dde-4755-9db6-52710dca2fea`)
**Method:** PATCH via `PATCH /rest/workflows/up1n75qEhbsXswii`

---

## Current Code (relevant section)

```js
try {
  const cleaned = String(raw_text).replace(/```json|```/g, "").trim();
  const obj = JSON.parse(cleaned);
  raw_json = JSON.stringify(obj);        // ← ตรงนี้ raw_json ถูก set จาก Gemini output ดิบ
  raw_text_pretty = JSON.stringify(obj, null, 2);
  bills_count = obj?.bills?.length || 0;
} catch (e) {
  if (!raw_text) status = "error";
}
```

---

## Required Change

แทรก vendor correction block **ระหว่าง** `const obj = JSON.parse(cleaned);` และ `raw_json = JSON.stringify(obj);`

```js
try {
  const cleaned = String(raw_text).replace(/```json|```/g, "").trim();
  const obj = JSON.parse(cleaned);

  // === Vendor corrections (applied before raw_json is built) ===
  if (Array.isArray(obj.bills)) {
    const VENDOR_RULES = [
      {
        vendor_tax_id: '0105564172883',   // Caltex
        // Condition: unit_price and quantity appear swapped
        // (Gemini reads unit_price=47.xx instead of price-per-litre ~21.xx)
        shouldSwap: (up, qty) => up > 30 && qty > 0 && qty < 30,
      }
    ];
    obj.bills = obj.bills.map(bill => {
      const rule = VENDOR_RULES.find(r => String(bill.vendor_tax_id || '') === r.vendor_tax_id);
      if (!rule) return bill;
      const up = parseFloat(String(bill.unit_price || '').replace(/,/g, '')) || 0;
      const qty = parseFloat(String(bill.quantity || '').replace(/,/g, '')) || 0;
      if (!rule.shouldSwap(up, qty)) return bill;
      // Swap bill-level fields
      const fixed = { ...bill, unit_price: bill.quantity, quantity: bill.unit_price };
      // Swap list_detail-level fields if present
      if (Array.isArray(fixed.list_detail)) {
        fixed.list_detail = fixed.list_detail.map(li => {
          const liUp = parseFloat(String(li.unit_price || '').replace(/,/g, '')) || 0;
          const liQty = parseFloat(String(li.quantity || '').replace(/,/g, '')) || 0;
          if (!rule.shouldSwap(liUp, liQty)) return li;
          return { ...li, unit_price: li.quantity, quantity: li.unit_price };
        });
      }
      return fixed;
    });
  }
  // === End vendor corrections ===

  raw_json = JSON.stringify(obj);
  raw_text_pretty = JSON.stringify(obj, null, 2);
  bills_count = obj?.bills?.length || 0;
} catch (e) {
  if (!raw_text) status = "error";
}
```

---

## Verification Steps

After patching, send Caltex bill via Telegram (vendor_tax_id: `0105564172883`):

1. **Unit Price ควรเป็น:** `~21.191` (ราคาต่อลิตร)
2. **Quantity ควรเป็น:** `~47.19` (จำนวนลิตร)
3. **Address/Description/Amount fields ต้องไม่หาย** (ยืนยัน no regression)
4. ส่ง bill ที่ไม่ใช่ Caltex 1 ใบ — ต้องไม่ถูก affect

---

## Definition of Done

- [ ] `Code (Parse Result)` แสดงค่า `unit_price=21.191`, `quantity=47.19` สำหรับ Caltex bill
- [ ] Field อื่นๆ ครบ (address, description, amount ไม่หาย)
- [ ] Non-Caltex bill ไม่ถูก affect
- [ ] Verify ผ่าน `./scripts/verify_nowThai_sync.sh`
- [ ] Commit + push `agents/codex`

---

## Context / Gotchas

- `raw_json` ถูกใช้โดย `Respond to Webhook6` ผ่าน `JSON.parse($json.raw_json)` → ต้องแก้ที่ source นี้เท่านั้น
- ระวัง: โค้ดทั้งหมดอยู่ใน try block — ถ้า vendorCorrections throw error, raw_json จะ = "" (blank fields) → ต้องไม่มี runtime error
- ใช้ spread `{ ...bill }` และ `{ ...li }` เสมอ — ห้าม mutate object โดยตรง
- `list_detail` อาจไม่มีใน bill บางใบ — ต้อง check `Array.isArray(fixed.list_detail)` ก่อน

---

## Discussion

<!-- Codex: กรุณา comment ก่อน implement ถ้าเห็นปัญหากับ spec นี้ -->
