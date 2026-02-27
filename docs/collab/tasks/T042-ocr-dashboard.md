# T042 — OCR Accuracy Dashboard (HTML Web Page)

**Executor:** Codex
**Reviewer:** CC
**Status:** Ready for implementation

---

## Objective

Create a new n8n workflow `ocr-dashboard` that returns a live HTML dashboard when accessed via browser. Aggregates 4 data sources into a single-page report.

**URL:** `GET http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!`

---

## Workflow Specification

**Workflow name:** `ocr-dashboard`
**Active:** true

### Node 1: Webhook

```json
{
  "id": "dash-wh-001",
  "name": "Webhook (ocr-dashboard)",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2.1,
  "position": [0, 0],
  "parameters": {
    "httpMethod": "GET",
    "path": "ocr-dashboard",
    "responseMode": "responseNode",
    "options": {}
  },
  "webhookId": "ocr-dashboard-v1-0001"
}
```

### Node 2: Code (Auth)

```json
{
  "id": "dash-auth-001",
  "name": "Code (Auth)",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [280, 0],
  "parameters": {
    "jsCode": "const src = $input.first().json || {};\nconst q = src.query || {};\nconst h = src.headers || {};\nconst key = String(q.key || h['x-api-key'] || h['X-Api-Key'] || '');\nconst expected = String($env.OCR_SHARED_API_KEY || '');\nif (!expected || key !== expected) {\n  return [{ json: { _html: '<!DOCTYPE html><html><body><h1>401 Unauthorized</h1><p>Provide ?key= or x-api-key header</p></body></html>', _status: 401 } }];\n}\nreturn [{ json: { ok: true } }];"
  }
}
```

### Node 3: Code (Fetch + Build HTML)

Full code below — implement exactly as specified:

```javascript
// === T042: OCR Dashboard — Fetch + HTML ===
// Data sources: OCR_FEEDBACK, FIELD_DIFFS, OCR_KM_RUNTIME_RULES via gg-data-gateway
//              execution_entity via sqlite3 CLI

const KEY = String($env.OCR_SHARED_API_KEY || '');
const BASE = 'http://localhost:5678';
const DB = '/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite';
const WF_ID = 'up1n75qEhbsXswii';

// --- 1. Fetch Google Sheets data ---
const fetchSheet = async (sheet) => {
  try {
    const r = await fetch(`${BASE}/webhook/gg-data?sheet=${sheet}`, {
      headers: { 'x-api-key': KEY }
    });
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
};

const [feedback, diffs, rulesRaw] = await Promise.all([
  fetchSheet('OCR_FEEDBACK'),
  fetchSheet('FIELD_DIFFS'),
  fetchSheet('OCR_KM_RUNTIME_RULES'),
]);

// --- 2. SQLite: execution volumes ---
const { execSync } = require('child_process');
const sqlExec = (sql) => {
  try {
    return execSync(`sqlite3 -separator '\t' "${DB}" "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8', timeout: 5000
    }).trim();
  } catch (e) { return ''; }
};

// 7-day trend: date(BKK) | status | count
const trendRaw = sqlExec(
  `SELECT date(startedAt,'+7 hours') as d, status, COUNT(*) as cnt FROM execution_entity WHERE workflowId='${WF_ID}' AND startedAt > datetime('now','-7 days') GROUP BY d, status ORDER BY d DESC`
);

// Today (BKK)
const todayRaw = sqlExec(
  `SELECT status, COUNT(*) as cnt FROM execution_entity WHERE workflowId='${WF_ID}' AND date(startedAt,'+7 hours') = date('now','+7 hours') GROUP BY status`
);

// --- 3. Compute stats ---

// 3a. Accuracy by doc_type (from OCR_FEEDBACK)
// Columns: doc_type, accuracy_score (numeric 0-100), matched_fields, total_fields
const accByType = {};
let overallScores = [];
for (const row of feedback) {
  const score = parseFloat(row.accuracy_score);
  if (isNaN(score)) continue;
  const t = String(row.doc_type || 'unknown').toLowerCase().trim();
  if (!accByType[t]) accByType[t] = [];
  accByType[t].push(score);
  overallScores.push(score);
}
const avg = (arr) => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '-';
const overallAcc = avg(overallScores);

// 3b. Field-level errors (from FIELD_DIFFS)
// Columns: field_name, diff_type (wrong_value/missing/format_error/extra), severity
const fieldErrors = {};
for (const row of diffs) {
  const f = String(row.field_name || '').trim();
  if (!f) continue;
  if (!fieldErrors[f]) fieldErrors[f] = { count: 0, types: {} };
  fieldErrors[f].count++;
  const dt = String(row.diff_type || 'unknown');
  fieldErrors[f].types[dt] = (fieldErrors[f].types[dt] || 0) + 1;
}
const sortedFields = Object.entries(fieldErrors)
  .sort((a,b) => b[1].count - a[1].count);

// 3c. Active KM rules
const activeRules = (rulesRaw || []).filter(r => {
  if (String(r.status) === 'inactive') return false;
  return r.rule_value === 'TRUE' || r.rule_value === 'Y' || r.source_lesson_id === 'active';
}).sort((a,b) => (parseInt(b.rule_key)||0) - (parseInt(a.rule_key)||0));

// 3d. Parse SQLite trend output
// Lines: "2026-02-27\tsuccess\t12"
const trendByDay = {};
for (const line of (trendRaw || '').split('\n').filter(Boolean)) {
  const parts = line.split('\t');
  if (parts.length < 3) continue;
  const [day, status, cnt] = parts;
  if (!trendByDay[day]) trendByDay[day] = { success: 0, error: 0, other: 0 };
  if (status === 'success') trendByDay[day].success += parseInt(cnt) || 0;
  else if (status === 'error') trendByDay[day].error += parseInt(cnt) || 0;
  else trendByDay[day].other += parseInt(cnt) || 0;
}
const trendDays = Object.entries(trendByDay).sort((a,b) => b[0] > a[0] ? 1 : -1);

// Today counts
const todayStats = { success: 0, error: 0 };
for (const line of (todayRaw || '').split('\n').filter(Boolean)) {
  const [status, cnt] = line.split('\t');
  if (status === 'success') todayStats.success = parseInt(cnt) || 0;
  else if (status === 'error') todayStats.error = parseInt(cnt) || 0;
}
const todayTotal = todayStats.success + todayStats.error;

// --- 4. Build HTML ---
const nowBKK = new Date(Date.now() + 7 * 3600000).toISOString().replace('T', ' ').slice(0, 16) + ' BKK';

const colorAcc = (pct) => {
  const n = parseFloat(pct);
  if (isNaN(n)) return '#888';
  if (n >= 95) return '#2d7a2d';
  if (n >= 80) return '#b8860b';
  return '#c0392b';
};

const barHtml = (pct) => {
  const n = Math.min(100, Math.max(0, parseFloat(pct) || 0));
  const c = colorAcc(pct);
  return `<div style="background:#eee;border-radius:3px;width:120px;display:inline-block;">` +
    `<div style="width:${n}%;background:${c};height:12px;border-radius:3px;"></div></div> ` +
    `<span style="color:${c};font-weight:bold;">${pct}%</span>`;
};

const accRows = Object.entries(accByType)
  .sort((a,b) => b[1].length - a[1].length)
  .map(([type, scores]) => {
    const a = avg(scores);
    return `<tr>
      <td><b>${type}</b></td>
      <td style="text-align:center;">${scores.length}</td>
      <td>${barHtml(a)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="3" style="color:#888;">ยังไม่มี feedback</td></tr>';

const fieldRows = sortedFields
  .map(([field, info]) => {
    const topType = Object.entries(info.types).sort((a,b)=>b[1]-a[1])[0]?.[0] || '-';
    return `<tr>
      <td><b>${field}</b></td>
      <td style="text-align:center;">${info.count}</td>
      <td style="color:#888;">${topType}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="3" style="color:#888;">ยังไม่มี error records</td></tr>';

const trendRows = trendDays.map(([day, s]) => {
  const total = s.success + s.error + s.other;
  return `<tr>
    <td>${day}</td>
    <td style="color:#2d7a2d;">${s.success}</td>
    <td style="color:#c0392b;">${s.error}</td>
    <td><b>${total}</b></td>
  </tr>`;
}).join('') || '<tr><td colspan="4" style="color:#888;">ไม่มีข้อมูล</td></tr>';

const ruleRows = activeRules.map(r => {
  const rtype = String(r.updated_at || '-');
  const rdoc = String(r.doc_type || r.priority || '-');
  const rid = String(r.rule_id || '-').slice(0, 35);
  return `<tr>
    <td style="font-size:11px;">${rid}</td>
    <td style="font-size:11px;color:#555;">${rtype}</td>
    <td style="text-align:center;">${r.rule_key || '-'}</td>
    <td style="font-size:11px;">${rdoc}</td>
  </tr>`;
}).join('') || '<tr><td colspan="4" style="color:#888;">ไม่มี active rules</td></tr>';

const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OCR Dashboard</title>
<style>
  body { font-family: 'Segoe UI',sans-serif; background:#f4f6f8; margin:0; padding:16px; color:#333; }
  h1 { margin:0 0 4px; font-size:22px; }
  .subtitle { color:#666; font-size:13px; margin-bottom:16px; }
  .summary { display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
  .card { background:#fff; border-radius:8px; padding:16px 20px; flex:1; min-width:160px;
          box-shadow:0 1px 3px rgba(0,0,0,.12); }
  .card-val { font-size:28px; font-weight:bold; }
  .card-label { font-size:12px; color:#888; margin-top:4px; }
  .section { background:#fff; border-radius:8px; padding:16px; margin-bottom:16px;
             box-shadow:0 1px 3px rgba(0,0,0,.12); }
  h2 { margin:0 0 12px; font-size:15px; color:#444; border-bottom:2px solid #e8e8e8; padding-bottom:6px; }
  table { border-collapse:collapse; width:100%; }
  th { background:#f0f0f0; padding:8px 10px; text-align:left; font-size:13px; color:#555; }
  td { padding:7px 10px; font-size:13px; border-bottom:1px solid #f0f0f0; }
  tr:last-child td { border-bottom:none; }
  .refresh { font-size:12px; color:#0066cc; text-decoration:none; margin-left:8px; }
  .refresh:hover { text-decoration:underline; }
</style>
</head>
<body>
<h1>🔍 OCR Accuracy Dashboard <a href="?" class="refresh">↻ Refresh</a></h1>
<div class="subtitle">อัปเดต: ${nowBKK} · workflow: ocr-invoice-processor</div>

<div class="summary">
  <div class="card">
    <div class="card-val" style="color:#2d7a2d;">${todayTotal}</div>
    <div class="card-label">OCR วันนี้ (✓${todayStats.success} ✗${todayStats.error})</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:${colorAcc(overallAcc)};">${overallAcc}%</div>
    <div class="card-label">Overall Accuracy (n=${overallScores.length} feedback)</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:#c0392b;">${sortedFields.reduce((s,[,v])=>s+v.count,0)}</div>
    <div class="card-label">Field Errors (FIELD_DIFFS)</div>
  </div>
  <div class="card">
    <div class="card-val" style="color:#2d7a2d;">${activeRules.length}</div>
    <div class="card-label">Active KM Rules</div>
  </div>
</div>

<div class="section">
  <h2>📊 Accuracy by Doc Type</h2>
  <table>
    <thead><tr><th>Doc Type</th><th>Count</th><th>Avg Accuracy</th></tr></thead>
    <tbody>${accRows}</tbody>
  </table>
</div>

<div class="section">
  <h2>⚠️ Field Error Frequency (FIELD_DIFFS)</h2>
  <table>
    <thead><tr><th>Field</th><th>Errors</th><th>Top Diff Type</th></tr></thead>
    <tbody>${fieldRows}</tbody>
  </table>
</div>

<div class="section">
  <h2>📈 7-Day OCR Volume (ocr-invoice-processor)</h2>
  <table>
    <thead><tr><th>Date</th><th>Success</th><th>Error</th><th>Total</th></tr></thead>
    <tbody>${trendRows}</tbody>
  </table>
</div>

<div class="section">
  <h2>⚙️ Active KM Rules (${activeRules.length})</h2>
  <p style="font-size:12px;color:#888;margin:0 0 8px;">Triggered per-request — ดู <code>validation_trace</code> ใน OCR response สำหรับรายละเอียด</p>
  <table>
    <thead><tr><th>Rule ID</th><th>Type</th><th>Priority</th><th>Doc Type</th></tr></thead>
    <tbody>${ruleRows}</tbody>
  </table>
</div>

</body>
</html>`;

return [{ json: { _html: html, _status: 200 } }];
```

### Node 4: Respond to Webhook

```json
{
  "id": "dash-resp-001",
  "name": "Respond (HTML)",
  "type": "n8n-nodes-base.respondToWebhook",
  "typeVersion": 1.5,
  "position": [840, 0],
  "parameters": {
    "respondWith": "text",
    "responseBody": "={{ $json._html }}",
    "options": {
      "responseCode": "={{ $json._status || 200 }}",
      "responseHeaders": {
        "entries": [
          {"name": "Content-Type", "value": "text/html; charset=utf-8"},
          {"name": "Cache-Control", "value": "no-cache"}
        ]
      }
    }
  },
  "onError": "continueRegularOutput"
}
```

### Connections

```
Webhook (ocr-dashboard) → Code (Auth) → Code (Fetch + Build HTML) → Respond (HTML)
```

---

## Implementation Steps for Codex

1. **Login to n8n** (if cookie expired):
   ```bash
   source /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.env
   curl -s -c /tmp/cookie_t042.txt -X POST http://localhost:5678/rest/login \
     -H "Content-Type: application/json" \
     -d "{\"emailOrLdapLoginId\":\"yterayut@gmail.com\",\"password\":\"${N8N_BASIC_AUTH_PASSWORD}\"}"
   ```

2. **Create workflow via REST API** using the spec above (POST /rest/workflows with active:false first)

3. **Activate** (PATCH /rest/workflows/{id} with active:true)

4. **Test** (wait 2s for webhook to register):
   ```bash
   curl -s "http://localhost:5678/webhook/ocr-dashboard?key=ocm-cabonrecipte!" -o /tmp/t042_dash.html
   echo "HTTP size: $(wc -c < /tmp/t042_dash.html) bytes"
   grep -c "<table>" /tmp/t042_dash.html   # should be >= 4
   grep -o "Accuracy by Doc Type\|Field Error\|7-Day OCR\|Active KM" /tmp/t042_dash.html | wc -l  # should be 4
   ```

5. **Auth test**:
   ```bash
   curl -s "http://localhost:5678/webhook/ocr-dashboard?key=wrongkey" | grep "401"
   ```

6. **Note the new workflow ID** in your response.

---

## DoD (Definition of Done)

### T1 — Auth reject
- [ ] `curl .../ocr-dashboard?key=wrongkey` → 401 HTML response

### T2 — HTML 200
- [ ] `curl .../ocr-dashboard?key=ocm-cabonrecipte!` → 200, Content-Type: text/html
- [ ] Size > 2000 bytes

### T3 — All 4 sections present
- [ ] `grep -c "<table>" /tmp/t042_dash.html` ≥ 4
- [ ] "Accuracy by Doc Type" text present
- [ ] "Field Error Frequency" text present
- [ ] "7-Day OCR Volume" text present
- [ ] "Active KM Rules" text present

### T4 — Data loaded
- [ ] Summary cards show non-zero values (or graceful empty state)
- [ ] KM Rules table shows 6 rules (or current active count)

### T5 — Verify
- [ ] `./scripts/verify_nowThai_sync.sh` ✅ (sanity check)

---

## Discussion

*(Codex: comment here before implementing if you see any issues with the spec)*

---

## Codex Response

*(Codex: fill after CC review)*
