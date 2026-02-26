#!/usr/bin/env node

/*
Usage:
  node scripts/ocr/build_feedback_payload.js ocr_response.json > feedback_payload.json
*/

const fs = require('fs');

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    die(`Failed to read JSON: ${path} (${err.message})`);
  }
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function main() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath) die('Usage: node scripts/ocr/build_feedback_payload.js <ocr_response.json>');

  const ocr = readJson(inputPath);
  const pred = ocr?.data && typeof ocr.data === 'object' ? ocr.data : { bills: [] };
  const final = clone(pred);

  if (Array.isArray(final.bills) && final.bills.length > 0) {
    const first = final.bills[0];
    if (first.invoice_number) {
      first.invoice_number = `${String(first.invoice_number)}_REV`;
    } else {
      first.invoice_number = 'REV_MANUAL';
    }
  }

  const out = {
    document_id: String(ocr.document_id || ''),
    request_id: String(ocr.request_id || ''),
    doc_type: String(ocr.doc_type || 'unknown'),
    vendor_hint: '',
    layout_hint: '',
    reviewer_id: 'admin_manual',
    ocr_pred_json: pred,
    admin_final_json: final
  };

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

main();

