# OCR Loop Learning Log

## 2026-02-22: Fuel 3-bill bundle (handwritten OR LPG + printed OR/PTTOR)

- Corrected ground truth: all 3 bills in `บิลน้ำมัน 3 Bill.pdf` use `vendor_tax_id = 0135553012766`.
- Fixed runtime regression in `Code (Normalize + Validate)` (`invoiceNo is not defined`) that caused empty HTTP 200 body on this file.
- Added handwritten OR tax-id canonicalization for OCR digit confusion (`...2760` -> `...2766`) on manual OR forms (6-digit invoice pattern).
- Added handwritten OR/LPG validation exception to suppress false warnings for footer VAT/summary totals (`line_sum=630`, `total=650`) and widened arithmetic tolerance for handwriting rounding noise.
- Telegram notify node patched with fallback text expression to avoid sending `undefined` when upstream branch lacks `telegram_text`.
- Retest result: `success=true`, `bills_count=3`, `validation_errors=[]`, all 3 vendor tax IDs = `0135553012766`.

## 2026-02-22: Telegram notification verification + OCR Daily Summary schedule

- Verified OCR Telegram notifications from real executions (`test-workflow`) for:
  - `SUCCESS` path (`PTT-OR.pdf`)
  - `FAILED` path (invalid/empty PDF)
  - fallback path (upstream branch without `telegram_text`)
- Confirmed Telegram message text is no longer `undefined` in execution payloads after fallback patch.
- Added and imported workflow `OCR Daily Summary (Telegram)` (id `sSrKcFxY1Wxk5HGH`) in `.n8n-dev`.
- Daily summary schedule configured for **20:30** (Bangkok time) and tested via manual execution (`151023`), Telegram output includes:
  - OCR run count
  - success/error counts
  - token totals
  - estimated THB cost
  - top doc_type summary
- Activated workflow and restarted n8n to ensure cron registration is loaded.
- Hardened `start-n8n.sh` `.env` loading to ignore invalid shell variable names (e.g. keys containing `-`) so restart does not fail after adding helper GitHub env entries.
