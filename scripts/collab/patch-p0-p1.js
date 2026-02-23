#!/usr/bin/env node
/**
 * patch-p0-p1.js — Apply P0/P1 fixes to test-workflow.sanitized.json
 *
 * Fixes applied:
 *  P0-1  round3 undefined → add function definition
 *  P1-3  allHeaders never set → add assignment in Code in JavaScript5
 *  P1-4  MIME sniff full decode → slice b64 to 16 chars
 *  P1-5  No file count limit → add guard in Code (Split Files)
 *  P1-7  Queue error writes 'done' → write status dynamically
 *  P1-8  Trailing \n in Gemini URL → strip whitespace from URLs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../exports/workflows/test-workflow.sanitized.json');
const DST = SRC; // patch in place

const raw = fs.readFileSync(SRC, 'utf8');
const wf = JSON.parse(raw);
const nodes = wf.workflow.nodes;

let patchCount = 0;

function patchNode(name, fn) {
  const node = nodes.find(n => n.name === name);
  if (!node) { console.error(`[SKIP] Node not found: ${name}`); return; }
  const changed = fn(node);
  if (changed) { console.log(`[OK] Patched: ${name}`); patchCount++; }
  else { console.log(`[SKIP] No change needed: ${name}`); }
}

// ─── P0-1: round3 undefined ───────────────────────────────────────────────────
patchNode('Code (Normalize + Validate)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('function round3(')) return false; // already fixed
  const patched = code.replace(
    'function round2(n){ return Math.round((Number(n)||0)*100)/100; }',
    'function round2(n){ return Math.round((Number(n)||0)*100)/100; }\nfunction round3(n){ return Math.round((Number(n)||0)*1000)/1000; }'
  );
  if (patched === code) { console.error('[FAIL] round3 patch — anchor not found'); return false; }
  node.parameters.jsCode = patched;
  return true;
});

// ─── P1-3: allHeaders never set in Code in JavaScript5 ───────────────────────
patchNode('Code in JavaScript5', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('item.json.allHeaders')) return false;
  // Add after the apiKey line
  const anchor = "item.json.apiKey = headers['x-api-key'] || '';";
  if (!code.includes(anchor)) { console.error('[FAIL] allHeaders patch — anchor not found'); return false; }
  node.parameters.jsCode = code.replace(
    anchor,
    anchor + "\n  item.json.allHeaders = headers;"
  );
  return true;
});

// ─── P1-4: MIME sniff full base64 decode ─────────────────────────────────────
patchNode('Code in JavaScript22', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('b64.slice(0, 16)')) return false;
  const anchor = 'Buffer.from(b64, \'base64\')';
  if (!code.includes(anchor)) { console.error('[FAIL] MIME sniff patch — anchor not found'); return false; }
  node.parameters.jsCode = code.replace(
    /Buffer\.from\(b64,\s*'base64'\)/,
    "Buffer.from(b64.slice(0, 16), 'base64')"
  );
  return true;
});

// ─── P1-5: No file count limit in Code (Split Files) ─────────────────────────
patchNode('Code (Split Files)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('Too many files')) return false;
  const anchor = 'const results = [];';
  if (!code.includes(anchor)) { console.error('[FAIL] file count limit patch — anchor not found'); return false; }
  node.parameters.jsCode = code.replace(
    anchor,
    'if (Object.keys(files).length > 20) throw new Error("Too many files: max 20 per request");\n  const results = [];'
  );
  return true;
});

// ─── P1-7: Queue error writes 'done' instead of dynamic status ───────────────
// Fix Google Sheets (Set Done) to write status from $json.status not hardcoded 'done'
patchNode('Google Sheets (Set Done)', (node) => {
  const cols = node.parameters?.columns?.values;
  if (!cols) { console.error('[FAIL] queue status patch — no columns.values'); return false; }
  const statusCol = cols.find(c => c.fieldId === 'status' || c.column === 'status');
  if (!statusCol) { console.error('[FAIL] queue status patch — status column not found'); return false; }
  const val = statusCol.fieldValue ?? statusCol.value ?? '';
  if (String(val).includes('json.status') || String(val).includes('$json')) return false;
  // Replace hardcoded 'done' with dynamic value: done on success, error on failure
  statusCol.fieldValue = "={{ $json.status === 'success' ? 'done' : 'error' }}";
  // Also set processed_at timestamp dynamically
  const processedCol = cols.find(c => c.fieldId === 'processed_at' || c.column === 'processed_at');
  if (processedCol) {
    processedCol.fieldValue = "={{ $now.toFormat('dd/MM/yyyy HH:mm:ss') }}";
  }
  return true;
});

// ─── P1-8: Trailing \n in Gemini URL ─────────────────────────────────────────
['HTTP GenerateContent3', 'HTTP Request1'].forEach(name => {
  patchNode(name, (node) => {
    const url = node.parameters?.url;
    if (!url) return false;
    const trimmed = url.replace(/\s+$/, '');
    if (trimmed === url) return false;
    node.parameters.url = trimmed;
    return true;
  });
});

// ─── Write output ─────────────────────────────────────────────────────────────
if (patchCount > 0) {
  wf.exported_at = new Date().toISOString();
  wf.patch_notes = (wf.patch_notes || []).concat([
    `${new Date().toISOString()}: P0/P1 patches applied (${patchCount} nodes)`
  ]);
  fs.writeFileSync(DST, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`\n✅ Done — ${patchCount} nodes patched. Written to: ${DST}`);
} else {
  console.log('\n✅ Nothing to patch — all fixes already applied.');
}
