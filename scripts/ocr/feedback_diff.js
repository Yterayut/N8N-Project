#!/usr/bin/env node

/*
Usage:
  node scripts/ocr/feedback_diff.js pred.json final.json
*/

const fs = require('fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function diffValue(a, b, path, out) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const as = Array.isArray(a) ? a : [];
    const bs = Array.isArray(b) ? b : [];
    const n = Math.max(as.length, bs.length);
    for (let i = 0; i < n; i += 1) {
      diffValue(as[i], bs[i], `${path}[${i}]`, out);
    }
    return;
  }

  if (isObject(a) || isObject(b)) {
    const ao = isObject(a) ? a : {};
    const bo = isObject(b) ? b : {};
    const keys = Array.from(new Set([...Object.keys(ao), ...Object.keys(bo)])).sort();
    for (const k of keys) {
      const next = path ? `${path}.${k}` : k;
      diffValue(ao[k], bo[k], next, out);
    }
    return;
  }

  const av = a === undefined ? null : a;
  const bv = b === undefined ? null : b;
  if (JSON.stringify(av) !== JSON.stringify(bv)) {
    out.push({
      field_path: path || '$',
      from: av,
      to: bv,
    });
  }
}

function main() {
  const [predPath, finalPath] = process.argv.slice(2);
  if (!predPath || !finalPath) {
    process.stderr.write('Usage: node scripts/ocr/feedback_diff.js pred.json final.json\n');
    process.exit(1);
  }

  const pred = readJson(predPath);
  const fin = readJson(finalPath);

  const out = [];
  diffValue(pred, fin, '', out);

  const changedFields = new Set(out.map((x) => x.field_path));
  const result = {
    changed_fields_count: changedFields.size,
    changes: out,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();

