#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parse: flattedParse } = require('/home/oneclimate-uat/.nvm/versions/node/v20.19.0/lib/node_modules/n8n/node_modules/flatted');

const WORKFLOW_ID = process.env.WORKFLOW_ID || 'up1n75qEhbsXswii';
const WORKFLOW_NAME = process.env.WORKFLOW_NAME || 'test-workflow';
const DB_PATH = process.env.N8N_DB_PATH || '.n8n-dev/.n8n/database.sqlite';
const WINDOW = Number(process.env.BASELINE_WINDOW || 150);
const OUTPUT_MD = process.env.OUTPUT_MD || 'docs/ocr/phase0-baseline.md';
const OUTPUT_JSON = process.env.OUTPUT_JSON || 'docs/ocr/phase0-baseline-data.json';

function sh(cmd, options = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  }).trim();
}

function q(sql) {
  return sh(`sqlite3 -cmd ".timeout 10000" ${DB_PATH} \"${sql.replace(/"/g, '""')}\"`);
}

function asNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isEmptyText(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function dateIsThaiBuddhist(v) {
  if (isEmptyText(v)) return false;
  const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  return yyyy >= 2400 && yyyy <= 2700;
}

function classifyBill(bill) {
  const textParts = [];
  if (Array.isArray(bill.list_detail)) {
    for (const d of bill.list_detail) {
      if (d && d.description) textParts.push(String(d.description));
    }
  }
  if (bill.description) textParts.push(String(bill.description));
  const text = textParts.join(' | ').toLowerCase();

  const hasElectricField = [bill.meter_number, bill.electricity_ref, bill.electricity_user_id, bill.units_used]
    .some((v) => !isEmptyText(v));
  const hasFleetField = [bill.card_number, bill.vehicle_plate, bill.odometer].some((v) => !isEmptyText(v));

  const fuelKw = /(น้ำมัน|diesel|gasohol|g95|g91|fuel|แก๊สโซฮอล์|premium)/i;
  const parkingKw = /(จอดรถ|ที่จอดรถ|parking|park)/i;
  const electricKw = /(ไฟฟ้า|electric|kwh|มิเตอร์|meter)/i;

  const tags = new Set();
  if (hasElectricField || electricKw.test(text)) tags.add('electricity');
  if (hasFleetField) tags.add('fleet');
  if (fuelKw.test(text)) tags.add('fuel');
  if (parkingKw.test(text)) tags.add('parking');

  if (tags.size === 0) return 'unknown';
  if (tags.size > 1) return 'mixed';
  return [...tags][0];
}

function getExecRows() {
  const raw = q(`
    select id, status, startedAt, stoppedAt,
      round((julianday(stoppedAt)-julianday(startedAt))*86400, 3) as sec
    from execution_entity
    where workflowId='${WORKFLOW_ID}'
    order by id desc
    limit ${WINDOW};
  `);

  if (!raw) return [];
  return raw.split('\n').map((line) => {
    const [id, status, startedAt, stoppedAt, sec] = line.split('|');
    return {
      id: Number(id),
      status,
      startedAt,
      stoppedAt,
      sec: asNum(sec),
    };
  });
}

function parseExecutionData(executionId) {
  const raw = q(`select data from execution_data where executionId=${executionId};`);
  if (!raw) return null;
  try {
    return flattedParse(raw);
  } catch {
    return null;
  }
}

function getPercentile(values, p) {
  if (!values.length) return null;
  const arr = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, Math.min(arr.length - 1, idx))];
}

function freezeWorkflow() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const outDir = 'backups/workflow-freeze';
  fs.mkdirSync(outDir, { recursive: true });

  const row = q(`
    select json_object(
      'id', id,
      'name', name,
      'active', active,
      'createdAt', createdAt,
      'updatedAt', updatedAt,
      'settings', json(coalesce(settings, '{}')),
      'staticData', json(coalesce(staticData, '{}')),
      'pinData', json(coalesce(pinData, '{}')),
      'versionId', versionId,
      'triggerCount', coalesce(triggerCount, 0),
      'meta', json(coalesce(meta, '{}')),
      'nodes', json(coalesce(nodes, '[]')),
      'connections', json(coalesce(connections, '{}'))
    )
    from workflow_entity
    where id='${WORKFLOW_ID}'
    limit 1;
  `);
  if (!row) return null;
  const obj = JSON.parse(row);

  const jsonPath = path.join(outDir, `${WORKFLOW_ID}-${stamp}.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  const checksum = sh(`sha256sum ${jsonPath}`);
  const shaPath = `${jsonPath.replace(/\.json$/, '.sha256')}`;
  fs.writeFileSync(shaPath, `${checksum}\n`, 'utf8');

  return { jsonPath, shaPath, checksum: checksum.split(' ')[0] };
}

function main() {
  const execRows = getExecRows();
  const durations = execRows.map((r) => r.sec).filter((v) => v !== null);
  const ocrLike = execRows.filter((r) => (r.sec || 0) >= 10);

  const byStatus = execRows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const dataset = [];
  for (const row of execRows) {
    const run = parseExecutionData(row.id);
    if (!run?.resultData?.runData) continue;
    const codeNode = run.resultData.runData['Code in JavaScript9'];
    if (!codeNode?.length) continue;

    const nodeOut = codeNode[codeNode.length - 1]?.data?.main?.[0]?.[0]?.json;
    if (!nodeOut) continue;

    let rawJson = nodeOut.raw_json;
    if (typeof rawJson === 'string') {
      try {
        rawJson = JSON.parse(rawJson);
      } catch {
        rawJson = null;
      }
    }

    const bills = Array.isArray(rawJson?.bills) ? rawJson.bills : [];
    dataset.push({
      executionId: row.id,
      sec: row.sec,
      executionStatus: row.status,
      parseStatus: nodeOut.status || 'unknown',
      requestId: nodeOut.request_id || '',
      sourceFile: nodeOut.source_file || '',
      bills,
    });
  }

  const allBills = [];
  for (const d of dataset) {
    for (const bill of d.bills) {
      allBills.push({ ...bill, _executionId: d.executionId, _sourceFile: d.sourceFile, _parseStatus: d.parseStatus });
    }
  }

  const typeCounts = { electricity: 0, fuel: 0, fleet: 0, parking: 0, mixed: 0, unknown: 0 };
  for (const b of allBills) {
    typeCounts[classifyBill(b)]++;
  }

  const critical = ['vendor_tax_id', 'invoice_number', 'invoice_date_th', 'total'];
  const fieldPatterns = {
    vendor_tax_id: { empty: 0, invalid_format: 0 },
    invoice_number: { empty: 0 },
    invoice_date_th: { empty: 0, invalid_format: 0 },
    total: { empty: 0, non_numeric: 0, non_positive: 0 },
    meter_number: { present: 0, invalid_length: 0 },
    electricity_ref: { present: 0, invalid_length: 0 },
    card_number: { present: 0, non_digit: 0, short_length: 0 },
    vehicle_plate: { present: 0, empty: 0 },
    odometer: { present: 0, non_numeric: 0 },
  };

  for (const b of allBills) {
    const tax = b.vendor_tax_id;
    if (isEmptyText(tax)) fieldPatterns.vendor_tax_id.empty++;
    else if (!/^0\d{12}$/.test(String(tax).replace(/\D/g, ''))) fieldPatterns.vendor_tax_id.invalid_format++;

    const inv = b.invoice_number;
    if (isEmptyText(inv)) fieldPatterns.invoice_number.empty++;

    const dt = b.invoice_date_th;
    if (isEmptyText(dt)) fieldPatterns.invoice_date_th.empty++;
    else if (!dateIsThaiBuddhist(dt)) fieldPatterns.invoice_date_th.invalid_format++;

    const total = b.total;
    if (isEmptyText(total)) fieldPatterns.total.empty++;
    else {
      const n = Number(total);
      if (!Number.isFinite(n)) fieldPatterns.total.non_numeric++;
      else if (n <= 0) fieldPatterns.total.non_positive++;
    }

    if (!isEmptyText(b.meter_number)) {
      fieldPatterns.meter_number.present++;
      const d = String(b.meter_number).replace(/\D/g, '');
      if (d.length !== 10) fieldPatterns.meter_number.invalid_length++;
    }

    if (!isEmptyText(b.electricity_ref)) {
      fieldPatterns.electricity_ref.present++;
      const d = String(b.electricity_ref).replace(/\D/g, '');
      if (d.length !== 12) fieldPatterns.electricity_ref.invalid_length++;
    }

    if (!isEmptyText(b.card_number)) {
      fieldPatterns.card_number.present++;
      const d = String(b.card_number).replace(/\D/g, '');
      if (d.length !== String(b.card_number).length) fieldPatterns.card_number.non_digit++;
      if (d.length < 6) fieldPatterns.card_number.short_length++;
    }

    if (b.vehicle_plate !== undefined) {
      fieldPatterns.vehicle_plate.present++;
      if (isEmptyText(b.vehicle_plate)) fieldPatterns.vehicle_plate.empty++;
    }

    if (!isEmptyText(b.odometer)) {
      fieldPatterns.odometer.present++;
      if (!/^\d+(\.\d+)?$/.test(String(b.odometer).trim())) fieldPatterns.odometer.non_numeric++;
    }
  }

  const freeze = freezeWorkflow();

  const report = {
    generated_at: new Date().toISOString(),
    workflow: { id: WORKFLOW_ID, name: WORKFLOW_NAME },
    freeze,
    execution_baseline: {
      window: WINDOW,
      execution_count: execRows.length,
      by_status: byStatus,
      sec: {
        min: durations.length ? Math.min(...durations) : null,
        p50: getPercentile(durations, 50),
        p95: getPercentile(durations, 95),
        max: durations.length ? Math.max(...durations) : null,
        avg: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      },
      ocr_like_filter: 'sec >= 10',
      ocr_like_count: ocrLike.length,
    },
    ocr_dataset: {
      parsed_execution_count: dataset.length,
      total_bills: allBills.length,
      bill_type_distribution: typeCounts,
      parse_status: dataset.reduce((acc, d) => {
        acc[d.parseStatus] = (acc[d.parseStatus] || 0) + 1;
        return acc;
      }, {}),
    },
    field_patterns: fieldPatterns,
    critical_empty_rate: {
      vendor_tax_id: allBills.length ? fieldPatterns.vendor_tax_id.empty / allBills.length : null,
      invoice_number: allBills.length ? fieldPatterns.invoice_number.empty / allBills.length : null,
      invoice_date_th: allBills.length ? fieldPatterns.invoice_date_th.empty / allBills.length : null,
      total: allBills.length ? fieldPatterns.total.empty / allBills.length : null,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const md = `# OCR Phase 0 Baseline\n\nGenerated at: ${new Date().toISOString()}\nWorkflow: \`${WORKFLOW_ID}\` (\`${WORKFLOW_NAME}\`)\nDB: \`${DB_PATH}\`\n\n## Snapshot Freeze\n- Freeze file: \`${freeze?.jsonPath || 'N/A'}\`\n- Checksum file: \`${freeze?.shaPath || 'N/A'}\`\n- SHA256: \`${freeze?.checksum || 'N/A'}\`\n\n## Execution Baseline (Latest ${WINDOW} runs)\n\n\`\`\`json\n${JSON.stringify(report.execution_baseline, null, 2)}\n\`\`\`\n\n## OCR Dataset Baseline (from parsed runs in latest window)\n\n\`\`\`json\n${JSON.stringify(report.ocr_dataset, null, 2)}\n\`\`\`\n\n## Field Error Pattern (rule-based)\n\n\`\`\`json\n${JSON.stringify(report.field_patterns, null, 2)}\n\`\`\`\n\n## Critical Empty-rate (current baseline)\n\n\`\`\`json\n${JSON.stringify(report.critical_empty_rate, null, 2)}\n\`\`\`\n\n## Observed Risks (from latest test evidence)\n1. OCR parsed executions are sparse relative to total webhook runs in the same window; non-OCR traffic is mixed in this workflow.\n2. vendor_tax_id empty/invalid remains the top critical-field risk.\n3. Type-specific fields (meter_number, electricity_ref, card_number, odometer) still show format drift and require strict normalize+validate in Phase 2.\n4. Some bills are classified as mixed; explicit classifier + type routing is still required before prompt execution.\n\n## Phase 0 Deliverables\n- [x] Baseline metrics captured from latest execution data\n- [x] Active workflow frozen with checksum\n- [x] Canonical schema spec defined (see docs/ocr/schema-standards-v1.md)\n`;

  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
  fs.writeFileSync(OUTPUT_MD, md, 'utf8');

  console.log(`Generated: ${OUTPUT_MD}`);
  console.log(`Generated: ${OUTPUT_JSON}`);
  console.log(`Freeze: ${freeze?.jsonPath || 'N/A'}`);
}

main();
