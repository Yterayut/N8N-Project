#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = process.env.N8N_DB_PATH || '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = process.env.WORKFLOW_ID || 'up1n75qEhbsXswii';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function q(sql) {
  return sh(`sqlite3 -json ${DB_PATH} "${sql.replace(/"/g, '""')}"`);
}

function backup(workflow) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const dir = 'backups/workflow-freeze';
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${WORKFLOW_ID}-schema-canonical-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
  return file;
}

function main() {
  const row = JSON.parse(q(`select id,name,nodes,connections,activeVersionId from workflow_entity where id='${WORKFLOW_ID}' limit 1;`))[0];
  if (!row) throw new Error(`workflow not found: ${WORKFLOW_ID}`);

  const workflow = {
    id: row.id,
    name: row.name,
    nodes: JSON.parse(row.nodes),
    connections: JSON.parse(row.connections || '{}'),
    activeVersionId: row.activeVersionId || null,
  };
  const backupFile = backup(workflow);

  const node = workflow.nodes.find((n) => n.name === 'Code (Normalize + Validate)');
  if (!node) throw new Error('Node not found: Code (Normalize + Validate)');

  node.parameters.jsCode = [
    "function toNum(v){ if(v===null||v===undefined||v==='') return 0; const n=Number(String(v).replace(/,/g,'').trim()); return Number.isFinite(n)?n:0; }",
    "function toStr(v){ return v===null||v===undefined ? '' : String(v); }",
    "function pick(obj, keys, defVal){",
    "  for (const k of keys) {",
    "    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];",
    "  }",
    "  return defVal;",
    "}",
    "function normalizeListDetail(rawBill){",
    "  const arr = Array.isArray(rawBill.list_detail) ? rawBill.list_detail : (Array.isArray(rawBill.items) ? rawBill.items : []);",
    "  const out = [];",
    "  for (const d of arr) {",
    "    const row = d || {};",
    "    out.push({",
    "      description: toStr(pick(row, ['description','item_name','name'], '')),",
    "      unit_price: toNum(pick(row, ['unit_price','price_per_unit','price'], 0)),",
    "      quantity: toNum(pick(row, ['quantity','qty','amount_qty'], 0)),",
    "      amount: toNum(pick(row, ['amount','total','line_total'], 0))",
    "    });",
    "  }",
    "  if (!out.length) out.push({ description:'', unit_price:0, quantity:0, amount:0 });",
    "  return out;",
    "}",
    "function normalizeBill(rawBill, docType){",
    "  const b = rawBill || {};",
    "  const normalized = {",
    "    vendor_tax_id: toStr(pick(b, ['vendor_tax_id','vendor_taxid','tax_id'], '')),",
    "    invoice_number: toStr(pick(b, ['invoice_number','invoice_no','receipt_no'], '')),",
    "    invoice_date_th: toStr(pick(b, ['invoice_date_th','invoice_date','date'], '')),",
    "    customer_name: toStr(pick(b, ['customer_name','customer','buyer_name'], '')),",
    "    address: toStr(pick(b, ['address','customer_address'], '')),",
    "    currency: toStr(pick(b, ['currency'], 'THB')) || 'THB',",
    "    total: toNum(pick(b, ['total','total_amount','grand_total'], 0)),",
    "    list_detail: normalizeListDetail(b)",
    "  };",
    "  if (docType === 'electricity') {",
    "    normalized.meter_number = toStr(pick(b, ['meter_number'], ''));",
    "    normalized.electricity_user_id = toStr(pick(b, ['electricity_user_id'], ''));",
    "    normalized.units_used = toNum(pick(b, ['units_used'], 0));",
    "    normalized.electricity_ref = toStr(pick(b, ['electricity_ref'], ''));",
    "  }",
    "  if (docType === 'fleet_card') {",
    "    normalized.card_number = toStr(pick(b, ['card_number'], ''));",
    "    normalized.vehicle_plate = toStr(pick(b, ['vehicle_plate'], ''));",
    "    normalized.odometer = toStr(pick(b, ['odometer'], ''));",
    "  }",
    "  return normalized;",
    "}",
    "function validateBill(bill, docType){",
    "  const errs=[];",
    "  const date=String(bill.invoice_date_th||'');",
    "  const tax=String(bill.vendor_tax_id||'');",
    "  const inv=String(bill.invoice_number||'');",
    "  const total=toNum(bill.total);",
    "  if(!date || !/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(date)) errs.push({field:'invoice_date_th',severity:'critical',code:'invalid_date_format'});",
    "  if(!inv) errs.push({field:'invoice_number',severity:'critical',code:'missing_invoice_number'});",
    "  if(!(total>=0)) errs.push({field:'total',severity:'critical',code:'invalid_total'});",
    "  if(tax && !/^0\\d{12}$/.test(tax.replace(/\\D/g,''))) errs.push({field:'vendor_tax_id',severity:'critical',code:'invalid_vendor_tax_id'});",
    "  if(docType==='electricity'){",
    "    const meter=String(bill.meter_number||''); const ref=String(bill.electricity_ref||'');",
    "    if(meter && !/^\\d{10}$/.test(meter)) errs.push({field:'meter_number',severity:'critical',code:'invalid_meter_number'});",
    "    if(ref && !/^\\d{12}$/.test(ref)) errs.push({field:'electricity_ref',severity:'critical',code:'invalid_electricity_ref'});",
    "    if(inv && !/^AB/i.test(inv)) errs.push({field:'invoice_number',severity:'critical',code:'electricity_invoice_should_start_ab'});",
    "  }",
    "  if(docType==='fleet_card'){",
    "    const odo=String(bill.odometer||'');",
    "    if(odo && !/^\\d{3,9}$/.test(odo)) errs.push({field:'odometer',severity:'critical',code:'invalid_odometer'});",
    "  }",
    "  return errs;",
    "}",
    "",
    "const x={...$json};",
    "const docType=String(x.doc_type||'unknown');",
    "let data={bills:[]};",
    "try{ if(x.raw_json) data=JSON.parse(x.raw_json); } catch(e){ data={bills:[]}; }",
    "",
    "const sourceBills=Array.isArray(data.bills)?data.bills:[];",
    "const canonicalBills = sourceBills.map((b)=>normalizeBill(b, docType));",
    "const canonical = { bills: canonicalBills };",
    "",
    "let errs=[];",
    "for(const b of canonicalBills) errs.push(...validateBill(b,docType));",
    "const critical=errs.filter(e=>e.severity==='critical').length;",
    "",
    "x.raw_json = JSON.stringify(canonical);",
    "x.raw_text_pretty = JSON.stringify(canonical, null, 2);",
    "x.bills_count = canonicalBills.length;",
    "x.validation_errors=errs;",
    "x.critical_error_count=critical;",
    "x.schema_canonicalized=true;",
    "x.needs_reask=(critical>0 && canonicalBills.length>0);",
    "x.confidence=Math.max(0,Math.min(1,Number(x.doc_type_confidence||0.75) - (critical*0.12)));",
    "x.used_reask=false;",
    "",
    "return [{json:x}];",
  ].join('\n');

  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.schema.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.schema.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(workflow.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(workflow.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.schema.update.sql`);
  const sql = [
    '.timeout 10000',
    `update workflow_entity set nodes=cast(readfile('${nodesPath}') as text), connections=cast(readfile('${conPath}') as text), updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where id='${WORKFLOW_ID}';`,
    workflow.activeVersionId
      ? `update workflow_history set nodes=cast(readfile('${nodesPath}') as text), connections=cast(readfile('${conPath}') as text), updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where versionId='${workflow.activeVersionId}';`
      : 'select 1;',
    'select changes();'
  ].join('\n');
  fs.writeFileSync(sqlPath, `${sql}\n`, 'utf8');
  const changed = Number(sh(`sqlite3 ${DB_PATH} < ${sqlPath}`) || 0);

  process.stdout.write(`${JSON.stringify({ ok: true, backup: backupFile, db_changes: changed }, null, 2)}\n`);
}

main();

