#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const {execSync}=require('child_process');
const DB_PATH=process.env.N8N_DB_PATH||'.n8n-dev/.n8n/database.sqlite';
const WORKFLOW_ID=process.env.WORKFLOW_ID||'up1n75qEhbsXswii';
function sh(c){return execSync(c,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
const row=JSON.parse(sh(`sqlite3 -json ${DB_PATH} "select nodes,connections,activeVersionId from workflow_entity where id='${WORKFLOW_ID}'"`))[0];
const nodes=JSON.parse(row.nodes||'[]');
let changed=0;
for(const n of nodes){
  if(n?.type!=='n8n-nodes-base.code') continue;
  const c=String(n.parameters?.jsCode||'');
  if(c.length>200 && c.includes('\\n') && !c.includes('\n')){
    n.parameters.jsCode=c.replace(/\\n/g,'\n');
    changed++;
  }
}
const tmp='.tmp';fs.mkdirSync(tmp,{recursive:true});
const npath=path.join(tmp,`${WORKFLOW_ID}.fixnl.nodes.json`);const cpath=path.join(tmp,`${WORKFLOW_ID}.fixnl.connections.json`);
fs.writeFileSync(npath,JSON.stringify(nodes),'utf8');fs.writeFileSync(cpath,JSON.stringify(JSON.parse(row.connections||'{}')),'utf8');
const sql=[
'.timeout 10000',
`update workflow_entity set nodes = cast(readfile('${npath}') as text), updatedAt = strftime('%Y-%m-%d %H:%M:%f','now') where id='${WORKFLOW_ID}';`,
row.activeVersionId?`update workflow_history set nodes = cast(readfile('${npath}') as text), updatedAt = strftime('%Y-%m-%d %H:%M:%f','now') where versionId='${row.activeVersionId}';`:'select 1;',
'select changes();'
].join('\n');
const spath=path.join(tmp,`${WORKFLOW_ID}.fixnl.sql`);fs.writeFileSync(spath,sql+'\n');
sh(`sqlite3 ${DB_PATH} < ${spath}`);
console.log(JSON.stringify({ok:true,changed},null,2));
