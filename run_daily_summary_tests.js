#!/usr/bin/env node

/**
 * Unit tests for the Daily Summary workflow Code node.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const projectRoot = __dirname;
const workflowPath = path.join(projectRoot, 'workflow_daily_summary.json');

if (!fs.existsSync(workflowPath)) {
  throw new Error('workflow_daily_summary.json not found.');
}

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const summaryNode = workflow.nodes.find((node) => node.name === 'Build Daily Summary');
if (!summaryNode || !summaryNode.parameters || !summaryNode.parameters.jsCode) {
  throw new Error('Build Daily Summary code node not found.');
}

const summaryCode = summaryNode.parameters.jsCode;

function buildSandbox({ items, envOverrides = {} }) {
  const env = {
    LINE_CHANNEL_ACCESS_TOKEN_102450935821483: 'token-1024',
    LINE_CHANNEL_ACCESS_TOKEN_840212645843493: 'token-8402',
    LINE_CHANNEL_ACCESS_TOKEN_889083480945134: 'token-8890',
    LINE_ALERT_USER_IDS_102450935821483: 'U9f2d613ee48931a4c3b9ebaec27de312',
    LINE_ALERT_USER_IDS_840212645843493: 'U9f2d613ee48931a4c3b9ebaec27de312',
    LINE_ALERT_USER_IDS_889083480945134: 'U9f2d613ee48931a4c3b9ebaec27de312',
    ...envOverrides
  };

  return {
    console,
    require,
    Buffer,
    Date,
    Math,
    JSON,
    Intl,
    $env: env,
    $input: {
      all: () => items
    }
  };
}

async function runSummary({ rows, envOverrides }) {
  const items = rows.map((row) => ({ json: row }));
  const sandbox = buildSandbox({ items, envOverrides });
  sandbox.global = sandbox;

  const wrapped = `(async () => {\n${summaryCode}\n})();`;
  const script = new vm.Script(wrapped, { filename: 'build_daily_summary.js' });
  const context = vm.createContext(sandbox);
  return await script.runInContext(context);
}

function getBangkokIsoFromNow(offsetDays = 0) {
  const now = new Date();
  const offsetMs = (7 * 60 * 60 * 1000) + (offsetDays * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() + offsetMs).toISOString();
}

async function runTests() {
  const todayIso = getBangkokIsoFromNow(0);
  const yesterdayIso = getBangkokIsoFromNow(-1);

  const rows = [
    {
      ISO_Timestamp: todayIso,
      PageID: '102450935821483',
      Type: 'FB_NEGATIVE'
    },
    {
      ISO_Timestamp: yesterdayIso,
      PageID: '102450935821483',
      Type: 'FB_ENCOURAGEMENT'
    }
  ];

  const results = await runSummary({ rows });
  assert.ok(Array.isArray(results), 'Expected array output from summary node');

  const byPage = new Map(results.map((item) => [item.json.pageId, item.json]));
  assert.strictEqual(byPage.size, 3, 'Should emit summary for all configured pages');

  const page1024 = byPage.get('102450935821483');
  assert.ok(page1024, 'Summary for page 102450935821483 should exist');
  assert.strictEqual(page1024.summary.total, 1, 'Only today\'s row should be counted');
  assert.ok(page1024.line.enabled, 'LINE should be enabled when token/targets exist');
  assert.ok(page1024.line.message.includes('FB_NEGATIVE: 1'), 'Summary should include FB_NEGATIVE count');

  const page8402 = byPage.get('840212645843493');
  assert.ok(page8402, 'Summary for page 840212645843493 should exist');
  assert.strictEqual(page8402.summary.total, 0, 'Page without rows should have total 0');
  assert.ok(page8402.line.message.includes('รวมทั้งหมด: 0'), 'Summary should mention total 0');

  console.log('✓ Daily summary tests passed');
}

runTests().catch((error) => {
  console.error('\nDaily summary test run failed:', error);
  process.exitCode = 1;
});
