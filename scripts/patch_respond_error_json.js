#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

const DB = '.n8n-dev/.n8n/database.sqlite';
const WID = 'up1n75qEhbsXswii';

function get() {
  const raw = execSync(`sqlite3 -json ${DB} "select nodes from workflow_entity where id='${WID}' limit 1;"`, { encoding: 'utf8' });
  const row = JSON.parse(raw)[0];
  return JSON.parse(row.nodes || '[]');
}

function save(nodes) {
  const tmp = '/tmp/ocr-nodes-patched.json';
  fs.writeFileSync(tmp, JSON.stringify(nodes), 'utf8');
  const sql = `
UPDATE workflow_entity
SET nodes = CAST(readfile('${tmp}') AS TEXT),
    updatedAt = strftime('%Y-%m-%d %H:%M:%f', 'now')
WHERE id='${WID}';`;
  execSync(`sqlite3 ${DB} <<'SQL'\n${sql}\nSQL`);
}

const nodes = get();
let changed = 0;

for (const n of nodes) {
  if (n.name === 'Respond to Webhook (error)' || n.name === 'Respond to Webhook (error)3') {
    n.parameters = n.parameters || {};
    n.parameters.respondWith = 'json';
    n.parameters.responseBody = '={{ ({ success:false, error_code:"OCR_FAILED", message: ($json.error?.message || "Failed to process the document. Please try again."), request_id: String($json.request_id || $runId || ""), status:"error", data:{ bills:[] } }) }}';
    n.parameters.options = n.parameters.options || {};
    n.parameters.options.responseCode = '={{ Number($json.error?.status || 500) }}';
    n.parameters.options.responseHeaders = { entries: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }] };
    changed++;
  }
}

if (!changed) {
  console.log('No matching nodes found');
  process.exit(1);
}

save(nodes);
console.log(`Patched ${changed} respond error node(s)`);
