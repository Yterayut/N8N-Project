#!/usr/bin/env node
/**
 * patch-p3.js — Apply Phase 3 (Cleanup & Maintainability) fixes
 *
 * T015  Config externalization:
 *         - Code in JavaScript23  → OCR_QUEUE_BATCH_SIZE (was hardcoded 10)
 *         - Code (SLA Lane)       → OCR_SLA_HEAVY_KB / OCR_SLA_FAST_KB (was 4000/700)
 *         - Code (Build Telegram) → $workflow.name / $workflow.id (was 'test-workflow')
 * T016  Code Set Done: fix file_id reference (use input item, not .all()[0])
 * T017  Re-ask confidence floor: conditional + env-configurable (OCR_REASK_CONF_BOOST)
 * T018  Electricity ref regex: widen from /^\d{12}$/ to /^\d{10,15}$/
 * T019  MIME: add TIFF (little/big-endian) + HEIC detection
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../exports/workflows/test-workflow.sanitized.json');
const wf = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const nodes = wf.workflow.nodes;

let patchCount = 0;

function patchNode(name, fn) {
  const node = nodes.find(n => n.name === name);
  if (!node) { console.error(`[SKIP] Node not found: ${name}`); return; }
  const changed = fn(node);
  if (changed) { console.log(`[OK] Patched: ${name}`); patchCount++; }
  else { console.log(`[SKIP] No change needed: ${name}`); }
}

// ─── T015-A: Queue batch size → env var ───────────────────────────────────────
patchNode('Code in JavaScript23', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('OCR_QUEUE_BATCH_SIZE')) return false;
  // Replace: items.slice(0, 10)  →  items.slice(0, batchSize)
  if (!code.includes('items.slice(0, 10)')) {
    console.error('[FAIL] T015-A — anchor not found'); return false;
  }
  node.parameters.jsCode =
    '// T015: batch size configurable via OCR_QUEUE_BATCH_SIZE (default 10)\n' +
    'const batchSize = Number($env.OCR_QUEUE_BATCH_SIZE || 10);\n' +
    'const items = $input.all();\n' +
    'return items.slice(0, batchSize);';
  return true;
});

// ─── T015-B: SLA thresholds → env vars ────────────────────────────────────────
patchNode('Code (SLA Lane + Timeout Budget)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('OCR_SLA_HEAVY_KB')) return false;
  // Replace hardcoded 4000 and 700
  let patched = code.replace(
    'fileSizeKb >= 4000',
    'fileSizeKb >= Number($env.OCR_SLA_HEAVY_KB || 4000)'
  );
  patched = patched.replace(
    'fileSizeKb <= 700',
    'fileSizeKb <= Number($env.OCR_SLA_FAST_KB || 700)'
  );
  if (patched === code) { console.error('[FAIL] T015-B — SLA anchors not found'); return false; }
  node.parameters.jsCode = patched;
  return true;
});

// ─── T015-C: Telegram hardcoded workflow name/id → dynamic ───────────────────
patchNode('Code (Build Telegram Notification OCR)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('$workflow.name')) return false;
  // Replace hardcoded strings
  let patched = code.replace(
    "const workflowName = 'test-workflow';",
    "const workflowName = (typeof $workflow !== 'undefined' && $workflow.name) ? $workflow.name : ($env.WORKFLOW_NAME || 'ocr-invoice-processor');"
  );
  patched = patched.replace(
    "const workflowId = 'up1n75qEhbsXswii';",
    "const workflowId = (typeof $workflow !== 'undefined' && $workflow.id) ? $workflow.id : ($env.WORKFLOW_ID || '');"
  );
  if (patched === code) { console.error('[FAIL] T015-C — Telegram anchors not found'); return false; }
  node.parameters.jsCode = patched;
  return true;
});

// ─── T016: Code Set Done — fix file_id reference ─────────────────────────────
patchNode('Code  Set Done', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('T016')) return false;

  // Use input item's file_id first (correct in loop context), then fallback to sheets
  const newCode = `// T016: use current input item for file_id (safe in loop context)
const parseResult = $input.item.json;

let file_id = parseResult.file_id || '';

// Fallback: try Set Processing node (use .first() — loop-safe when single item)
if (!file_id) {
  try { file_id = $('Google Sheets (Set Processing)').first().json.file_id || ''; } catch(_) {}
}

// Fallback 2: Get Pending
if (!file_id) {
  try { file_id = $('Google Sheets (Get Pending)').first().json.file_id || ''; } catch(_) {}
}

return {
  json: {
    ...parseResult,
    file_id
  }
};`;

  if (code.includes(newCode.slice(0, 40))) return false; // idempotency check
  node.parameters.jsCode = newCode;
  return true;
});

// ─── T017: Re-ask confidence floor — conditional + env-configurable ───────────
patchNode('Code (Apply Re-ask Result)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('OCR_REASK_CONF_BOOST')) return false;

  // Build the improved version: validate before accepting, configurable boost
  const newCode = `const carry=$('Code (Build Re-ask Request)').first().json.carry||{};
const j=$json||{};
const out={...carry};
const text=j?.candidates?.[0]?.content?.parts?.[0]?.text||'';
try{
  const obj=JSON.parse(String(text).trim());
  if(obj && Array.isArray(obj.bills) && obj.bills.length > 0){
    // T017: validate re-ask result fields before boosting confidence
    const validBills = obj.bills.filter(b => b && typeof b === 'object');
    const criticalErrs = validBills.reduce((acc, b) => {
      const date = String(b.invoice_date_th || '');
      const inv  = String(b.invoice_number || '');
      const tot  = Number(String(b.total || 0).replace(/,/g,''));
      let errs = 0;
      if (!date || !/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(date)) errs++;
      if (!inv) errs++;
      if (isNaN(tot) || tot < 0) errs++;
      return acc + errs;
    }, 0);
    out.raw_json=JSON.stringify(obj);
    out.raw_text_pretty=JSON.stringify(obj,null,2);
    out.bills_count=validBills.length;
    out.status='success';
    out.used_reask=true;
    out.needs_reask=false;
    out.critical_error_count=criticalErrs;
    if(criticalErrs===0){
      // T017: only boost if re-ask resolved errors; boost value configurable
      const boostFloor = Number((typeof $env!=='undefined' && $env.OCR_REASK_CONF_BOOST) || 0);
      out.confidence = boostFloor > 0 ? Math.max(Number(out.confidence||0), boostFloor) : Number(out.confidence||0);
      out.validation_errors = (out.validation_errors||[]).filter(e=>e.severity!=='critical');
    } else {
      // re-ask didn't fix critical errors — cap confidence, don't loop
      out.confidence = Math.min(Number(out.confidence||0), 0.80);
      out.needs_reask = false;
    }
  }
}catch(e){ out.reask_error=String(e?.message||'reask_parse_failed'); out.used_reask=false; }
return [{json:out}];`;

  node.parameters.jsCode = newCode;
  return true;
});

// ─── T018: Electricity ref regex — widen for multi-provider ──────────────────
patchNode('Code (Normalize + Validate)', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('OCR_ELEC_REF_PATTERN') || code.includes('\\d{10,15}')) return false;

  // Current: /^\d{12}$/ → flexible: 10-15 digits, or pattern from env
  const anchor = "if(ref && !/^\\d{12}$/.test(ref)) errs.push({field:'electricity_ref',severity:'critical',code:'invalid_electricity_ref'});";
  if (!code.includes(anchor)) {
    console.error('[FAIL] T018 — electricity_ref anchor not found'); return false;
  }
  const replacement =
    "// T018: flex pattern — 10-15 digits by default, override via OCR_ELEC_REF_PATTERN\n" +
    "const _elecPattern = (typeof $env!=='undefined' && $env.OCR_ELEC_REF_PATTERN) ? new RegExp($env.OCR_ELEC_REF_PATTERN) : /^\\d{10,15}$/;\n" +
    "if(ref && !_elecPattern.test(ref)) errs.push({field:'electricity_ref',severity:'warning',code:'invalid_electricity_ref'});";
  node.parameters.jsCode = code.replace(anchor, replacement);
  return true;
});

// ─── T019: MIME — add TIFF + HEIC detection ───────────────────────────────────
patchNode('Code in JavaScript22', (node) => {
  const code = node.parameters.jsCode;
  if (code.includes('image/tiff')) return false;

  // Add TIFF + HEIC after PNG detection inside sniffMimeFromBase64()
  const pngEnd = `    return 'image/png';
  }

  return '';
}`;
  if (!code.includes(pngEnd)) { console.error('[FAIL] T019 — PNG end anchor not found'); return false; }

  const tiffHeic = `    return 'image/png';
  }

  // T019: TIFF little-endian (49 49 2A 00) or big-endian (4D 4D 00 2A)
  if (
    buf.length >= 4 &&
    ((buf[0]===0x49&&buf[1]===0x49&&buf[2]===0x2A&&buf[3]===0x00) ||
     (buf[0]===0x4D&&buf[1]===0x4D&&buf[2]===0x00&&buf[3]===0x2A))
  ) {
    return 'image/tiff';
  }

  return '';
}`;

  // Also add extension detection for heic/heif before the MIME sniff block
  const extPdfAnchor = `  if (ext === 'pdf') {
    f.mimeType = 'application/pdf';
    continue;
  }`;
  if (!code.includes(extPdfAnchor)) { console.error('[FAIL] T019 — ext anchor not found'); return false; }

  let patched = code.replace(pngEnd, tiffHeic);
  patched = patched.replace(extPdfAnchor,
    `// T019: HEIC/HEIF extension detection (before binary sniff)
  if (ext === 'heic' || ext === 'heif') {
    f.mimeType = 'image/heic';
    continue;
  }
  if (ext === 'tif' || ext === 'tiff') {
    f.mimeType = 'image/tiff';
    continue;
  }

  ${extPdfAnchor}`);
  node.parameters.jsCode = patched;
  return true;
});

// ─── Write output ──────────────────────────────────────────────────────────────
if (patchCount > 0) {
  wf.exported_at = new Date().toISOString();
  wf.patch_notes = (wf.patch_notes || []).concat([
    `${new Date().toISOString()}: Phase 3 patches applied (T015-T019, ${patchCount} nodes)`
  ]);
  fs.writeFileSync(SRC, JSON.stringify(wf, null, 2), 'utf8');
  console.log(`\n✅ Done — ${patchCount} nodes patched. Written to: ${SRC}`);
} else {
  console.log('\n✅ Nothing to patch — all Phase 3 fixes already applied.');
}
