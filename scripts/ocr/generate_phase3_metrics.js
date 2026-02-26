#!/usr/bin/env node

/*
Input format: JSON array
[
  {
    "document_id": "...",
    "ocr_pred_json": {...},
    "admin_final_json": {...}
  }
]

Usage:
  node scripts/ocr/generate_phase3_metrics.js data/feedback_pairs.json
*/

const fs = require('fs');

const CRITICAL_FIELDS = ['vendor_tax_id', 'invoice_number', 'invoice_date_th', 'total'];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function toArrayBills(v) {
  return Array.isArray(v?.bills) ? v.bills : [];
}

function normalize(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  return String(v).trim();
}

function safeBill(arr, i) {
  if (!Array.isArray(arr)) return {};
  return arr[i] || {};
}

function main() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) {
    process.stderr.write('Usage: node scripts/ocr/generate_phase3_metrics.js <feedback_pairs.json>\n');
    process.exit(1);
  }

  const rows = readJson(inputPath);
  if (!Array.isArray(rows)) {
    throw new Error('Input must be a JSON array');
  }

  const fieldStats = {};
  const criticalEmpty = {};
  for (const f of CRITICAL_FIELDS) criticalEmpty[f] = 0;

  let pairs = 0;
  let totalBills = 0;
  let autoPassLike = 0;

  for (const row of rows) {
    const predBills = toArrayBills(row.ocr_pred_json);
    const finBills = toArrayBills(row.admin_final_json);
    const n = Math.max(predBills.length, finBills.length);
    if (n > 0) pairs += 1;
    totalBills += n;

    let rowPerfect = true;

    for (let i = 0; i < n; i += 1) {
      const p = safeBill(predBills, i);
      const f = safeBill(finBills, i);
      const fields = Array.from(new Set([...Object.keys(p), ...Object.keys(f)]));

      for (const key of fields) {
        const pv = normalize(p[key]);
        const fv = normalize(f[key]);

        if (!fieldStats[key]) {
          fieldStats[key] = { total: 0, correct: 0, empty_pred: 0 };
        }
        fieldStats[key].total += 1;
        if (pv === fv) fieldStats[key].correct += 1;
        if (pv === '') fieldStats[key].empty_pred += 1;
        if (pv !== fv) rowPerfect = false;
      }

      for (const cf of CRITICAL_FIELDS) {
        if (normalize(p[cf]) === '') criticalEmpty[cf] += 1;
      }
    }

    if (rowPerfect && n > 0) autoPassLike += 1;
  }

  const fieldAccuracy = {};
  for (const [k, v] of Object.entries(fieldStats)) {
    fieldAccuracy[k] = {
      accuracy: v.total ? v.correct / v.total : 0,
      empty_rate_pred: v.total ? v.empty_pred / v.total : 0,
      total: v.total,
    };
  }

  const criticalEmptyRate = {};
  for (const k of CRITICAL_FIELDS) {
    criticalEmptyRate[k] = totalBills ? criticalEmpty[k] / totalBills : 0;
  }

  const output = {
    samples: rows.length,
    pairs_with_bills: pairs,
    total_bills: totalBills,
    auto_pass_like_rate: pairs ? autoPassLike / pairs : 0,
    critical_empty_rate_pred: criticalEmptyRate,
    field_accuracy: fieldAccuracy,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();

