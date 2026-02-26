#!/usr/bin/env node

/**
 * Synchronise workflow3_updated.js into every stored workflow artifact.
 * Keeps UI exports (exports/*.json) and backend JSON mirrors aligned.
 */

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const workflowCode = fs.readFileSync(path.join(projectRoot, 'workflow3_updated.js'), 'utf8');
const CODE_NODE_NAMES = new Set(['Code']);

function replaceInNodes(nodes) {
  let replaced = 0;
  for (const node of nodes) {
    if (
      node?.parameters &&
      Object.prototype.hasOwnProperty.call(node.parameters, 'jsCode') &&
      node?.name &&
      CODE_NODE_NAMES.has(node.name)
    ) {
      node.parameters.jsCode = workflowCode;
      replaced += 1;
    }
  }
  if (!replaced) {
    throw new Error('No Code node found in provided nodes array');
  }
}

function writeJsonCompact(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data));
}

// 1) Load canonical nodes from workflow3.json and update code.
const canonicalPath = path.join(projectRoot, 'workflow3.json');
const canonicalNodes = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
replaceInNodes(canonicalNodes);
writeJsonCompact(canonicalPath, canonicalNodes);
console.log('✓ Synced code into workflow3.json');

// 2) Update exports/Ga5bDLZW6uUaY2KI.json in-place.
const exportPath = path.join(projectRoot, 'exports', 'Ga5bDLZW6uUaY2KI.json');
const exportData = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
for (const workflow of exportData) {
  workflow.nodes = JSON.parse(JSON.stringify(canonicalNodes));
}
fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
console.log('✓ Synced code into exports/Ga5bDLZW6uUaY2KI.json');

// 3) Regenerate bundle files directly from canonical nodes.
function writeBundle(file) {
  const absolute = path.join(projectRoot, file);
  const payload = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  payload.nodes = JSON.stringify(canonicalNodes);
  fs.writeFileSync(absolute, JSON.stringify(payload));
  console.log(`✓ Synced code into ${file}`);
}

writeBundle('workflow3_bundle.json');
writeBundle('workflow3_updated_bundle.json');

// 4) Update workflow3_full.json (nodes array + connections object stuck together).
const fullPath = path.join(projectRoot, 'workflow3_full.json');
const fullText = fs.readFileSync(fullPath, 'utf8');
const marker = '{"Webhook"';
const markerIndex = fullText.indexOf(marker);
if (markerIndex === -1) {
  throw new Error('Unable to locate connections block inside workflow3_full.json');
}
const connectionsSlice = fullText.slice(markerIndex);
const updatedFull = `${JSON.stringify(canonicalNodes)}${connectionsSlice}`;
fs.writeFileSync(fullPath, updatedFull);
console.log('✓ Synced code into workflow3_full.json');
