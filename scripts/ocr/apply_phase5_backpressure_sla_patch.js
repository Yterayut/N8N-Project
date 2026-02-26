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
  const file = path.join(dir, `${WORKFLOW_ID}-phase5-backpressure-${stamp}.json`);
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

function patchCodeNodes(nodes) {
  const buildReq = findNode(nodes, 'Code (Build Request)');
  if (!buildReq) throw new Error('Missing node: Code (Build Request)');
  let buildReqCode = String(buildReq.parameters?.jsCode || '');
  if (!buildReqCode.includes('ocr_lane')) {
    buildReqCode = buildReqCode.replace(
      'const classifier = $(\'Code (Document Classifier)\').first().json || {};',
      'const classifier = $(\'Code (Document Classifier)\').first().json || {};\nconst sla = (() => { try { return $(\'Code (SLA Lane + Timeout Budget)\').first().json || {}; } catch (_) { return {}; } })();'
    );
    buildReqCode = buildReqCode.replace(
      '    few_shot_count: fewShotCount,',
      '    few_shot_count: fewShotCount,\n    ocr_lane: String(sla.ocr_lane || \'standard\'),\n    ocr_timeout_ms: Number(sla.ocr_timeout_ms || $env.OCR_TIMEOUT_MS || 65000),\n    ocr_retry_max: Number(sla.ocr_retry_max || $env.OCR_RETRY_MAX || 2),\n    retry_after_sec: Number(sla.retry_after_sec || $env.OCR_ADMISSION_RETRY_AFTER_SEC || 15),\n    admission_slot_token: String(sla.admission_slot_token || classifier.admission_slot_token || \'\'),\n    tenant_id: String(classifier.tenant_id || \'default\'),'
    );
    buildReq.parameters.jsCode = buildReqCode;
  }

  const buildReask = findNode(nodes, 'Code (Build Re-ask Request)');
  if (!buildReask) throw new Error('Missing node: Code (Build Re-ask Request)');
  let reaskCode = String(buildReask.parameters?.jsCode || '');
  if (!reaskCode.includes('ocr_timeout_ms')) {
    reaskCode = reaskCode.replace(
      'return [{json:{file,promptEncoded:JSON.stringify(prompt),carry:current}}];',
      'return [{json:{file,promptEncoded:JSON.stringify(prompt),carry:current,ocr_timeout_ms:Number(current.ocr_timeout_ms||$env.OCR_TIMEOUT_MS||65000)}}];'
    );
    buildReask.parameters.jsCode = reaskCode;
  }

  const parseNode = findNode(nodes, 'Code in JavaScript9');
  if (!parseNode) throw new Error('Missing node: Code in JavaScript9');
  let parseCode = String(parseNode.parameters?.jsCode || '');
  if (!parseCode.includes('admission_slot_token')) {
    parseCode = parseCode.replace(
      '// ====== OUTPUT 1 item สำหรับ OCR_RAW ======',
      'const admissionMeta = (() => { try { return $(\'Code (Parse Admission Result)\').first().json || {}; } catch (_) { return {}; } })();\n\n// ====== OUTPUT 1 item สำหรับ OCR_RAW ======'
    );
    parseCode = parseCode.replace(
      '    parse_error',
      `    parse_error,
    tenant_id: String(admissionMeta.tenant_id || $('Code in JavaScript5').first().json.tenant_id || 'default'),
    admission_slot_token: String(admissionMeta.admission_slot_token || ''),
    ocr_lane: String(admissionMeta.ocr_lane || ''),
    ocr_timeout_ms: Number(admissionMeta.ocr_timeout_ms || 0),
    retry_after_sec: Number(admissionMeta.retry_after_sec || 15)`
    );
    parseNode.parameters.jsCode = parseCode;
  }

  const errNode = findNode(nodes, 'Code in JavaScript17');
  if (!errNode) throw new Error('Missing node: Code in JavaScript17');
  let errCode = String(errNode.parameters?.jsCode || '');
  if (!errCode.includes('admission_slot_token')) {
    errNode.parameters.jsCode = [
      "function pad2(x) { return String(x).padStart(2, \"0\"); }",
      "function nowThai() {",
      "  const d = new Date();",
      "  const tz = new Date(d.getTime() + (7 * 60 * 60 * 1000));",
      "  const yyyy = tz.getUTCFullYear() + 543;",
      "  const mm = pad2(tz.getUTCMonth() + 1);",
      "  const dd = pad2(tz.getUTCDate());",
      "  const hh = pad2(tz.getUTCHours());",
      "  const mi = pad2(tz.getUTCMinutes());",
      "  const ss = pad2(tz.getUTCSeconds());",
      "  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;",
      "}",
      "",
      "const adm = (() => { try { return $('Code (Parse Admission Result)').first().json || {}; } catch (_) { return {}; } })();",
      "return [{",
      "  json: {",
      "    request_id: String(adm.request_id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),",
      "    source_file: $('Webhook_OCR_Test5').first().binary?.files0?.fileName || 'unknown',",
      "    created_at: nowThai(),",
      "    created_at_iso: new Date().toISOString(),",
      "    model_version: '',",
      "    prompt_tokens: 0,",
      "    candidates_tokens: 0,",
      "    total_tokens: 0,",
      "    est_cost_thb: 0,",
      "    status: 'error',",
      "    bills_count: 0,",
      "    file_size_kb: Math.round(($('Webhook_OCR_Test5').first().binary?.files0?.fileSize || 0) / 1024),",
      "    caller_ip: $('Code in JavaScript5').first().json.allHeaders?.['x-forwarded-for'] || 'unknown',",
      "    raw_text: JSON.stringify($json || {}),",
      "    raw_text_pretty: '',",
      "    raw_json: '',",
      "    tenant_id: String(adm.tenant_id || 'default'),",
      "    admission_slot_token: String(adm.admission_slot_token || ''),",
      "    ocr_lane: String(adm.ocr_lane || ''),",
      "    ocr_timeout_ms: Number(adm.ocr_timeout_ms || 0),",
      "    retry_after_sec: Number(adm.retry_after_sec || 15)",
      "  }",
      "}];"
    ].join('\\n');
  }

  const telegramNode = findNode(nodes, 'Code (Build Telegram Notification OCR)');
  if (!telegramNode) throw new Error('Missing node: Code (Build Telegram Notification OCR)');
  let teleCode = String(telegramNode.parameters?.jsCode || '');
  if (!teleCode.includes('admission_release_payload')) {
    teleCode = teleCode.replace(
      "return [{ json: { ...j, telegram_text: lines.join('\\n') } }];",
      "const slotToken = String(j.admission_slot_token || '');\nconst admission_release_payload = slotToken ? { action: 'release_slot', slot_token: slotToken } : null;\nreturn [{ json: { ...j, telegram_text: lines.join('\\n'), admission_release_payload } }];"
    );
    telegramNode.parameters.jsCode = teleCode;
  }
}

function patchHttpTimeout(nodes) {
  for (const name of ['HTTP GenerateContent3', 'HTTP GenerateContent (Re-ask)']) {
    const node = findNode(nodes, name);
    if (!node) continue;
    node.parameters = node.parameters || {};
    node.parameters.options = node.parameters.options || {};
    node.parameters.options.timeout = '={{ Number($json.ocr_timeout_ms || $env.OCR_TIMEOUT_MS || 65000) }}';
  }
}

function addNodes(nodes, connections) {
  ensureNode(nodes, {
    parameters: {
      jsCode: "const src = $input.first();\nconst tenantId = String(src.json.tenant_id || src.json.body?.tenant_id || src.json.query?.tenant_id || 'default');\nconst requestId = String(src.json.headers?.['x-request-id'] || src.json.request_id || `${Date.now()}-${Math.random().toString(16).slice(2,8)}`);\nconst retryAfter = Number($env.OCR_ADMISSION_RETRY_AFTER_SEC || 15);\nreturn [{ json: { ...src.json, tenant_id: tenantId, request_id: requestId, admission_payload: { action: 'acquire_slot', tenant_id: tenantId, request_id: requestId, global_limit: Number($env.OCR_ADMISSION_GLOBAL_LIMIT || 8), tenant_limit: Number($env.OCR_ADMISSION_TENANT_LIMIT || 4), ttl_sec: Number($env.OCR_ADMISSION_LEASE_TTL_SEC || 180), retry_after_sec: retryAfter } }, binary: src.binary }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1712, -2800],
    id: newId(),
    name: 'Code (Build Admission Acquire Payload)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'admission-configured',
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
    position: [1952, -2800],
    id: newId(),
    name: 'If (Feedback API Configured - Admission Acquire)'
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
      jsonBody: '={{ $json.admission_payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [2192, -2864],
    id: newId(),
    name: 'HTTP Acquire Admission Slot',
    continueOnFail: true
  });

  ensureNode(nodes, {
    parameters: {
      jsCode: "const src = $('Code (Build Admission Acquire Payload)').first();\nconst resp = $json || {};\nconst data = (resp && typeof resp === 'object' && resp.data && typeof resp.data === 'object') ? resp.data : {};\nconst fallbackRetry = Number($env.OCR_ADMISSION_RETRY_AFTER_SEC || 15);\nlet allowed = false;\nlet response_code = 503;\nlet error_code = 'SYSTEM_BUSY';\nlet message = 'OCR queue is busy. Please retry.';\nlet retry_after_sec = Number(data.retry_after_sec || fallbackRetry);\nlet slotToken = '';\n\nif (Object.keys(data).length === 0) {\n  response_code = 503;\n  error_code = 'ADMISSION_SERVICE_UNAVAILABLE';\n  message = 'Admission service unavailable';\n} else if (data.allowed === true) {\n  allowed = true;\n  response_code = 200;\n  error_code = '';\n  message = 'OK';\n  slotToken = String(data.slot_token || '');\n} else {\n  response_code = Number(data.code || 429);\n  error_code = String(data.reason || 'SYSTEM_BUSY');\n  message = 'OCR queue is busy. Please retry.';\n}\n\nreturn [{ json: { ...src.json, allowed, response_code, error_code, message, retry_after_sec, admission_slot_token: slotToken } }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2432, -2864],
    id: newId(),
    name: 'Code (Parse Admission Result)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'admission-allowed',
            leftValue: '={{ $json.allowed }}',
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
    position: [2672, -2864],
    id: newId(),
    name: 'If (Admission Allowed)'
  });

  ensureNode(nodes, {
    parameters: {
      respondWith: 'json',
      responseBody: "={{ ({ success:false, status:'error', error_code: ($json.error_code || 'SYSTEM_BUSY'), message: ($json.message || 'OCR queue is busy. Please retry.'), request_id: String($json.request_id || $runId || ''), retry_after_sec: Number($json.retry_after_sec || 15), data:{ bills: [] } }) }}",
      options: {
        responseCode: '={{ Number($json.response_code || 429) }}',
        responseHeaders: {
          entries: [
            { name: 'Content-Type', value: 'application/json; charset=utf-8' },
            { name: 'Retry-After', value: '={{ String($json.retry_after_sec || 15) }}' }
          ]
        }
      }
    },
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.5,
    position: [2912, -2784],
    id: newId(),
    name: 'Respond to Webhook (busy)'
  });

  ensureNode(nodes, {
    parameters: {
      jsCode: "const item = $input.first();\nconst j = item.json || {};\nconst fileSizeKb = Math.round((item.binary?.files0?.fileSize || 0) / 1024);\nconst docType = String(j.doc_type || 'unknown').toLowerCase();\nlet lane = 'standard';\nif (fileSizeKb >= 4000 || docType === 'mixed') lane = 'heavy';\nelse if (fileSizeKb <= 700 && ['fuel','parking'].includes(docType)) lane = 'fast';\nconst timeoutByLane = { fast: Number($env.OCR_TIMEOUT_FAST_MS || 45000), standard: Number($env.OCR_TIMEOUT_STANDARD_MS || 65000), heavy: Number($env.OCR_TIMEOUT_HEAVY_MS || 90000) };\nconst retryByLane = { fast: 1, standard: 2, heavy: 2 };\nreturn [{ json: { ...j, ocr_lane: lane, ocr_timeout_ms: Number(timeoutByLane[lane] || 65000), ocr_retry_max: Number(retryByLane[lane] || 2), retry_after_sec: Number(j.retry_after_sec || $env.OCR_ADMISSION_RETRY_AFTER_SEC || 15), admission_slot_token: String(j.admission_slot_token || '') }, binary: item.binary }];"
    },
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [3168, -2720],
    id: newId(),
    name: 'Code (SLA Lane + Timeout Budget)'
  });

  ensureNode(nodes, {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
        conditions: [
          {
            id: 'admission-release-configured',
            leftValue: '={{ !!$env.OCR_FEEDBACK_API_URL && !!$json.admission_release_payload }}',
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
    position: [7936, -2480],
    id: newId(),
    name: 'If (Feedback API Configured - Admission Release)'
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
      jsonBody: '={{ $json.admission_release_payload }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.3,
    position: [8176, -2544],
    id: newId(),
    name: 'HTTP Release Admission Slot',
    continueOnFail: true
  });

  setMainConn(connections, 'If', [
    [{ node: 'Code (Build Admission Acquire Payload)', type: 'main', index: 0 }],
    [{ node: 'Respond to Webhook7', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'Code (Build Admission Acquire Payload)', [
    [{ node: 'If (Feedback API Configured - Admission Acquire)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'If (Feedback API Configured - Admission Acquire)', [
    [{ node: 'HTTP Acquire Admission Slot', type: 'main', index: 0 }],
    [{ node: 'Code (Document Classifier)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'HTTP Acquire Admission Slot', [
    [{ node: 'Code (Parse Admission Result)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'Code (Parse Admission Result)', [
    [{ node: 'If (Admission Allowed)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'If (Admission Allowed)', [
    [{ node: 'Code (Document Classifier)', type: 'main', index: 0 }],
    [{ node: 'Respond to Webhook (busy)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'Code (Document Classifier)', [
    [{ node: 'Code (SLA Lane + Timeout Budget)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'Code (SLA Lane + Timeout Budget)', [
    [{ node: 'HTTP Upload File5', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'Code (Build Telegram Notification OCR)', [
    [{ node: 'If (Feedback API Configured - Admission Release)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'If (Feedback API Configured - Admission Release)', [
    [{ node: 'HTTP Release Admission Slot', type: 'main', index: 0 }],
    [{ node: 'Telegram (OCR Notify)', type: 'main', index: 0 }]
  ]);

  setMainConn(connections, 'HTTP Release Admission Slot', [
    [{ node: 'Telegram (OCR Notify)', type: 'main', index: 0 }]
  ]);
}

function saveWorkflow(wf) {
  const tmpDir = '.tmp';
  fs.mkdirSync(tmpDir, { recursive: true });
  const nodesPath = path.join(tmpDir, `${WORKFLOW_ID}.phase5.nodes.json`);
  const conPath = path.join(tmpDir, `${WORKFLOW_ID}.phase5.connections.json`);
  fs.writeFileSync(nodesPath, JSON.stringify(wf.nodes), 'utf8');
  fs.writeFileSync(conPath, JSON.stringify(wf.connections), 'utf8');

  const sqlPath = path.join(tmpDir, `${WORKFLOW_ID}.phase5.update.sql`);
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
  patchCodeNodes(wf.nodes);
  patchHttpTimeout(wf.nodes);
  addNodes(wf.nodes, wf.connections);
  const changes = saveWorkflow(wf);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    workflow_id: wf.id,
    backup,
    node_count: wf.nodes.length,
    db_changes: changes,
  }, null, 2)}\n`);
}

main();
