#!/usr/bin/env node

/**
 * Lightweight unit tests for the Workflow 3 Code node logic.
 * Simulates inbound Facebook payloads and asserts routing/output fields.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const projectRoot = __dirname;
const workflowPath = path.join(projectRoot, 'workflow3_updated.js');
const workflowCode = fs.readFileSync(workflowPath, 'utf8');

const lockDir = path.join(projectRoot, 'tmp', 'locks');

function cleanupLocks() {
  fs.rmSync(lockDir, { recursive: true, force: true });
}

function buildSandbox({ items, envOverrides = {}, httpResponse = { data: [] } }) {
  const env = {
    FB_REPLY_LOCK_DIR: lockDir,
    FB_GRAPH_API_VERSION: 'v19.0',
    FB_GRAPH_TIMEOUT_MS: '5000',
    FB_PAGE_ACTIVE_840212645843493: 'true',
    FB_PAGE_ACCESS_TOKEN_840212645843493: 'dummy-page-token',
    LINE_CHANNEL_ACCESS_TOKEN_840212645843493: 'dummy-line-token',
    LINE_ALERT_USER_IDS_840212645843493: 'U9f2d613ee48931a4c3b9ebaec27de312',
    ...envOverrides
  };

  const staticStore = {};

  return {
    console,
    require,
    Buffer,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    $workflow: { id: 'Ga5bDLZW6uUaY2KI' },
    $execution: { id: 'unit-test-exec' },
    $env: env,
    $input: {
      all: () => items
    },
    $getWorkflowStaticData: () => staticStore,
    $httpRequest: async (opts) => {
      const url = opts.url || '';
      if (url.includes('/likes')) {
        return { success: true };
      }
      return httpResponse;
    },
  };
}

async function runWorkflow({ payload, envOverrides, httpResponse }) {
  cleanupLocks();
  const items = [{
    json: {
      body: payload,
      webhookUrl: 'https://example.ngrok-free.dev/webhook'
    }
  }];

  const sandbox = buildSandbox({ items, envOverrides, httpResponse });
  sandbox.global = sandbox;

  const wrapped = `(async () => {\n${workflowCode}\n})();`;
  const script = new vm.Script(wrapped, { filename: 'workflow3_updated.js' });
  const context = vm.createContext(sandbox);
  return await script.runInContext(context);
}

function createFbPayload({ message, commentId, extras = {} }) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    object: 'page',
    entry: [
      {
        id: '840212645843493',
        time: nowSec,
        changes: [
          {
            field: 'feed',
            value: {
              from: { id: '25195452396752455', name: 'Test User' },
              message,
              post_id: '840212645843493_122099962989103900',
              comment_id: commentId,
              created_time: nowSec,
              item: 'comment',
              parent_id: '840212645843493_122099962989103900',
              verb: 'add',
              ...extras
            }
          }
        ]
      }
    ]
  };
}

async function runTests() {
  const tests = [
    {
      name: 'Encouragement comment triggers reply without LINE notify',
      payload: createFbPayload({
        message: 'พลังบวกสุดๆ',
        commentId: '122099962989103900_1'
      }),
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement', 'Should route to encouragement branch');
        assert.strictEqual(result.sheetType, 'FB_ENCOURAGEMENT');
        assert.ok(result.facebook.reply?.message, 'Should prepare Facebook reply text');
        assert.strictEqual(result.sheetNotifiedChannel, '');
        assert.strictEqual(result.line.enabled, false, 'LINE notification should be disabled for non-negative');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_OK');
        assert.strictEqual(result.needsDelay, true, 'Encouragement path should mark needsDelay');
        assert.ok(result.sheetTimestamp, 'Sheet timestamp must be set');
      }
    },
    {
      name: 'Complaint comment sends complaint reply without LINE alert',
      payload: createFbPayload({
        message: 'มีเรื่องร้องเรียน ขอแจ้งปัญหา',
        commentId: '122099962989103900_2'
      }),
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_complaint');
        assert.strictEqual(result.sheetType, 'FB_COMPLAINT');
        assert.ok(result.facebook.reply?.message.includes('ร้องเรียน'), 'Complaint reply should mention form');
        assert.strictEqual(result.sheetNotifiedChannel, '');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_OK');
        assert.strictEqual(result.needsDelay, true, 'Complaint path should mark needsDelay');
        assert.ok(result.sheetTimestamp, 'Sheet timestamp must be set');
      }
    },
    {
      name: 'Negative comment flags deletion without reply',
      payload: createFbPayload({
        message: 'บริการแย่มาก เลวสุดๆ',
        commentId: '122099962989103900_3'
      }),
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_negative');
        assert.strictEqual(result.sheetType, 'FB_NEGATIVE');
        assert.strictEqual(result.sheetStatus, 'FB_NEGATIVE_DELETE');
        assert.strictEqual(result.sheetReplyMessage, '[delete comment]');
        assert.strictEqual(result.sheetNotifiedChannel, 'LINE(push)');
        assert.strictEqual(result.facebook.delete, true, 'Should mark comment for deletion');
        assert.strictEqual(result.facebook.reply, null, 'No reply body for negative comment');
        assert.strictEqual(result.line.enabled, true, 'LINE notification should be enabled for deletes');
        assert.ok(result.line.message.includes('ลบคอมเมนต์'), 'LINE message should mention deletion');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_SKIP');
        assert.strictEqual(result.needsDelay, false, 'Negative moderation must bypass delay for immediate deletion');
      }
    },
    {
      name: 'Polite comment containing keyword fragment is not deleted',
      payload: createFbPayload({
        message: 'ดีเป็นโครงการที่ดีให้มาแนะนำชาวบ้านได้รับรู้',
        commentId: '122099962989103900_3b'
      }),
      envOverrides: {
        FB_NEGATIVE_KEYWORDS: 'ด่า,เหี้ย,สถุน,โง่,บ้า,เกลียด,สาบาน,แย่,เลว'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_ENCOURAGEMENT');
        assert.strictEqual(result.sheetStatus, 'FB_ENCOURAGEMENT_REPLY');
        assert.notStrictEqual(result.sheetReplyMessage, '[delete comment]');
      }
    },
    {
      name: 'Negative whole-word keyword still deletes with punctuation',
      payload: createFbPayload({
        message: 'นโยบาย เลว! ต้องแก้ด่วน',
        commentId: '122099962989103900_3c'
      }),
      envOverrides: {
        FB_NEGATIVE_KEYWORDS: 'ด่า,เหี้ย,สถุน,โง่,บ้า,เกลียด,สาบาน,แย่,เลว'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_negative');
        assert.strictEqual(result.sheetStatus, 'FB_NEGATIVE_DELETE');
        assert.strictEqual(result.facebook.delete, true);
      }
    },
    {
      name: 'Owner reply skips workflow entirely',
      payload: createFbPayload({
        message: 'ขอบคุณค้าบ 😆',
        commentId: '122099962989103900_owner',
        extras: {
          sender_id: '5991717854199013'
        }
      }),
      envOverrides: {
        FB_OWNER_USER_IDS: '5991717854199013'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'log');
        assert.strictEqual(result.sheetType, 'FB_SELF_COMMENT');
        assert.strictEqual(result.sheetStatus, 'SKIPPED: OWNER_REPLY');
        assert.strictEqual(!!(result.line && result.line.enabled), false);
        assert.strictEqual(result.needsDelay, false);
      }
    },
    {
      name: 'Sticker comment routes through encouragement sticker flow',
      payload: createFbPayload({
        message: '',
        commentId: '122099962989103900_4',
        extras: {
          attachments: {
            data: [
              {
                type: 'sticker',
                media: { sticker_id: '12345' }
              }
            ]
          }
        }
      }),
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_STICKER_ENCOURAGEMENT');
        assert.strictEqual(result.sheetStatus, 'FB_STICKER_ENCOURAGEMENT_REPLY');
        assert.ok(result.facebook.reply?.message, 'Sticker reply message should exist');
        assert.strictEqual(result.line.enabled, false, 'LINE should be disabled for non-negative');
        assert.strictEqual(result.needsDelay, true, 'Sticker replies should mark delay for downstream wait nodes');
      }
    },
    {
      name: 'Sticker without metadata still skips LINE',
      payload: {
        object: 'page',
        entry: [
          {
            id: '840212645843493',
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  comment_id: '122099962989103900_4b',
                  post_id: '840212645843493_122099962989103900',
                  created_time: Math.floor(Date.now() / 1000),
                  message: ''
                }
              }
            ]
          }
        ]
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_STICKER_ENCOURAGEMENT');
        assert.strictEqual(result.sheetStatus, 'FB_STICKER_ENCOURAGEMENT_REPLY');
        assert.strictEqual(result.sheetNotifiedChannel, '');
        assert.strictEqual(result.line.enabled, false, 'LINE should be disabled for non-negative');
      }
    },
    {
      name: 'Blessing event comment maps to event reply and category',
      payload: createFbPayload({
        message: 'ร่วมโมทนาบุญกับงานบวชครับ',
        commentId: '122099962989103900_5'
      }),
      envOverrides: {
        FB_EVENT_REPLIES_BLESSING: 'BLESSED_REPLY'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_EVENT_BLESSING');
        assert.strictEqual(result.sheetStatus, 'FB_EVENT_BLESSING_REPLY');
        assert.strictEqual(result.eventCategory, 'งานบุญ/งานบวช');
        assert.strictEqual(result.facebook.reply?.message, 'BLESSED_REPLY');
        assert.strictEqual(result.line.enabled, false, 'LINE should be disabled for non-negative');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_OK');
        assert.strictEqual(result.needsDelay, true);
      }
    },
    {
      name: 'Funeral condolence comment stays in event path',
      payload: createFbPayload({
        message: 'ขอแสดงความเสียใจและไว้อาลัยด้วยครับ',
        commentId: '122099962989103900_6'
      }),
      envOverrides: {
        FB_EVENT_REPLIES_FUNERAL: 'FUNERAL_REPLY'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_EVENT_FUNERAL');
        assert.strictEqual(result.sheetStatus, 'FB_EVENT_FUNERAL_ACK');
        assert.strictEqual(result.eventCategory, 'งานศพ');
        assert.strictEqual(result.facebook.reply?.message, 'FUNERAL_REPLY');
        assert.strictEqual(result.line.enabled, false, 'LINE should be disabled for non-negative');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_OK');
        assert.strictEqual(result.needsDelay, true);
      }
    },
    {
      name: 'Wedding congratulation comment detected as event',
      payload: createFbPayload({
        message: 'ยินดีกับงานแต่งของทั้งคู่ครับ',
        commentId: '122099962989103900_7'
      }),
      envOverrides: {
        FB_EVENT_REPLIES_WEDDING: 'WEDDING_REPLY'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_EVENT_WEDDING');
        assert.strictEqual(result.sheetStatus, 'FB_EVENT_WEDDING_REPLY');
        assert.strictEqual(result.eventCategory, 'งานแต่งงาน');
        assert.strictEqual(result.facebook.reply?.message, 'WEDDING_REPLY');
        assert.strictEqual(result.line.enabled, false, 'LINE should be disabled for non-negative');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_OK');
        assert.strictEqual(result.needsDelay, true);
      }
    },
    {
      name: 'Birthday wishes fall into birthday event category',
      payload: createFbPayload({
        message: 'สุขสันต์วันเกิดครับ HBD',
        commentId: '122099962989103900_8'
      }),
      envOverrides: {
        FB_EVENT_REPLIES_BIRTHDAY: 'BIRTHDAY_REPLY'
      },
      assert: (result) => {
        assert.strictEqual(result.route, 'fb_encouragement');
        assert.strictEqual(result.sheetType, 'FB_EVENT_BIRTHDAY');
        assert.strictEqual(result.sheetStatus, 'FB_EVENT_BIRTHDAY_REPLY');
        assert.strictEqual(result.eventCategory, 'วันเกิดเจ้าของเพจ');
        assert.strictEqual(result.facebook.reply?.message, 'BIRTHDAY_REPLY');
        assert.strictEqual(result.line.enabled, false, 'LINE should be disabled for non-negative');
        assert.strictEqual(result.meta.likeStatus, 'FB_LIKE_OK');
        assert.strictEqual(result.needsDelay, true);
      }
    },
    {
      name: 'Non-add feed events still log to sheet without delay',
      payload: createFbPayload({
        message: 'กลับมาแก้ไขคอมเมนต์',
        commentId: '122099962989103900_edited',
        extras: { verb: 'edited' }
      }),
      assert: (result) => {
        assert.strictEqual(result.route, 'log');
        assert.strictEqual(result.sheetType, 'FB_SKIPPED');
        assert.strictEqual(result.sheetStatus, 'SKIPPED: NON_ADD_EVENT');
        assert.strictEqual(result.needsDelay, false, 'Skip entries must bypass delay');
        assert.ok(!result.line?.enabled, 'Skip entries should not trigger LINE');
      }
    }
  ];

  let passed = 0;
  for (const test of tests) {
    const results = await runWorkflow({ payload: test.payload, envOverrides: test.envOverrides });
    assert.ok(Array.isArray(results) && results.length === 1, 'Workflow should emit single item');
    const result = results[0].json;
    try {
      test.assert(result);
      passed += 1;
      console.log(`✓ ${test.name}`);
    } catch (error) {
      console.error(`✗ ${test.name}`);
      throw error;
    }
  }

  console.log(`\n${passed}/${tests.length} tests passed`);
}

runTests().catch((error) => {
  console.error('\nTest run failed:', error);
  process.exitCode = 1;
});
