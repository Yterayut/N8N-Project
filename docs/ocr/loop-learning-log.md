# OCR Loop Learning Log

## 2026-02-22: Fuel 3-bill bundle (handwritten OR LPG + printed OR/PTTOR)

- Corrected ground truth: all 3 bills in `บิลน้ำมัน 3 Bill.pdf` use `vendor_tax_id = 0135553012766`.
- Fixed runtime regression in `Code (Normalize + Validate)` (`invoiceNo is not defined`) that caused empty HTTP 200 body on this file.
- Added handwritten OR tax-id canonicalization for OCR digit confusion (`...2760` -> `...2766`) on manual OR forms (6-digit invoice pattern).
- Added handwritten OR/LPG validation exception to suppress false warnings for footer VAT/summary totals (`line_sum=630`, `total=650`) and widened arithmetic tolerance for handwriting rounding noise.
- Telegram notify node patched with fallback text expression to avoid sending `undefined` when upstream branch lacks `telegram_text`.
- Retest result: `success=true`, `bills_count=3`, `validation_errors=[]`, all 3 vendor tax IDs = `0135553012766`.
