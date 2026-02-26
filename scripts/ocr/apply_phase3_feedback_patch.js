#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DB_PATH = process.env.N8N_DB_PATH || '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = process.env.WORKFLOW_ID || 'up1n75qEhbsXswii';
const DRY_RUN = process.argv.includes('--dry-run');

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
  const file = path.join(dir, `${WORKFLOW_ID}-phase3-${stamp}.json`);
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

function ensureMainConn(connections, from, branchIdx, to) {
  if (!connections[from]) connections[from] = {};
  if (!connections[from].main) connections[from].main = [];
  while (connections[from].main.length <= branchIdx) connections[from].main.push([]);
  const arr = connections[from].main[branchIdx];
  if (!arr.find((x) => x.node === to && x.type === 'main' && x.index === 0)) {
    arr.push({ node: to, type: 'main', index: 0 });
  }
}

function updateCodeNode(nodes, name, mutator) {
  const node = findNode(nodes, name);
  if (!node) throw new Error(`Missing node: ${name}`);
  const oldCode = String(node.parameters?.jsCode || '');
  const newCode = mutator(oldCode);
  if (newCode !== oldCode) node.parameters.jsCode = newCode;
}

function patchCodes(nodes) {
  updateCodeNode(nodes, 'Code in JavaScript9', (code) => {
    if (code.includes('const document_id =')) return code;
    return code
      .replace(
        "const request_id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;",
        "const request_id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;\nconst document_id = `doc_${request_id}`;"
      )
      .replace(
        "    request_id,",
        "    document_id,\n    request_id,"
      );
  });

  updateCodeNode(nodes, 'Code (Validate Feedback Payload)', (_code) => {
    return "const payload = ($json && typeof $json.body === 'object' && $json.body !== null) ? $json.body : ($json || {});\n\nfunction asObj(v){\n  if (v && typeof v === 'object') return v;\n  if (typeof v === 'string' && v.trim()) {\n    try { return JSON.parse(v); } catch (_) { return null; }\n  }\n  return null;\n}\n\nconst pred = asObj(payload.ocr_pred_json);\nconst fin = asObj(payload.admin_final_json);\nif (!pred || !fin) {\n  throw new Error('ocr_pred_json and admin_final_json are required (object or JSON string)');\n}\n\nconst requestId = String(payload.request_id || payload.document_id || `${Date.now()}`);\nconst documentId = String(payload.document_id || `doc_${requestId}`);\n\nreturn [{\n  json: {\n    document_id: documentId,\n    request_id: requestId,\n    reviewer_id: String(payload.reviewer_id || 'admin'),\n    reviewed_at_iso: new Date().toISOString(),\n    doc_type: String(payload.doc_type || 'unknown'),\n    vendor_hint: String(payload.vendor_hint || ''),\n    layout_hint: String(payload.layout_hint || ''),\n    ocr_pred_json: pred,\n    admin_final_json: fin\n  }\n}];";
  });

  const respond = findNode(nodes, 'Respond to Webhook6');
  if (!respond) throw new Error('Missing node: Respond to Webhook6');
  let body = String(respond.parameters?.responseBody || '');
  if (!body.includes('document_id')) {
    body = body.replace(
      "    request_id: $json.request_id || '',",
      "    document_id: $json.document_id || '',\n    request_id: $json.request_id || '',"
    );
    respond.parameters.responseBody = body;
  }
}

function addPredictionLogBranch(nodes, connections) {
  ensureNode(nodes, {
    parameters: {
      jsCode: "const x = $json || {};\nconst save = {\n  action: 'create',\n  sheet: 'OCR_PREDICTIONS',\n  data: {\n    document_id: String(x.document_id || ''),\n    request_id: String(x.request_id || ''),\n    created_at_iso: String(x.created_at_iso || new Date().toISOString()),\n    doc_type: String(x.doc_type || 'unknown'),\n    doc_type_confidence: Number(x.doc_type_confidence || 0),\n    decision: String(x.decision || 'needs_review'),\n    confidence: Number(x.confidence || 0),\n    status: String(x.status || 'error'),\n    source_file: String(x.source_file || ''),\n    model_version: String(x.model_version || ''),\n    pred_json: String(x.raw_json || ''),\n    validation_errors_json: JSON.stringify(x.validation_errors || []),\n    critical_error_count: Number(x.critical_error_count || 0),\n    used_reask: Boolean(x.used_reask || false)\n  }\n};\nreturn [{ json: { save_payload: save } }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [3360, 112],
    id: newId(),
    name: 'Code (Build Prediction Save Payload)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'feedback-url-pred',
            leftValue: '={{ !!$env.OCR_FEEDBACK_API_URL }}',
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
    position: [3600, 112],
    id: newId(),
    name: 'If (Feedback API Configured - Prediction)'
  });

  ensureNode(nodes, {
    parameters: {
      method: 'POST',
      url: '={{ $env.OCR_FEEDBACK_API_URL }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ $json.save_payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [3840, 80],
    id: newId(),
    name: 'HTTP Save Prediction',
    continueOnFail: true
  });

  ensureMainConn(connections, 'Code (Finalize Decision)', 0, 'Code (Build Prediction Save Payload)');
  ensureMainConn(connections, 'Code (Build Prediction Save Payload)', 0, 'If (Feedback API Configured - Prediction)');
  ensureMainConn(connections, 'If (Feedback API Configured - Prediction)', 0, 'HTTP Save Prediction');
}

function addCorrectionWebhook(nodes, connections) {
  ensureNode(nodes, {
    parameters: {
      httpMethod: 'POST',
      path: 'ocr-feedback',
      responseMode: 'responseNode',
      options: {}
    },
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position: [2480, 944],
    id: newId(),
    name: 'Webhook_OCR_Feedback',
    webhookId: newId()
  });

  ensureNode(nodes, {
    parameters: {
      jsCode: "const body = $json || {};\n\nfunction asObj(v){\n  if (v && typeof v === 'object') return v;\n  if (typeof v === 'string' && v.trim()) {\n    try { return JSON.parse(v); } catch (_) { return null; }\n  }\n  return null;\n}\n\nconst pred = asObj(body.ocr_pred_json);\nconst fin = asObj(body.admin_final_json);\nif (!pred || !fin) {\n  throw new Error('ocr_pred_json and admin_final_json are required (object or JSON string)');\n}\n\nconst requestId = String(body.request_id || body.document_id || `${Date.now()}`);\nconst documentId = String(body.document_id || `doc_${requestId}`);\n\nreturn [{\n  json: {\n    document_id: documentId,\n    request_id: requestId,\n    reviewer_id: String(body.reviewer_id || 'admin'),\n    reviewed_at_iso: new Date().toISOString(),\n    doc_type: String(body.doc_type || 'unknown'),\n    vendor_hint: String(body.vendor_hint || ''),\n    layout_hint: String(body.layout_hint || ''),\n    ocr_pred_json: pred,\n    admin_final_json: fin\n  }\n}];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2720, 944],
    id: newId(),
    name: 'Code (Validate Feedback Payload)'
  });

  ensureNode(nodes, {
    parameters: {
      jsCode: "function isObj(v){ return v && typeof v === 'object' && !Array.isArray(v); }\nfunction diff(a, b, p, out){\n  if (Array.isArray(a) || Array.isArray(b)) {\n    const aa = Array.isArray(a) ? a : [];\n    const bb = Array.isArray(b) ? b : [];\n    const n = Math.max(aa.length, bb.length);\n    for (let i=0;i<n;i++) diff(aa[i], bb[i], `${p}[${i}]`, out);\n    return;\n  }\n  if (isObj(a) || isObj(b)) {\n    const ao = isObj(a) ? a : {};\n    const bo = isObj(b) ? b : {};\n    const ks = Array.from(new Set([...Object.keys(ao), ...Object.keys(bo)])).sort();\n    for (const k of ks) diff(ao[k], bo[k], p ? `${p}.${k}` : k, out);\n    return;\n  }\n  const av = a === undefined ? null : a;\n  const bv = b === undefined ? null : b;\n  if (JSON.stringify(av) !== JSON.stringify(bv)) {\n    out.push({ field_path: p || '$', from: av, to: bv });\n  }\n}\n\nconst x = $json;\nconst changes = [];\ndiff(x.ocr_pred_json, x.admin_final_json, '', changes);\n\nconst vendor = String(x.vendor_hint || '').toLowerCase().replace(/\\s+/g, '_');\nconst layout = String(x.layout_hint || '').toLowerCase().replace(/\\s+/g, '_');\nconst fallbackLayout = layout || 'default';\nconst fallbackVendor = vendor || 'generic';\nconst exampleKey = `${fallbackVendor}_${x.doc_type || 'unknown'}_${fallbackLayout}`;\n\nconst correctionPayload = {\n  action: 'create',\n  sheet: 'OCR_CORRECTIONS',\n  data: {\n    correction_id: `corr_${Date.now()}_${Math.random().toString(16).slice(2,8)}`,\n    document_id: x.document_id,\n    request_id: x.request_id,\n    reviewer_id: x.reviewer_id,\n    reviewed_at_iso: x.reviewed_at_iso,\n    doc_type: x.doc_type,\n    vendor_hint: x.vendor_hint,\n    layout_hint: x.layout_hint,\n    pred_json: JSON.stringify(x.ocr_pred_json),\n    final_json: JSON.stringify(x.admin_final_json),\n    diff_json: JSON.stringify(changes),\n    changed_fields_count: changes.length\n  }\n};\n\nconst examplePayload = {\n  action: 'create',\n  sheet: 'OCR_EXAMPLES',\n  data: {\n    example_key: exampleKey,\n    doc_type: x.doc_type,\n    vendor_hint: x.vendor_hint,\n    layout_hint: x.layout_hint,\n    input_features_json: JSON.stringify({ doc_type: x.doc_type, vendor_hint: x.vendor_hint, layout_hint: x.layout_hint }),\n    gold_json: JSON.stringify(x.admin_final_json),\n    active: true,\n    updated_at_iso: x.reviewed_at_iso,\n    source_document_id: x.document_id\n  }\n};\n\nreturn [{ json: { ...x, changes, changed_fields_count: changes.length, correction_payload: correctionPayload, example_payload: examplePayload } }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2960, 944],
    id: newId(),
    name: 'Code (Build Feedback Diff)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'feedback-url-corr',
            leftValue: '={{ !!$env.OCR_FEEDBACK_API_URL }}',
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
    position: [3200, 944],
    id: newId(),
    name: 'If (Feedback API Configured - Correction)'
  });

  ensureNode(nodes, {
    parameters: {
      method: 'POST',
      url: '={{ $env.OCR_FEEDBACK_API_URL }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ $json.correction_payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [3440, 896],
    id: newId(),
    name: 'HTTP Save Correction',
    continueOnFail: true
  });

  ensureNode(nodes, {
    parameters: {
      method: 'POST',
      url: '={{ $env.OCR_FEEDBACK_API_URL }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ $json.example_payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [3680, 896],
    id: newId(),
    name: 'HTTP Save Example',
    continueOnFail: true
  });

  ensureNode(nodes, {
    parameters: {
      respondWith: 'json',
      responseBody: "={{ ({ success: true, document_id: $json.document_id, request_id: $json.request_id, changed_fields_count: Number($json.changed_fields_count || 0), message: 'feedback accepted' }) }}",
      options: {
        responseCode: 200,
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: 'application/json; charset=utf-8' }
          ]
        }
      }
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.5,
    position: [3920, 944],
    id: newId(),
    name: 'Respond to Webhook (feedback)'
  });

  ensureMainConn(connections, 'Webhook_OCR_Feedback', 0, 'Code (Validate Feedback Payload)');
  ensureMainConn(connections, 'Code (Validate Feedback Payload)', 0, 'Code (Build Feedback Diff)');
  ensureMainConn(connections, 'Code (Build Feedback Diff)', 0, 'If (Feedback API Configured - Correction)');
  ensureMainConn(connections, 'If (Feedback API Configured - Correction)', 0, 'HTTP Save Correction');
  ensureMainConn(connections, 'HTTP Save Correction', 0, 'HTTP Save Example');
  ensureMainConn(connections, 'HTTP Save Example', 0, 'Respond to Webhook (feedback)');
  ensureMainConn(connections, 'If (Feedback API Configured - Correction)', 1, 'Respond to Webhook (feedback)');
}

function applyPatch() {
  const wf = getWorkflow();
  const before = { id: wf.id, name: wf.name, nodes: wf.nodes, connections: wf.connections };
  const backup = backupWorkflow(before);

  patchCodes(wf.nodes);
  addPredictionLogBranch(wf.nodes, wf.connections);
  addCorrectionWebhook(wf.nodes, wf.connections);

  if (DRY_RUN) {
    process.stdout.write(JSON.stringify({
      dry_run: true,
      workflow_id: wf.id,
      backup,
      node_count: wf.nodes.length,
      has_feedback_webhook: Boolean(findNode(wf.nodes, 'Webhook_OCR_Feedback')),
      has_prediction_branch: Boolean(findNode(wf.nodes, 'Code (Build Prediction Save Payload)'))
    }, null, 2) + '\n');
    return;
  }

  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(wf.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(wf.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.phase3.update.sql`);
  const sql = [
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
    `select changes();`
  ].join('\n');
  fs.writeFileSync(sqlPath, `${sql}\n`, 'utf8');
  const changed = sh(`sqlite3 ${DB_PATH} < ${sqlPath}`);

  process.stdout.write(JSON.stringify({
    ok: true,
    workflow_id: wf.id,
    backup,
    node_count: wf.nodes.length,
    db_changes: Number(changed || 0)
  }, null, 2) + '\n');
}

applyPatch();
