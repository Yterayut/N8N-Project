# OCR Plan 100% Completion Checklist

Updated: 2026-02-19
Workflow: `test-workflow` (`up1n75qEhbsXswii`)

## Phase Status

1. Phase 0: Completed
2. Phase 1: Completed
3. Phase 2: Completed
4. Phase 3: Completed
5. Phase 4: Completed (automation scripts + runbook + KPI gate + snapshots)

## What "100%" Means in This Implementation

1. Functional
- `ocr-dev` and `ocr-feedback` production endpoints live
- 1 request -> 1 response enforced on OCR path
- feedback path has auth + validation + explicit error codes

2. Quality loop
- prediction logging (`OCR_PREDICTIONS`)
- correction logging (`OCR_CORRECTIONS`)
- example library (`OCR_EXAMPLES`)
- few-shot retrieval integrated into OCR prompt build

3. Dedupe race control
- atomic key reservation via `reserve_key` (Apps Script LockService)
- OCR insert path gated by atomic reserve branch

4. Operability
- weekly metrics job
- KPI gate script
- review queue snapshot builder
- dashboard snapshot builder
- gold dataset generator + readiness signal

## Required Sheets in Feedback Store

The feedback CRUD backend must provide these sheets:

1. `OCR_PREDICTIONS`
2. `OCR_CORRECTIONS`
3. `OCR_EXAMPLES`
4. `OCR_REVIEW_QUEUE`
5. `OCR_DASHBOARD`
6. `OCR_DEDUPE`

Validate with:

```bash
export OCR_FEEDBACK_API_URL="https://YOUR_FEEDBACK_API_URL"
export OCR_FEEDBACK_API_KEY="YOUR_API_KEY"
node scripts/ocr/validate_feedback_store.js
```

## Weekly Operation Commands

1. Full weekly pipeline (metrics + KPI gate + gold + queue + dashboard):

```bash
bash scripts/ocr/run_phase4_full.sh
```

2. Manual pieces:

```bash
node scripts/ocr/run_phase4_weekly_metrics.js
node scripts/ocr/enforce_kpi_gate.js <metrics.json>
node scripts/ocr/generate_gold_dataset.js
node scripts/ocr/build_review_queue_snapshot.js
node scripts/ocr/build_dashboard_snapshot.js
```

## Remaining Manual Work (non-code)

1. Populate at least 200-500 corrected documents in `OCR_CORRECTIONS` to satisfy dataset-size KPI.
2. Ensure Apps Script deployment is updated with latest `Code.js` and API key control.
3. Keep weekly review cadence active (ops process).

