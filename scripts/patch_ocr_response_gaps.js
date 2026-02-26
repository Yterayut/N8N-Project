#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const DB = '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = 'up1n75qEhbsXswii';

function getRow() {
  const q = `select id,nodes,connections from workflow_entity where id='${WORKFLOW_ID}' limit 1;`;
  const raw = execSync(`sqlite3 -json ${DB} "${q}"`, { encoding: 'utf8' });
  const arr = JSON.parse(raw);
  if (!arr.length) throw new Error('workflow not found');
  return arr[0];
}

function hasConn(list, nodeName) {
  return Array.isArray(list) && list.some((x) => x && x.node === nodeName && x.type === 'main');
}

const row = getRow();
const connections = JSON.parse(row.connections || '{}');
let changed = false;

const DUP_NODE = 'Respond to Webhook (duplicate)';
const APPEND_NODE = 'Append row in shee OCR';

if (connections['If (Duplicate Check)']?.main) {
  connections['If (Duplicate Check)'].main[1] = connections['If (Duplicate Check)'].main[1] || [];
  if (!hasConn(connections['If (Duplicate Check)'].main[1], DUP_NODE)) {
    connections['If (Duplicate Check)'].main[1].push({ node: DUP_NODE, type: 'main', index: 0 });
    changed = true;
  }
}

if (connections['If (Atomic Reserve Success)']?.main) {
  connections['If (Atomic Reserve Success)'].main[1] = connections['If (Atomic Reserve Success)'].main[1] || [];
  if (!hasConn(connections['If (Atomic Reserve Success)'].main[1], DUP_NODE)) {
    connections['If (Atomic Reserve Success)'].main[1].push({ node: DUP_NODE, type: 'main', index: 0 });
    changed = true;
  }
}

if (!connections['Code (Dedupe Gate Not Configured)']) {
  connections['Code (Dedupe Gate Not Configured)'] = { main: [[]] };
  changed = true;
}

if (connections['Code (Dedupe Gate Not Configured)']?.main) {
  connections['Code (Dedupe Gate Not Configured)'].main[0] = connections['Code (Dedupe Gate Not Configured)'].main[0] || [];
  if (!hasConn(connections['Code (Dedupe Gate Not Configured)'].main[0], APPEND_NODE)) {
    connections['Code (Dedupe Gate Not Configured)'].main[0].push({ node: APPEND_NODE, type: 'main', index: 0 });
    changed = true;
  }
}

if (!changed) {
  console.log('No change needed');
  process.exit(0);
}

const connText = JSON.stringify(connections);
const tmpFile = '/tmp/ocr-connections-patched.json';
fs.writeFileSync(tmpFile, connText, 'utf8');
const updateSql = `
UPDATE workflow_entity
SET connections = CAST(readfile('${tmpFile}') AS TEXT),
    updatedAt = strftime('%Y-%m-%d %H:%M:%f', 'now')
WHERE id = '${WORKFLOW_ID}';
`;
execSync(`sqlite3 ${DB} <<'SQL'\n${updateSql}\nSQL`);
console.log('Patched workflow connections');
