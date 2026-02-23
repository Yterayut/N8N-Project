#!/usr/bin/env node
/**
 * patch-p2.js — Apply Phase 2 (Scale & Safety) fixes to test-workflow.sanitized.json
 *
 * Fixes applied:
 *  T007  File size guard in Code in JavaScript22 + Code (Split Files)
 *  T008  Sanitize Gemini error in Respond to Webhook (error)
 *  T009  Few-shot safe truncation at example boundary in Code (Select Few-shot Examples)
 *  T011  Add retry + continueRegularOutput to HTTP GenerateContent (Re-ask)
 *  T013  Remove all ~24 disabled legacy nodes
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../exports/workflows/test-workflow.sanitized.json');
const DST = SRC;

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

// ─── T007: File size guard in MIME sniff node (main path) ─────────────────────
// Code in JavaScript22 processes each binary file; reject if > 20 MB
patchNode('Code in JavaScript22', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('MAX_FILE_BYTES')) return false; // already patched

  const anchor = "for (const item of items) {";
  if (!code.includes(anchor)) { console.error('[FAIL] T007 MIME — anchor not found'); return false; }

  const guard = `const MAX_FILE_BYTES = Number(typeof $env !== 'undefined' && $env.OCR_MAX_FILE_BYTES || 20 * 1024 * 1024);\n\n`;
  const sizeCheck = `  // T007: File size guard\n  const fileSize = f?.fileSize || 0;\n  if (fileSize > MAX_FILE_BYTES) {\n    throw new Error(\`File too large: \${Math.round(fileSize / 1024 / 1024)}MB exceeds max \${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB\`);\n  }\n\n`;
  const sniffAnchor = "  const ext = String(f.fileExtension || '').toLowerCase() || extFromName(f.fileName);";

  let patched = code.replace(anchor, guard + anchor);
  patched = patched.replace(sniffAnchor, sizeCheck + sniffAnchor);
  if (patched === code) { console.error('[FAIL] T007 MIME — replacement failed'); return false; }
  node.parameters.jsCode = patched;
  return true;
});

// ─── T007: File size guard in queue split node ────────────────────────────────
patchNode('Code (Split Files)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('fileSize >')) return false;

  // Add per-file size check inside the for loop, after const fileId line
  const anchor = "const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;";
  if (!code.includes(anchor)) { console.error('[FAIL] T007 Split — anchor not found'); return false; }

  const sizeCheck = `  const maxBytes = 20 * 1024 * 1024;\n  if ((fileData.fileSize || 0) > maxBytes) throw new Error(\`File \${fileData.fileName || key} too large: max 20MB\`);\n  `;
  node.parameters.jsCode = code.replace(anchor, sizeCheck + anchor);
  return true;
});

// ─── T008: Sanitize Gemini error before returning to client ───────────────────
patchNode('Respond to Webhook (error)', (node) => {
  const body = node.parameters.responseBody;
  if (!body || !body.includes('$json.error?.message')) return false;

  // Replace raw error message with generic safe message; never expose Gemini internals
  node.parameters.responseBody = body.replace(
    '($json.error?.message || "Failed to process the document. Please try again.")',
    '"Failed to process the document. Please try again."'
  );
  return true;
});

// ─── T009: Few-shot safe truncation at example boundary ───────────────────────
patchNode('Code (Select Few-shot Examples)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('Cut at example boundary')) return false;

  const oldTrunc = `if (fewShotText.length > 6000) {\n  fewShotText = fewShotText.slice(0, 6000);\n}`;
  if (!code.includes(oldTrunc)) {
    // Try with single-line style
    const alt = "if (fewShotText.length > 6000) {\n  fewShotText = fewShotText.slice(0, 6000);\n}";
    if (!code.includes(alt)) { console.error('[FAIL] T009 — truncation anchor not found'); return false; }
  }

  const newTrunc = `if (fewShotText.length > 6000) {\n  // T009: Cut at example boundary — never mid-JSON\n  let safe = '';\n  for (const part of parts) {\n    const candidate = safe ? safe + '\\\\n\\\\n' + part : part;\n    if (candidate.length <= 6000) { safe = candidate; } else { break; }\n  }\n  fewShotText = safe || parts[0] ? parts[0].slice(0, 6000) : '';\n}`;

  node.parameters.jsCode = code.replace(oldTrunc, newTrunc);
  return true;
});

// ─── T011: Add retry + continueRegularOutput to HTTP GenerateContent (Re-ask) ─
patchNode('HTTP GenerateContent (Re-ask)', (node) => {
  let changed = false;

  if (!node.retryOnFail) {
    node.retryOnFail = true;
    node.maxTries = 2;
    node.waitBetweenTries = 5000;
    changed = true;
  }

  if (node.onError !== 'continueRegularOutput') {
    node.onError = 'continueRegularOutput';
    changed = true;
  }

  return changed;
});

// ─── T013: Remove all disabled legacy nodes ────────────────────────────────────
const before = nodes.length;
const disabledIds = nodes.filter(n => n.disabled === true).map(n => n.id);
wf.workflow.nodes = nodes.filter(n => n.disabled !== true);
const removed = before - wf.workflow.nodes.length;

if (removed > 0) {
  // Also remove connections to/from disabled nodes
  const connections = wf.workflow.connections || {};
  for (const srcName of Object.keys(connections)) {
    const srcNode = wf.workflow.nodes.find(n => n.name === srcName);
    if (!srcNode) {
      delete connections[srcName];
      continue;
    }
    // Filter each output port
    const outputs = connections[srcName];
    for (const portKey of Object.keys(outputs)) {
      outputs[portKey] = outputs[portKey].map(portArr =>
        portArr.filter(conn => {
          const target = wf.workflow.nodes.find(n => n.name === conn.node);
          return !!target;
        })
      );
    }
  }
  console.log(`[OK] Removed ${removed} disabled nodes (T013)`);
  patchCount += removed;
} else {
  console.log('[SKIP] No disabled nodes found (T013)');
}

// ─── Write output ──────────────────────────────────────────────────────────────
if (patchCount > 0) {
  wf.exported_at = new Date().toISOString();
  wf.patch_notes = (wf.patch_notes || []).concat([
    `${new Date().toISOString()}: Phase 2 patches applied (T007/T008/T009/T011/T013, ${patchCount} changes)`
  ]);
  fs.writeFileSync(DST, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`\n✅ Done — ${patchCount} changes. Written to: ${DST}`);
} else {
  console.log('\n✅ Nothing to patch — all Phase 2 fixes already applied.');
}
