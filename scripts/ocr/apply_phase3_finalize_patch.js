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
  const file = path.join(dir, `${WORKFLOW_ID}-phase3-finalize-${stamp}.json`);
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

function patchBuildRequest(nodes) {
  const buildReq = findNode(nodes, 'Code (Build Request)');
  if (!buildReq) throw new Error('Missing node: Code (Build Request)');

  buildReq.parameters.jsCode = [
    "const promptRows = $('Get row(s) in sheet1').all();",
    "const fileData = $('HTTP Upload File5').first().json.file || {};",
    "const classifier = $('Code (Document Classifier)').first().json || {};",
    "",
    "const docType = String(classifier.doc_type || 'unknown').toLowerCase();",
    "",
    "const keyMap = {",
    "  electricity: ['electricity'],",
    "  fuel: ['fuel'],",
    "  fleet_card: ['fleet_card'],",
    "  parking: ['parking'],",
    "  mixed: ['electricity', 'fuel', 'fleet_card', 'parking'],",
    "  unknown: [],",
    "};",
    "",
    "const wantedTypeKeys = keyMap[docType] || [];",
    "const selected = [];",
    "",
    "for (const row of promptRows) {",
    "  const active = String(row.json.active || '').toUpperCase();",
    "  if (active !== 'TRUE') continue;",
    "",
    "  const key = String(row.json.key || '').trim().toLowerCase();",
    "  if (!key) continue;",
    "",
    "  if (key === 'base') {",
    "    selected.push(String(row.json.prompt || ''));",
    "    continue;",
    "  }",
    "",
    "  if (wantedTypeKeys.includes(key)) selected.push(String(row.json.prompt || ''));",
    "}",
    "",
    "if (!selected.length) {",
    "  for (const row of promptRows) {",
    "    const active = String(row.json.active || '').toUpperCase();",
    "    const key = String(row.json.key || '').trim().toLowerCase();",
    "    if (active === 'TRUE' && key === 'base') {",
    "      selected.push(String(row.json.prompt || ''));",
    "      break;",
    "    }",
    "  }",
    "}",
    "",
    "let fewShotText = '';",
    "let fewShotCount = 0;",
    "try {",
    "  const few = $('Code (Select Few-shot Examples)').first().json || {};",
    "  fewShotText = String(few.few_shot_text || '').trim();",
    "  fewShotCount = Number(few.few_shot_count || 0);",
    "} catch (_) {}",
    "",
    "const fullPrompt = selected.join('\\n\\n').trim();",
    "const finalPrompt = fewShotText",
    "  ? `${fullPrompt}\\n\\n### FEW-SHOT EXAMPLES (REFERENCE ONLY)\\n${fewShotText}\\n\\nRules:\\n- Use examples as reference only\\n- Do not copy unrelated values\\n- Return JSON only`",
    "  : fullPrompt;",
    "",
    "return [{",
    "  json: {",
    "    promptEncoded: JSON.stringify(finalPrompt),",
    "    file: fileData,",
    "    doc_type: docType,",
    "    doc_type_confidence: classifier.doc_type_confidence || 0,",
    "    doc_type_reason: classifier.doc_type_reason || 'n/a',",
    "    few_shot_count: fewShotCount,",
    "  }",
    "}];",
  ].join('\n');
}

function addFewShotNodes(nodes, connections) {
  ensureNode(nodes, {
    parameters: {
      jsCode: "const classifier = $('Code (Document Classifier)').first().json || {};\nconst docType = String(classifier.doc_type || 'unknown').toLowerCase();\nconst payload = {\n  action: 'read',\n  sheet: 'OCR_EXAMPLES',\n  filter: {\n    doc_type: docType,\n    active: true\n  }\n};\nreturn [{ json: { doc_type: docType, payload } }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1968, 240],
    id: newId(),
    name: 'Code (Build Few-shot Query)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'fewshot-api-configured',
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
    position: [2208, 240],
    id: newId(),
    name: 'If (Feedback API Configured - Few-shot)'
  });

  ensureNode(nodes, {
    parameters: {
      method: 'POST',
      url: '={{ $env.OCR_FEEDBACK_API_URL }}',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'x-api-key', value: '={{ $env.OCR_FEEDBACK_API_KEY || $env.OCR_SHARED_API_KEY }}' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ $json.payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [2448, 192],
    id: newId(),
    name: 'HTTP Read OCR_EXAMPLES',
    continueOnFail: true
  });

  ensureNode(nodes, {
    parameters: {
      jsCode: "function parseMaybeJson(v){\n  if (v && typeof v === 'object') return v;\n  if (typeof v === 'string' && v.trim()) {\n    try { return JSON.parse(v); } catch (_) { return null; }\n  }\n  return null;\n}\n\nlet rows = [];\ntry {\n  const r = $('HTTP Read OCR_EXAMPLES').first().json;\n  if (Array.isArray(r)) rows = r;\n  else if (Array.isArray(r?.data)) rows = r.data;\n} catch (_) {\n  rows = [];\n}\n\nif (!Array.isArray(rows)) rows = [];\n\nconst activeRows = rows.filter((x) => {\n  const v = String(x.active ?? '').toLowerCase();\n  return v === 'true' || v === '1' || v === 'yes';\n});\n\nconst picked = (activeRows.length ? activeRows : rows).slice(0, 3);\n\nconst parts = [];\nfor (let i = 0; i < picked.length; i++) {\n  const ex = picked[i] || {};\n  const key = String(ex.example_key || `example_${i + 1}`);\n  const gold = parseMaybeJson(ex.gold_json) || ex.gold_json || '';\n  const goldText = typeof gold === 'string' ? gold : JSON.stringify(gold);\n  if (!goldText) continue;\n  parts.push(`Example ${i + 1} (${key}):\\n${goldText}`);\n}\n\nlet fewShotText = parts.join('\\n\\n');\nif (fewShotText.length > 6000) {\n  fewShotText = fewShotText.slice(0, 6000);\n}\n\nreturn [{\n  json: {\n    few_shot_text: fewShotText,\n    few_shot_count: parts.length\n  }\n}];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2688, 240],
    id: newId(),
    name: 'Code (Select Few-shot Examples)'
  });

  setMainConn(connections, 'Get row(s) in sheet1', [
    [{ node: 'Code (Build Few-shot Query)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'Code (Build Few-shot Query)', [
    [{ node: 'If (Feedback API Configured - Few-shot)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'If (Feedback API Configured - Few-shot)', [
    [{ node: 'HTTP Read OCR_EXAMPLES', type: 'main', index: 0 }],
    [{ node: 'Code (Select Few-shot Examples)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'HTTP Read OCR_EXAMPLES', [
    [{ node: 'Code (Select Few-shot Examples)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'Code (Select Few-shot Examples)', [
    [{ node: 'Code (Build Request)', type: 'main', index: 0 }]
  ]);
}

function saveWorkflow(wf) {
  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.phase3final.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.phase3final.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(wf.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(wf.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.phase3final.update.sql`);
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
    'select changes();'
  ].join('\n');
  fs.writeFileSync(sqlPath, `${sql}\n`, 'utf8');
  const out = sh(`sqlite3 ${DB_PATH} < ${sqlPath}`);
  return Number(out || 0);
}

function main() {
  const wf = getWorkflow();
  const backup = backupWorkflow(wf);
  patchBuildRequest(wf.nodes);
  addFewShotNodes(wf.nodes, wf.connections);
  const changes = saveWorkflow(wf);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    workflow_id: wf.id,
    backup,
    node_count: wf.nodes.length,
    db_changes: changes
  }, null, 2)}\n`);
}

main();

