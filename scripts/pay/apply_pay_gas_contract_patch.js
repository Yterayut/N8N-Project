#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = process.env.N8N_DB_PATH || '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = process.env.WORKFLOW_ID || 'rZjkLEVp0IM9xKfh';
const WORKFLOW_NAME = process.env.WORKFLOW_NAME || 'PAY';

function sh(cmd) {
  return execSync(cmd, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function q(sql) {
  return sh(`sqlite3 -json ${DB_PATH} "${sql.replace(/"/g, '""')}"`);
}

function getWorkflow() {
  const raw = q(`
    select id,name,nodes,connections,activeVersionId
    from workflow_entity
    where id='${WORKFLOW_ID}' and name='${WORKFLOW_NAME}'
    limit 1;
  `);
  const rows = JSON.parse(raw || '[]');
  if (!rows.length) {
    throw new Error(`Workflow not found: ${WORKFLOW_ID} (${WORKFLOW_NAME})`);
  }
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    nodes: JSON.parse(row.nodes || '[]'),
    connections: JSON.parse(row.connections || '{}'),
    activeVersionId: row.activeVersionId || null
  };
}

function findNode(nodes, name) {
  const node = nodes.find((item) => item.name === name);
  if (!node) throw new Error(`Missing node: ${name}`);
  return node;
}

function ensureNodePatched(workflow) {
  const httpNode = findNode(workflow.nodes, 'HTTP Request1');
  httpNode.parameters = httpNode.parameters || {};
  httpNode.parameters.method = 'POST';
  httpNode.parameters.sendBody = true;
  httpNode.parameters.specifyBody = 'json';
  delete httpNode.parameters.bodyParameters;
  httpNode.parameters.jsonBody = `={
  "action": "handleN8nTransaction",
  "api_key": "{{ $env.PAY_API_SHARED_SECRET }}",
  "source": "n8n",
  "request_id": "{{ $execution.id }}",
  "data": {
    "date": "{{ $('Code in JavaScript').item.json.date }}",
    "time": "{{ $('Code in JavaScript').item.json.time }}",
    "transaction_type": "{{ $('Code in JavaScript').item.json.transaction_type }}",
    "amount": "{{ $('Code in JavaScript').item.json.amount }}",
    "category": "{{ $('Code in JavaScript').item.json.category }}",
    "sender_name": "{{ $('Code in JavaScript').item.json.sender_name }}",
    "sender_bank": "{{ $('Code in JavaScript').item.json.sender_bank }}",
    "receiver_name": "{{ $('Code in JavaScript').item.json.receiver_name }}",
    "receiver_bank": "{{ $('Code in JavaScript').item.json.receiver_bank }}",
    "ref_id": "{{ $('Code in JavaScript').item.json.ref_id }}",
    "execution_id": "{{ $execution.id }}",
    "source": "n8n",
    "request_id": "{{ $execution.id }}"
  }
}`;
  httpNode.parameters.options = httpNode.parameters.options || {};

  const ifNode = findNode(workflow.nodes, 'If14');
  ifNode.parameters.conditions.conditions[0].rightValue = 'ok';

  const replyNode = findNode(workflow.nodes, 'Reply1');
  replyNode.parameters.jsonBody = `={
  "replyToken": "{{ $('Webhook').item.json.body.events[0].replyToken }}",
  "messages": [
    {
      "type": "text",
      "text": "{{ $json.status === 'duplicate' ? ('⚠️ ' + ($json.error || 'สลิปนี้บันทึกไปแล้ว')) : ('❌ ' + ($json.error || 'ไม่สามารถบันทึกรายการได้')) }}"
    }
  ]
}`;
}

function backupWorkflow(workflow) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const dir = path.join(process.cwd(), 'backups', 'workflow-freeze');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${WORKFLOW_ID}-pay-gas-contract-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
  return file;
}

function applyWorkflow(workflow) {
  const tmpDir = path.join(process.cwd(), '.tmp', 'pay-patch');
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, 'pay.nodes.json');
  const connectionsPath = path.join(tmpDir, 'pay.connections.json');
  fs.writeFileSync(nodesPath, JSON.stringify(workflow.nodes, null, 2));
  fs.writeFileSync(connectionsPath, JSON.stringify(workflow.connections, null, 2));

  const sql = [
    `update workflow_entity set nodes=cast(readfile('${nodesPath}') as text), connections=cast(readfile('${connectionsPath}') as text), updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where id='${WORKFLOW_ID}';`,
    workflow.activeVersionId
      ? `update workflow_history set nodes=cast(readfile('${nodesPath}') as text), connections=cast(readfile('${connectionsPath}') as text), updatedAt=strftime('%Y-%m-%d %H:%M:%f','now') where versionId='${workflow.activeVersionId}';`
      : 'select 1;'
  ].join('\n');

  const sqlPath = path.join(tmpDir, 'apply-pay-patch.sql');
  fs.writeFileSync(sqlPath, `${sql}\n`, 'utf8');
  sh(`sqlite3 ${DB_PATH} < ${sqlPath}`);
}

function main() {
  const workflow = getWorkflow();
  const backupFile = backupWorkflow(workflow);
  ensureNodePatched(workflow);
  applyWorkflow(workflow);
  console.log(JSON.stringify({
    ok: true,
    workflowId: workflow.id,
    workflowName: workflow.name,
    backupFile
  }, null, 2));
}

main();
