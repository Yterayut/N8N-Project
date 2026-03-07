# Run OCR Benchmark

Trigger the OCR benchmark runner and report results with release gate status.

## Steps

1. **Trigger benchmark**
   ```python
   import urllib.request, json
   req = urllib.request.Request(
       'http://localhost:5678/webhook/ocr-benchmark',
       data=b'{}', method='POST',
       headers={'x-api-key': 'ocm-cabonrecipte!', 'Content-Type': 'application/json'}
   )
   resp = urllib.request.urlopen(req, timeout=120)
   result = json.loads(resp.read())
   print(json.dumps(result, indent=2, ensure_ascii=False))
   ```

2. **Parse results** — extract from response:
   - `overall_accuracy_pct`
   - `critical_field_accuracy` (vendor_tax_id, total, invoice_number)
   - `by_vendor` breakdown
   - `holdout_pass` + `holdout_accuracy_pct`
   - `release_gate.gate_status` (benchmark_passed / blocked)
   - `release_gate.reason`
   - `release_gate.canary_status`

3. **Report** in this format:
   ```
   === OCR Benchmark Results ===
   Run ID: bm_xxxxx
   Overall accuracy: XX.X%

   Critical fields:
   - vendor_tax_id: XX.X%
   - total: XX.X%
   - invoice_number: XX.X%

   By vendor:
   - ptt_or: XX.X% (N cases)
   - shell: XX.X%  (N cases)
   [etc]

   Holdout gate: PASS/FAIL (XX.X%)
   Release gate: benchmark_passed / blocked
   Canary status: canary / rolled_back
   ```

4. **If gate=blocked**: report reason and suggest next steps

## Usage
```
/benchmark
```
