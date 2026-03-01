I have analyzed the current OCR prompt and the provided error data. Based on the 37 rows of `wrong_value` errors, here is the engineering report and proposed optimizations.

# OCR Prompt Engineering Report

## Top 3 Error Patterns

1.  **Field: `total` (Grand Total vs. Sub-total)**
    *   **Error Count:** 12+ occurrences (Rows 2, 3, 15, 16, 55, 64, 73, 82, 88, 94, 100, 232).
    *   **Root Cause:** The model is frequently capturing sub-totals (before VAT) or line-item amounts instead of the final grand total. In cases like `tc_1772100477056_x2z6zy`, it consistently picked `650` when the correct total was `1600`.
    *   **Example:** OCR: 1200 | Correct: 1350 (Fuel bill).

2.  **Field: `invoice_number` (Partial/Wrong ID Capture)**
    *   **Error Count:** 13 occurrences (Rows 6, 21, 58, 67, 76, 117, 234-242).
    *   **Root Cause:** For non-fuel bills ("other"), the model lacks specific guidance on where to find the invoice number. It often picks up internal sequence numbers or omits alphanumeric prefixes (e.g., getting `304751` instead of `TIO000016809001207`).
    *   **Example:** OCR: 100628 | Correct: "INV-001".

3.  **Field: `vendor_tax_id` (Last-Digit Inaccuracy)**
    *   **Error Count:** 5 occurrences (Rows 4, 56, 65, 74).
    *   **Root Cause:** Despite the "read twice" instruction, the model is hallucinating the final digit or failing when the ID is not explicitly labeled "Tax ID" but is just a 13-digit string.
    *   **Example:** OCR: ...12760 | Correct: ...12766.

## Proposed Prompt Improvements

### Improvement 1: Anchor the Grand Total
*   **Before:** `total ดูจาก "รวมเป็นเงิน" เท่านั้น` (fuel)
*   **After:** `total คือยอดเงินสุทธิสุดท้ายที่ต้องชำระ (Grand Total) มักอยู่ท้ายสุดของบิล หลังรวมภาษีมูลค่าเพิ่มแล้ว หากมีหลายยอด ให้เลือกยอดที่ระบุว่า "ยอดเงินสุทธิ", "จำนวนเงินทั้งสิ้น", หรือ "Grand Total" เท่านั้น ห้ามใช้ยอด Sub-total หรือยอดก่อนภาษี`
*   **Expected impact:** Fixes the 1200/1350 and 650/1600 discrepancy errors.

### Improvement 2: Invoice Number Context (Base Rule)
*   **Before:** (No specific guidance in `base` prompt)
*   **After:** `invoice_number: ให้ค้นหาคำว่า "เลขที่", "No.", "Invoice No.", "เลขที่ใบกำกับ" ห้ามนำเลขลำดับรายการหรือเลขคิวมาใส่ หากมีตัวอักษรภาษาอังกฤษนำหน้า (Prefix) ให้ใส่มาให้ครบทุกตัว`
*   **Expected impact:** Ensures full alphanumeric strings are captured and reduces confusion with internal tracking IDs.

### Improvement 3: Vendor Tax ID Logic
*   **Before:** `vendor_tax_id ให้อ่านซ้ำ 2 รอบเพื่อตรวจสอบความถูกต้อง`
*   **After:** `vendor_tax_id: ต้องเป็นเลข 13 หลัก ตรวจสอบ 2 หลักสุดท้ายให้แม่นยำ อ่านจากหัวบิลเป็นหลัก หากในบิลมีเลข 13 หลักหลายที่ (เช่น มีของทั้งผู้ซื้อและผู้ขาย) ให้เลือกเลขที่อยู่ใกล้ชื่อบริษัทผู้ขาย (Vendor) มากที่สุด`
*   **Expected impact:** Reduces digit errors at the end of the string and prevents swapping customer/vendor IDs.

## A/B Test Recommendation
*   **Test Set:** 40 invoices (15 Fuel, 15 Other/General, 10 Fleet).
*   **Metrics:** Accuracy of `total` and `invoice_number`.
*   **Success Criteria:** Zero "High Severity" errors in `total` field across the test set.

## Risk Assessment
*   **Level:** Medium.
*   **Reasoning:** Adding more descriptive text can occasionally cause the model to ignore shorter, more direct instructions. 
*   **Rollback Plan:** If total accuracy drops below 85% in testing, revert to the "Current" prompt and instead implement a regex-based validation layer for the JSON output.

## CC Decision Required
*   [ ] **Approve** → Update prompt in PROMPTS Google Sheet.
*   [ ] **Reject** → Continue using current prompt.
*   [x] **Test Further** → Apply these changes to a development branch and run against the 37 failed cases specifically.


---

## Approval Status *(CC fills)*
- [ ] Approved → implemented in T0xx
- [ ] Rejected → reason:
- [ ] Pending review

*Generated: 2026-03-01 by GG (python wrapper)*
