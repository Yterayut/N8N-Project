# OCR Phase 4 Operations Runbook

Updated: 2026-02-19

## Mandatory Governance

ก่อน deploy ทุกครั้งให้ทำตามมาตรฐานนี้:
- `docs/ocr/lesson-learned-action-standard.md`

ห้ามข้าม pre-release gate เด็ดขาด
- ต้องรัน `bash scripts/ocr/pre-release-check.sh` และต้องผ่านทั้งหมดก่อน deploy

## เป้าหมาย Phase 4

1. วัดคุณภาพรายสัปดาห์แบบ field-level
2. ตรวจ drift (vendor/layout ใหม่)
3. ปรับ prompt/rules อย่างต่อเนื่องจากข้อมูล correction จริง

## Prerequisites

1. ตั้ง env ให้เรียบร้อย
- `OCR_FEEDBACK_API_URL`
- `OCR_FEEDBACK_API_KEY` (หรือ fallback `OCR_SHARED_API_KEY`)

2. ต้องมีข้อมูลใน `OCR_CORRECTIONS`
- คอลัมน์ `pred_json` และ `final_json` ต้องเป็น JSON ที่ parse ได้

## Weekly Metrics Job

รัน:

```bash
export OCR_FEEDBACK_API_URL="https://YOUR_APPS_SCRIPT_OR_API_URL"
export OCR_FEEDBACK_API_KEY="YOUR_API_KEY"
node scripts/ocr/run_phase4_weekly_metrics.js
```

หรือใช้ wrapper:

```bash
bash scripts/ocr/run_phase4_weekly_metrics.sh
```

## Pre-Release Gate (ทุกครั้งก่อน Deploy)

รัน:

```bash
bash scripts/ocr/pre-release-check.sh
```

สิ่งที่สคริปต์เช็ก:
1. ตรวจ workflow code-node safety (`verify_code_nodes_newlines.js`)
2. ตรวจว่า execution ล่าสุดของ workflow active ไม่เป็น `error`
3. เช็ก env สำคัญ (`OCR_FEEDBACK_API_URL` และ key)

ถ้าต้องการรวม smoke test จริงเพิ่ม ให้กำหนด:
- `OCR_DEV_WEBHOOK_URL`
- `OCR_SHARED_API_KEY`
- `OCR_TEST_FILE`

## Full Weekly Pipeline

```bash
bash scripts/ocr/run_phase4_full.sh
```

Steps in pipeline:
1. Generate weekly metrics
2. Enforce KPI gate
3. Build gold dataset artifacts
4. Refresh review queue snapshot
5. Refresh dashboard snapshot

ผลลัพธ์:
- สร้างโฟลเดอร์ `tmp/phase4-metrics-<timestamp>/`
- ไฟล์ `feedback_pairs.json`
- ไฟล์ `metrics.json`

## KPI Gate (ใช้ตัดสินใจก่อนปล่อย)

1. Critical fields:
- `vendor_tax_id`
- `invoice_number`
- `invoice_date_th`
- `total`

Target:
- critical accuracy >= 99%
- non-critical accuracy >= 97%
- critical empty-rate < 1%

## Weekly Review Checklist

1. ดู `metrics.json`
2. หา top 5 field ที่ accuracy ต่ำสุด
3. แยกตาม `doc_type` ที่พลาดมากสุด
4. ตรวจ diff ตัวอย่างจริงจาก `OCR_CORRECTIONS`
5. อัปเดต prompt/rules
6. ทดสอบ regression 3-5 บิลต่อ doc_type

## Suggested Cadence

1. Daily
- ตรวจ error rate ของ `/webhook/ocr-dev`
- ตรวจ queue งาน review ที่ค้าง

2. Weekly
- รัน metrics script
- สรุป quality report
- patch prompt/rules รอบสั้น

3. Monthly
- ทำ baseline snapshot ใหม่
- review schema/validation rules

## Cron Example (Weekly)

```bash
crontab -e
```

```cron
0 2 * * 1 cd /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE && \
OCR_FEEDBACK_API_URL="https://YOUR_APPS_SCRIPT_OR_API_URL" \
OCR_FEEDBACK_API_KEY="YOUR_API_KEY" \
bash scripts/ocr/run_phase4_weekly_metrics.sh >> logs/phase4-metrics.log 2>&1
```
