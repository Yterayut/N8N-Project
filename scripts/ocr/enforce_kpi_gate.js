#!/usr/bin/env node

/*
Usage:
  node scripts/ocr/enforce_kpi_gate.js <metrics.json>
*/

const fs = require('fs');

const CRITICAL_FIELDS = ['vendor_tax_id', 'invoice_number', 'invoice_date_th', 'total'];

function fail(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function main() {
  const [metricsPath] = process.argv.slice(2);
  if (!metricsPath) fail('Usage: node scripts/ocr/enforce_kpi_gate.js <metrics.json>');

  let metrics;
  try {
    metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
  } catch (err) {
    fail(`Cannot read metrics file: ${err.message}`);
  }

  const criticalMin = num(process.env.KPI_CRITICAL_MIN, 0.99);
  const nonCriticalMin = num(process.env.KPI_NON_CRITICAL_MIN, 0.97);
  const criticalEmptyMax = num(process.env.KPI_CRITICAL_EMPTY_MAX, 0.01);
  const autoPassMin = num(process.env.KPI_AUTO_PASS_MIN, 0.9);

  const fieldAcc = metrics.field_accuracy || {};
  const criticalEmpty = metrics.critical_empty_rate_pred || {};
  const autoPass = num(metrics.auto_pass_like_rate, 0);

  const failures = [];
  const details = [];

  for (const field of CRITICAL_FIELDS) {
    const acc = num(fieldAcc[field]?.accuracy, 0);
    const empty = num(criticalEmpty[field], 1);
    details.push({ field, type: 'critical', accuracy: acc, empty_rate: empty });
    if (acc < criticalMin) failures.push(`critical accuracy failed: ${field}=${acc} < ${criticalMin}`);
    if (empty > criticalEmptyMax) failures.push(`critical empty-rate failed: ${field}=${empty} > ${criticalEmptyMax}`);
  }

  for (const [field, stat] of Object.entries(fieldAcc)) {
    if (CRITICAL_FIELDS.includes(field)) continue;
    const acc = num(stat.accuracy, 0);
    details.push({ field, type: 'non_critical', accuracy: acc });
    if (acc < nonCriticalMin) failures.push(`non-critical accuracy failed: ${field}=${acc} < ${nonCriticalMin}`);
  }

  if (autoPass < autoPassMin) failures.push(`auto-pass-like rate failed: ${autoPass} < ${autoPassMin}`);

  const out = {
    ok: failures.length === 0,
    thresholds: {
      critical_accuracy_min: criticalMin,
      non_critical_accuracy_min: nonCriticalMin,
      critical_empty_rate_max: criticalEmptyMax,
      auto_pass_min: autoPassMin,
    },
    observed: {
      auto_pass_like_rate: autoPass,
      details,
    },
    failures,
  };

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  if (failures.length) process.exit(2);
}

main();

