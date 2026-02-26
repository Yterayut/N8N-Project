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
  const file = path.join(dir, `${WORKFLOW_ID}-phase4-atomic-dedupe-${stamp}.json`);
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

function patchDedupe(nodes, connections) {
  ensureNode(nodes, {
    parameters: {
      jsCode: "const x = $json || {};\nreturn [{\n  json: {\n    ...x,\n    reserve_payload: {\n      action: 'reserve_key',\n      sheet: 'OCR_DEDUPE',\n      key_column: 'row_key',\n      key_value: String(x.row_key || '')\n    }\n  }\n}];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [4624, 288],
    id: newId(),
    name: 'Code (Build Dedupe Reserve Payload)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'dedupe-api-configured',
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
    position: [4864, 288],
    id: newId(),
    name: 'If (Feedback API Configured - Dedupe)'
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
      jsonBody: '={{ $json.reserve_payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [5104, 224],
    id: newId(),
    name: 'HTTP Reserve Row Key',
    continueOnFail: true
  });

  ensureNode(nodes, {
    parameters: {
      jsCode: "const src = $('Code (Build Dedupe Reserve Payload)').first().json || {};\nconst resp = $json || {};\nlet reserved = false;\nlet duplicate = false;\n\nif (resp && resp.data && typeof resp.data === 'object') {\n  reserved = Boolean(resp.data.reserved === true);\n  duplicate = Boolean(resp.data.duplicate === true);\n} else if (resp && typeof resp.reserved !== 'undefined') {\n  reserved = Boolean(resp.reserved === true);\n  duplicate = Boolean(resp.duplicate === true);\n} else {\n  reserved = false;\n  duplicate = true;\n}\n\nreturn [{\n  json: {\n    ...src,\n    atomic_reserved: reserved,\n    atomic_duplicate: duplicate,\n    is_duplicate: duplicate || !reserved\n  }\n}];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [5344, 224],
    id: newId(),
    name: 'Code (Apply Atomic Dedupe Result)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'atomic-reserved',
            leftValue: '={{ $json.atomic_reserved }}',
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
    position: [5584, 224],
    id: newId(),
    name: 'If (Atomic Reserve Success)'
  });

  // Replace previous direct append path with atomic gate.
  setMainConn(connections, 'If (Duplicate Check)', [
    [{ node: 'Code (Build Dedupe Reserve Payload)', type: 'main', index: 0 }],
    []
  ]);
  setMainConn(connections, 'Code (Build Dedupe Reserve Payload)', [
    [{ node: 'If (Feedback API Configured - Dedupe)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'If (Feedback API Configured - Dedupe)', [
    [{ node: 'HTTP Reserve Row Key', type: 'main', index: 0 }],
    [{ node: 'Append row in shee OCR', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'HTTP Reserve Row Key', [
    [{ node: 'Code (Apply Atomic Dedupe Result)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'Code (Apply Atomic Dedupe Result)', [
    [{ node: 'If (Atomic Reserve Success)', type: 'main', index: 0 }]
  ]);
  setMainConn(connections, 'If (Atomic Reserve Success)', [
    [{ node: 'Append row in shee OCR', type: 'main', index: 0 }],
    []
  ]);
}

function saveWorkflow(wf) {
  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.phase4dedupe.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.phase4dedupe.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(wf.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(wf.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.phase4dedupe.update.sql`);
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
  patchDedupe(wf.nodes, wf.connections);
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

