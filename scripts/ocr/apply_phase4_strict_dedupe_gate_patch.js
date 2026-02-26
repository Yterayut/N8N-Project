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
  const file = path.join(dir, `${WORKFLOW_ID}-phase4-strict-dedupe-${stamp}.json`);
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

function applyStrictDedupe(wf) {
  ensureNode(wf.nodes, {
    parameters: {
      jsCode: "const x = $('Code (Build Dedupe Reserve Payload)').first().json || {};\nreturn [{ json: { ...x, dedupe_gate_status: 'dedupe_api_not_configured' } }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [5104, 352],
    id: newId(),
    name: 'Code (Dedupe Gate Not Configured)'
  });

  setMainConn(wf.connections, 'If (Feedback API Configured - Dedupe)', [
    [{ node: 'HTTP Reserve Row Key', type: 'main', index: 0 }],
    [{ node: 'Code (Dedupe Gate Not Configured)', type: 'main', index: 0 }]
  ]);
}

function saveWorkflow(wf) {
  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.phase4strict.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.phase4strict.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(wf.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(wf.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.phase4strict.update.sql`);
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
  return Number(sh(`sqlite3 ${DB_PATH} < ${sqlPath}`) || 0);
}

function main() {
  const wf = getWorkflow();
  const backup = backupWorkflow(wf);
  applyStrictDedupe(wf);
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

