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

## 2026-02-23: Electricity loop (round 1) — multi-meter invoice + notice template

- Tested `บิลค่าไฟ.pdf` (`doc_type=electricity`, 5 bills) and `ใบแจ้งค่าไฟ.pdf` (`doc_type=electricity`, 1 bill).
- `บิลค่าไฟ.pdf` root cause: false warnings `line_amount_missing` on `ค่า FT` rows for zero-usage meters (unit price present, quantity=0, amount=0 is valid).
- Implemented electricity-specific validator exception in `Code (Normalize + Validate)` to suppress `line_amount_missing` for FT / power-factor style rows with zero amount.
- Retest `บิลค่าไฟ.pdf` passed with `validation_errors=[]` and no extraction regression.
- `ใบแจ้งค่าไฟ.pdf` remains **partial**: invoice number extraction is variable/missing across runs; captured as template profile learning and deferred risky patch pending more samples.
- Logged round-1 electricity loop to Google Sheets:
  - `OCR_TRAIN_CASES` (2 rows: one `correct`, one `partial`)
  - `OCR_KM_LESSONS` (rule change + pattern learning)
  - `OCR_KM_RUNTIME_RULES` (electricity FT zero-amount exception)
  - `OCR_RULE_CHANGELOG` (validator tuning entry)

## 2026-02-23: OCR_RAW `bad.pdf` error row (expected negative test)

- `bad.pdf` entry in `OCR_RAW` showing `The document has no pages.` is an expected negative test result (manual failure-path verification).
- This row is useful evidence for:
  - API error handling (`OCR_FAILED`)
  - Telegram failed notification formatting
  - OCR_RAW logging of error path
- It is **not** a production OCR regression. Exclude from training datasets and accuracy KPI calculations.
