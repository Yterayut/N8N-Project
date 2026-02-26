#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DB_PATH = process.env.N8N_DB_PATH || '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = process.env.WORKFLOW_ID || 'up1n75qEhbsXswii';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function q(sql) {
  return sh(`sqlite3 -json ${DB_PATH} "${sql.replace(/"/g, '""')}"`);
}

function newId() {
  return crypto.randomUUID();
}

function getWorkflow() {
  const raw = q(`
    select id,name,nodes,connections,activeVersionId
    from workflow_entity
    where id='${WORKFLOW_ID}'
    limit 1;
  `);
  const rows = JSON.parse(raw || '[]');
  if (!rows.length) throw new Error(`Workflow not found: ${WORKFLOW_ID}`);
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    nodes: JSON.parse(row.nodes || '[]'),
    connections: JSON.parse(row.connections || '{}'),
    activeVersionId: row.activeVersionId || null,
  };
}

function backupWorkflow(obj) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const dir = 'backups/workflow-freeze';
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${WORKFLOW_ID}-phase3_1-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
  return file;
}

function findNode(nodes, name) {
  return nodes.find((n) => n.name === name);
}

function ensureNode(nodes, node) {
  const existing = findNode(nodes, node.name);
  if (existing) return existing;
  nodes.push(node);
  return node;
}

function setMainConn(connections, from, branches) {
  if (!connections[from]) connections[from] = {};
  connections[from].main = branches;
}

function ensureMainConn(connections, from, branchIdx, to) {
  if (!connections[from]) connections[from] = {};
  if (!connections[from].main) connections[from].main = [];
  while (connections[from].main.length <= branchIdx) connections[from].main.push([]);
  const arr = connections[from].main[branchIdx];
  if (!arr.find((x) => x.node === to && x.type === 'main' && x.index === 0)) {
    arr.push({ node: to, type: 'main', index: 0 });
  }
}

function patchSecurity(nodes, connections) {
  const validate = findNode(nodes, 'Code (Validate Feedback Payload)');
  if (!validate) throw new Error('Missing node: Code (Validate Feedback Payload)');

  validate.parameters.jsCode = [
    "const payload = ($json && typeof $json.body === 'object' && $json.body !== null) ? $json.body : ($json || {});",
    "const headers = ($json && typeof $json.headers === 'object' && $json.headers !== null) ? $json.headers : {};",
    "",
    "function asObj(v){",
    "  if (v && typeof v === 'object') return v;",
    "  if (typeof v === 'string' && v.trim()) {",
    "    try { return JSON.parse(v); } catch (_) { return null; }",
    "  }",
    "  return null;",
    "}",
    "",
    "function isNumeric(v){",
    "  if (typeof v === 'number') return Number.isFinite(v);",
    "  if (typeof v === 'string' && v.trim() !== '') return Number.isFinite(Number(v));",
    "  return false;",
    "}",
    "",
    "const expectedKey = String($env.OCR_FEEDBACK_API_KEY || $env.OCR_SHARED_API_KEY || '');",
    "const givenKey = String(headers['x-api-key'] || headers['X-API-Key'] || payload.api_key || '');",
    "if (!expectedKey) {",
    "  return [{ json: {",
    "    validation_ok: false,",
    "    auth_ok: false,",
    "    response_code: 500,",
    "    error_code: 'FEEDBACK_AUTH_NOT_CONFIGURED',",
    "    message: 'Feedback API key is not configured on server'",
    "  }}];",
    "}",
    "if (givenKey !== expectedKey) {",
    "  return [{ json: {",
    "    validation_ok: false,",
    "    auth_ok: false,",
    "    response_code: 401,",
    "    error_code: 'UNAUTHORIZED',",
    "    message: 'Unauthorized'",
    "  }}];",
    "}",
    "",
    "const pred = asObj(payload.ocr_pred_json);",
    "const fin = asObj(payload.admin_final_json);",
    "if (!pred || !fin) {",
    "  return [{ json: {",
    "    validation_ok: false,",
    "    auth_ok: true,",
    "    response_code: 422,",
    "    error_code: 'INVALID_PAYLOAD',",
    "    message: 'ocr_pred_json and admin_final_json are required (object or JSON string)'",
    "  }}];",
    "}",
    "if (!Array.isArray(pred.bills) || !Array.isArray(fin.bills)) {",
    "  return [{ json: {",
    "    validation_ok: false,",
    "    auth_ok: true,",
    "    response_code: 422,",
    "    error_code: 'INVALID_SCHEMA',",
    "    message: 'ocr_pred_json.bills and admin_final_json.bills must be arrays'",
    "  }}];",
    "}",
    "",
    "const docType = String(payload.doc_type || 'unknown').toLowerCase();",
    "const allowedDocTypes = ['fuel','electricity','fleet_card','parking','mixed','unknown'];",
    "if (!allowedDocTypes.includes(docType)) {",
    "  return [{ json: {",
    "    validation_ok: false,",
    "    auth_ok: true,",
    "    response_code: 422,",
    "    error_code: 'INVALID_DOC_TYPE',",
    "    message: 'doc_type is invalid'",
    "  }}];",
    "}",
    "",
    "for (let i = 0; i < fin.bills.length; i++) {",
    "  const b = fin.bills[i] || {};",
    "  if (b.total !== undefined && b.total !== null && b.total !== '' && !isNumeric(b.total)) {",
    "    return [{ json: {",
    "      validation_ok: false,",
    "      auth_ok: true,",
    "      response_code: 422,",
    "      error_code: 'INVALID_FIELD_TOTAL',",
    "      message: `admin_final_json.bills[${i}].total must be numeric`",
    "    }}];",
    "  }",
    "  if (b.invoice_date_th !== undefined && b.invoice_date_th !== null && b.invoice_date_th !== '' && !/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(String(b.invoice_date_th))) {",
    "    return [{ json: {",
    "      validation_ok: false,",
    "      auth_ok: true,",
    "      response_code: 422,",
    "      error_code: 'INVALID_FIELD_DATE',",
    "      message: `admin_final_json.bills[${i}].invoice_date_th must be DD/MM/YYYY`",
    "    }}];",
    "  }",
    "  if (b.vendor_tax_id !== undefined && b.vendor_tax_id !== null && b.vendor_tax_id !== '') {",
    "    const tax = String(b.vendor_tax_id).replace(/\\D/g, '');",
    "    if (tax.length !== 13) {",
    "      return [{ json: {",
    "        validation_ok: false,",
    "        auth_ok: true,",
    "        response_code: 422,",
    "        error_code: 'INVALID_FIELD_VENDOR_TAX_ID',",
    "        message: `admin_final_json.bills[${i}].vendor_tax_id must be 13 digits when provided`",
    "      }}];",
    "    }",
    "  }",
    "}",
    "",
    "const requestId = String(payload.request_id || payload.document_id || `${Date.now()}`);",
    "const documentId = String(payload.document_id || `doc_${requestId}`);",
    "",
    "return [{",
    "  json: {",
    "    validation_ok: true,",
    "    auth_ok: true,",
    "    response_code: 200,",
    "    document_id: documentId,",
    "    request_id: requestId,",
    "    reviewer_id: String(payload.reviewer_id || 'admin'),",
    "    reviewed_at_iso: new Date().toISOString(),",
    "    doc_type: docType,",
    "    vendor_hint: String(payload.vendor_hint || ''),",
    "    layout_hint: String(payload.layout_hint || ''),",
    "    ocr_pred_json: pred,",
    "    admin_final_json: fin",
    "  }",
    "}];",
  ].join('\n');

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'feedback-validation-ok',
            leftValue: '={{ $json.validation_ok }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [2840, 944],
    id: newId(),
    name: 'If (Feedback Payload Valid)'
  });

  ensureNode(nodes, {
    parameters: {
      respondWith: 'json',
      responseBody: "={{ ({ success: false, error_code: $json.error_code || 'INVALID_REQUEST', message: $json.message || 'Invalid request' }) }}",
      options: {
        responseCode: '={{ Number($json.response_code || 400) }}',
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: 'application/json; charset=utf-8' }
          ]
        }
      }
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.5,
    position: [3080, 1040],
    id: newId(),
    name: 'Respond to Webhook (feedback error)'
  });

  setMainConn(connections, 'Webhook_OCR_Feedback', [[{ node: 'Code (Validate Feedback Payload)', type: 'main', index: 0 }]]);
  setMainConn(connections, 'Code (Validate Feedback Payload)', [[{ node: 'If (Feedback Payload Valid)', type: 'main', index: 0 }]]);
  setMainConn(connections, 'If (Feedback Payload Valid)', [
    [{ node: 'Code (Build Feedback Diff)', type: 'main', index: 0 }],
    [{ node: 'Respond to Webhook (feedback error)', type: 'main', index: 0 }]
  ]);

  // Keep existing downstream chain intact and ensure success response still exists.
  ensureMainConn(connections, 'HTTP Save Example', 0, 'Respond to Webhook (feedback)');
}

function saveWorkflow(wf) {
  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.phase31.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.phase31.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(wf.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(wf.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.phase31.update.sql`);
  const sqlLines = [
    '.timeout 10000',
    `update workflow_entity`,
    `set nodes = cast(readfile('${nodesPath}') as text),`,
    `    connections = cast(readfile('${conPath}') as text),`,
    `    updatedAt = strftime('%Y-%m-%d %H:%M:%f','now')`,
    `where id='${WORKFLOW_ID}';`,
    wf.activeVersionId
      ? `update workflow_history set nodes = cast(readfile('${nodesPath}') as text), connections = cast(readfile('${conPath}') as text), updatedAt = strftime('%Y-%m-%d %H:%M:%f','now') where versionId='${wf.activeVersionId}';`
      : 'select 1;',
    `insert or replace into webhook_entity (workflowId, webhookPath, method, node, webhookId, pathLength) values ('${WORKFLOW_ID}','ocr-feedback','POST','Webhook_OCR_Feedback',NULL,NULL);`,
    'select changes();'
  ];
  fs.writeFileSync(sqlPath, `${sqlLines.join('\n')}\n`, 'utf8');
  const out = sh(`sqlite3 ${DB_PATH} < ${sqlPath}`);
  return Number(out || 0);
}

function main() {
  const wf = getWorkflow();
  const backup = backupWorkflow(wf);
  patchSecurity(wf.nodes, wf.connections);
  const dbChanges = saveWorkflow(wf);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    workflow_id: wf.id,
    backup,
    node_count: wf.nodes.length,
    db_changes: dbChanges,
  }, null, 2)}\n`);
}

main();

