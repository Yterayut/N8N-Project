#!/usr/bin/env node

const { execSync } = require('child_process');

const DB_PATH = process.env.N8N_DB_PATH || '.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID = process.env.WORKFLOW_ID || 'up1n75qEhbsXswii';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function queryJson(sql) {
  const raw = sh(`sqlite3 -json ${DB_PATH} "${sql.replace(/"/g, '""')}"`);
  return raw ? JSON.parse(raw) : [];
}

function checkNodes(nodes, scope) {
  const findings = [];
  for (const n of nodes || []) {
    const code = n?.parameters?.jsCode;
    if (typeof code !== 'string') continue;

    const hasRealNewline = code.includes('\n');
    const hasLiteralSlashN = code.includes('\\n');
    const suspicious =
      code.length > 200 &&
      hasLiteralSlashN &&
      !hasRealNewline;

    if (suspicious) {
      findings.push({
        scope,
        node: n.name || '(unnamed)',
        length: code.length,
        reason: 'Code node has literal \\n but no real newline characters',
      });
    }
  }
  return findings;
}

function main() {
  const wfRows = queryJson(
    `select id,name,nodes,activeVersionId from workflow_entity where id='${WORKFLOW_ID}' limit 1;`
  );
  if (!wfRows.length) {
    console.error(`workflow not found: ${WORKFLOW_ID}`);
    process.exit(2);
  }

  const wf = wfRows[0];
  const nodes = JSON.parse(wf.nodes || '[]');
  let findings = checkNodes(nodes, 'workflow_entity');

  if (wf.activeVersionId) {
    const histRows = queryJson(
      `select versionId,nodes from workflow_history where versionId='${wf.activeVersionId}' limit 1;`
    );
    if (histRows.length) {
      findings = findings.concat(
        checkNodes(JSON.parse(histRows[0].nodes || '[]'), `workflow_history:${wf.activeVersionId}`)
      );
    }
  }

  if (findings.length) {
    console.error(JSON.stringify({ ok: false, workflow_id: WORKFLOW_ID, findings }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, workflow_id: WORKFLOW_ID, checked: true }, null, 2));
}

main();

