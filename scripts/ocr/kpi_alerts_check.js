#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'tmp';
const dirs = fs.readdirSync(base, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('phase4-metrics-'))
  .map((d) => d.name)
  .sort()
  .reverse();

if (!dirs.length) {
  console.log(JSON.stringify({ ok: false, error: 'no metrics dirs found' }, null, 2));
  process.exit(1);
}

const metricsPath = path.join(base, dirs[0], 'metrics.json');
const m = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
const t = {
  criticalMin: Number(process.env.KPI_CRITICAL_MIN || 0.99),
  nonCriticalMin: Number(process.env.KPI_NON_CRITICAL_MIN || 0.97),
  autoPassMin: Number(process.env.KPI_AUTO_PASS_MIN || 0.9),
};

const failures = [];
const detail = m.field_metrics || [];
for (const d of detail) {
  if (d.type === 'critical' && Number(d.accuracy || 0) < t.criticalMin) failures.push(`critical ${d.field} accuracy ${d.accuracy}`);
  if (d.type !== 'critical' && Number(d.accuracy || 0) < t.nonCriticalMin) failures.push(`non-critical ${d.field} accuracy ${d.accuracy}`);
}
if (Number(m.auto_pass_like_rate || 0) < t.autoPassMin) failures.push(`auto_pass_like_rate ${m.auto_pass_like_rate}`);

const status = failures.length ? 'ALERT' : 'OK';
const result = {
  ok: !failures.length,
  status,
  metrics_path: metricsPath,
  thresholds: t,
  failures,
  generated_at_iso: new Date().toISOString(),
};

const outPath = path.join(base, dirs[0], 'alerts.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, out_path: outPath }, null, 2));
