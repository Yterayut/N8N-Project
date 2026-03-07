# OCR Smoke Test

Run full OCR smoke test suite via the ocr-validator subagent.

## Tests to Run

1. **Endpoint health** — `/webhook/ocr-dev` auth checks (401 / 422 / 200)
2. **nowThai sync** — `./scripts/verify_nowThai_sync.sh`
3. **OCR_EXAMPLES active** — all 30 rows have `active_for_prompt=True`
4. **Runtime rules** — at least 1 active rule in `OCR_KM_RUNTIME_RULES`
5. **Recent execution errors** — check last 24h on main OCR workflow

## Steps

Delegate to `ocr-validator` subagent with this request:

> Run the standard validation suite for the OCR system. Check:
> 1. Auth/endpoint smoke test via `bash ./scripts/tests/ocr_smoke_test.sh`
> 2. nowThai sync
> 3. OCR_EXAMPLES active_for_prompt count (expect 30/30)
> 4. Runtime rules active count
> 5. Last 24h execution errors on workflow `up1n75qEhbsXswii`
>
> Return summary table and overall PASS/FAIL.

## After Test
- Report PASS/FAIL with table
- If any FAIL: identify root cause and suggest fix
- Do NOT auto-fix — report only

## Usage
```
/smoke-test
```
