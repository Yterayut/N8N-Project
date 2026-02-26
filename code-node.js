// Process incoming webhook events from LINE and Facebook Pages and fan out actions
const items = $input.all();
const results = [];

const staticData = $getWorkflowStaticData('global');
if (!staticData.processedComments) staticData.processedComments = {};
const dedupeWindowMs = Number($env.FB_REPLY_DEDUPE_WINDOW_MS || 6 * 60 * 60 * 1000);
const now = Date.now();
if (!staticData.processedCommentsCleanup || now - staticData.processedCommentsCleanup > dedupeWindowMs) {
  for (const key of Object.keys(staticData.processedComments)) {
    const entry = staticData.processedComments[key];
    const entryTimestamp = typeof entry === 'object'
      ? Number(entry.ts ?? entry.timestamp ?? entry.time ?? entry)
      : Number(entry ?? 0);
    if (!entryTimestamp || isNaN(entryTimestamp) || now - entryTimestamp > dedupeWindowMs) {
      delete staticData.processedComments[key];
    }
  }
  staticData.processedCommentsCleanup = now;
}

const THAI_TONE_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;
const LINE_ID_REGEX = /^U[0-9a-fA-F]{32}$/;

function stripAccents(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(THAI_TONE_MARKS, '');
}

function sanitizeKeyword(value) {
  if (!value) return '';
  return stripAccents(value.toString())
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function normaliseText(text) {
  return stripAccents(text)
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function includesKeyword(text, keywords) {
  if (!text) return false;
  const normalised = normaliseText(text);
  return keywords.some((keyword) => keyword && normalised.includes(keyword));
}


const DEFAULT_COMPLAINT_URL = $env.FB_COMPLAINT_FORM_URL || 'https://docs.google.com/forms';
const DEFAULT_STICKER_ID = $env.FB_POSITIVE_STICKER_ID || '369239343222814';

const DEFAULT_COMPLAINT_KEYWORDS = parseKeywordList($env.FB_COMPLAINT_KEYWORDS, [
  'ร้องทุกข์',
  'ร้องเรียน',
  'เดือดร้อน',
  'แจ้งปัญหา',
  'ช่วยด้วย'
]);

const DEFAULT_ENCOURAGEMENT_KEYWORDS = parseKeywordList($env.FB_ENCOURAGEMENT_KEYWORDS, [
  'กำลังใจ',
  'เป็นกำลังใจ',
  'ส่งกำลังใจ',
  'สู้ๆ',
  'สู้ ๆ',
  'สู้นะ',
  'สู้นะคะ',
  'ฮึบ',
  'ฮึบๆ',
  'เชียร์',
  'cheer',
  'cheering',
  'keep going',
  'fighting',
  'you can do it',
  'great job',
  'สุดยอด',
  'เยี่ยมมาก',
  'เก่ง',
  'ยอดเยี่ยม',
  'ดีมาก',
  'ดีงาม',
  'เริ่ด',
  'เจ๋ง',
  'เทพ',
  'ตัวจริง',
  'แน่นอน',
  'ชื่นชม',
  'นับถือ',
  'เก่งจัง',
  'เก่งมาก',
  'เพอร์เฟค',
  'สมบูรณ์แบบ',
  'ไม่ธรรมดา',
  'มืออาชีพ',
  'ฉลาด',
  'คม',
  'คมกริบ',
  'เก่งจริง',
  'ยอม',
  'ที่สุด',
  'ตัวพ่อ',
  'ของจริง',
  '10/10',
  'ให้ 100',
  'ที่หนึ่ง',
  'ปัง',
  'ปังมาก',
  'ต๊าช',
  'จึ้ง',
  'เริ่ดมาก',
  'ชอบ',
  'ชอบมาก',
  'รัก',
  'รักเลย',
  'เลิฟ',
  'ถูกใจ',
  'โดนใจ',
  'ดีต่อใจ',
  'ชื่นใจ',
  'น่ารัก',
  'ใจฟู',
  'ฮีลใจ',
  'ฟิน',
  'เอาใจไปเลย',
  'ปลื้ม',
  'ประทับใจ',
  'สนับสนุน',
  'ติดตาม',
  'FC',
  'แฟนคลับ',
  'ไอดอล',
  'แบบอย่าง',
  'ติดตามตลอด',
  'รอชม',
  'รอฟัง',
  'รอดู',
  'พลังบวก',
  'สร้างแรงบันดาลใจ',
  'เป็นพลังใจ',
  'แรงบันดาลใจ',
  'ทัศนคติดี',
  'แนวคิดดี',
  'เห็นด้วย',
  'ใช่เลย',
  'ถูกต้อง',
  'จริง',
  'จริงที่สุด',
  '+1',
  'ชัดเจน',
  'จริงครับ',
  'ใช่ครับ',
  'ถูกเผง',
  'ตามนั้น',
  'ไม่เถียง',
  'มีประโยชน์',
  'ได้ความรู้',
  'ได้สาระ',
  'เปิดโลก',
  'ได้คิด',
  'ข้อคิดดี',
  'เข้าใจเลย',
  'ขอบคุณ',
  'ขอบคุณครับ',
  'ขอบคุณค่ะ',
  '❤️',
  '👍',
  '👏',
  '🥰',
  '😍',
  '🙏',
  '🫶',
  '🤟',
  '💖',
  'ไมค์'
]);

const DEFAULT_ENCOURAGEMENT_REPLIES = [
  'ขอบคุณสำหรับกำลังใจที่มอบให้กันนะคะ ❤️',
  'ซาบซึ้งในกำลังใจมากๆ เลยค่ะ ขอบคุณนะคะ 💖',
  'ขอบคุณจากใจเลยค่ะ ทีมงานจะสู้ต่อไปนะคะ 💪',
  'ขอบคุณค่า ส่งกำลังใจกลับไปให้เช่นกันค่ะ 🤍'
];

const DEFAULT_NEGATIVE_KEYWORDS = parseKeywordList($env.FB_NEGATIVE_KEYWORDS, [
  'ด่า',
  'โจมตี',
  'เหยียด',
  'ดูถูก',
  'เลว',
  'เหี้ย',
  'สถุน',
  'โง่',
  'บ้า',
  'เกลียด',
  'สาบาน',
  'แย่มาก',
  'แย่สุดๆ',
  'fuck',
  'shit',
  'idiot',
  'stupid',
  'trash'
]);

const BASE_APP_ID = ($env.FB_APP_ID || '').trim();
const BASE_APP_SECRET = ($env.FB_APP_SECRET || '').trim();
const BASE_VERIFY_TOKEN = ($env.FB_VERIFY_TOKEN || '').trim();

const pageConfigs = {
  '889083480945134': createPageConfig({
    pageId: '889083480945134',
    pageName: 'จ๊ะศรีกล้วยทอด',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN_889083480945134 || $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: $env.FB_COMPLAINT_FORM_URL_889083480945134 || DEFAULT_COMPLAINT_URL,
    stickerId: $env.FB_POSITIVE_STICKER_ID_889083480945134 || DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN_889083480945134 || $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS_889083480945134 || $env.LINE_ALERT_USER_IDS)
  }),
  '840212645843493': createPageConfig({
    pageId: '840212645843493',
    pageName: 'ความสุขนักวิ่ง',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN_840212645843493 || $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: $env.FB_COMPLAINT_FORM_URL_840212645843493 || DEFAULT_COMPLAINT_URL,
    stickerId: $env.FB_POSITIVE_STICKER_ID_840212645843493 || DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN_840212645843493 || $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS_840212645843493 || $env.LINE_ALERT_USER_IDS)
  }),
  '102450935821483': createPageConfig({
    pageId: '102450935821483',
    pageName: 'พชร จันทรวงทอง',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN_102450935821483 || $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: $env.FB_COMPLAINT_FORM_URL_102450935821483 || DEFAULT_COMPLAINT_URL,
    stickerId: $env.FB_POSITIVE_STICKER_ID_102450935821483 || DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN_102450935821483 || $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS_102450935821483 || $env.LINE_ALERT_USER_IDS)
  })
};

function createPageConfig({ pageId, pageName, pageAccessToken, complaintUrl, stickerId, lineChannelAccessToken, lineTargetUserIds, appId, appSecret, verifyToken }) {
  const envSuffix = pageId ? pageId.trim().replace(/[^0-9A-Z]+/gi, '_').toUpperCase() : '';
  let resolvedAppId = (appId || '').trim();
  if (!resolvedAppId && envSuffix) {
    const appIdEnvKey = `FB_APP_ID_${envSuffix}`;
    resolvedAppId = ($env[appIdEnvKey] || '').trim();
  }
  if (!resolvedAppId) {
    resolvedAppId = BASE_APP_ID;
  }

  let resolvedAppSecret = (appSecret || '').trim();
  if (!resolvedAppSecret && envSuffix) {
    const appSecretEnvKey = `FB_APP_SECRET_${envSuffix}`;
    resolvedAppSecret = ($env[appSecretEnvKey] || '').trim();
  }
  if (!resolvedAppSecret) {
    resolvedAppSecret = BASE_APP_SECRET;
  }

  let resolvedVerifyToken = (verifyToken || '').trim();
  if (!resolvedVerifyToken && envSuffix) {
    const verifyTokenEnvKey = `FB_VERIFY_TOKEN_${envSuffix}`;
    resolvedVerifyToken = ($env[verifyTokenEnvKey] || '').trim();
  }
  if (!resolvedVerifyToken) {
    resolvedVerifyToken = BASE_VERIFY_TOKEN;
  }

  if (!pageAccessToken && envSuffix) {
    const envKey = `FB_PAGE_ACCESS_TOKEN_${envSuffix}`;
    pageAccessToken = $env[envKey] || pageAccessToken;
  }
  pageAccessToken = (pageAccessToken || '').trim();

  if ((!lineTargetUserIds || lineTargetUserIds.length === 0) && envSuffix) {
    const envKey = `LINE_ALERT_USER_IDS_${envSuffix}`;
    lineTargetUserIds = parseIdList($env[envKey]);
  } else if (Array.isArray(lineTargetUserIds)) {
    lineTargetUserIds = parseIdList(lineTargetUserIds);
  }

  if (!lineChannelAccessToken && envSuffix) {
    const envKey = `LINE_CHANNEL_ACCESS_TOKEN_${envSuffix}`;
    lineChannelAccessToken = $env[envKey] || lineChannelAccessToken;
  }
  lineChannelAccessToken = (lineChannelAccessToken || '').trim();

  if (!complaintUrl && envSuffix) {
    const envKey = `FB_COMPLAINT_FORM_URL_${envSuffix}`;
    complaintUrl = $env[envKey] || complaintUrl;
  }

  let resolvedEncouragementReplies = envSuffix
    ? parseReplyList($env[`FB_ENCOURAGEMENT_REPLIES_${envSuffix}`], [])
    : [];
  if (!resolvedEncouragementReplies.length) {
    resolvedEncouragementReplies = parseReplyList($env.FB_ENCOURAGEMENT_REPLIES, []);
  }
  if (!resolvedEncouragementReplies.length) {
    resolvedEncouragementReplies = DEFAULT_ENCOURAGEMENT_REPLIES.slice();
  }

  return {
    pageId,
    pageName: pageName || pageId,
    pageAccessToken,
    appId: resolvedAppId,
    appSecret: resolvedAppSecret,
    verifyToken: resolvedVerifyToken,
    complaintUrl: (complaintUrl || DEFAULT_COMPLAINT_URL || '').trim(),
    stickerId: (stickerId || DEFAULT_STICKER_ID || '').trim(),
    lineChannelAccessToken,
    lineTargetUserIds: Array.isArray(lineTargetUserIds)
      ? lineTargetUserIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id) => LINE_ID_REGEX.test(id))
      : [],
    encouragementReplies: resolvedEncouragementReplies,
    keywords: {
      complaint: DEFAULT_COMPLAINT_KEYWORDS,
      encouragement: DEFAULT_ENCOURAGEMENT_KEYWORDS,
      negative: DEFAULT_NEGATIVE_KEYWORDS,
    }
  };
}
function parseKeywordList(rawValue, fallback) {
  if (!rawValue) {
    return Array.isArray(fallback)
      ? fallback.map((entry) => sanitizeKeyword(entry)).filter(Boolean)
      : [];
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => sanitizeKeyword(entry)).filter(Boolean);
  }
  return rawValue
    .split(/[\n,]/)
    .map((entry) => sanitizeKeyword(entry))
    .filter(Boolean);
}

function parseReplyList(rawValue, fallback) {
  if (!rawValue) {
    return Array.isArray(fallback) ? fallback.filter(Boolean).map((entry) => entry.toString().trim()) : [];
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => entry.toString().trim()).filter(Boolean);
  }
  return rawValue
    .toString()
    .replace(/\r/g, '')
    .split(/(?:\n|\|\||,)/)
    .map((entry) => entry.toString().trim())
    .filter(Boolean);
}

function parseIdList(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue.map((entry) => entry.toString().trim()).filter(Boolean);
  return rawValue
    .split(/[\n,]/)
    .map((entry) => entry.toString().trim())
    .filter(Boolean);
}

function pickRandom(list, fallback = '') {
  if (Array.isArray(list) && list.length) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return fallback;
}

function buildCommentUrl(pageId, postId, commentId) {
  if (!pageId || !commentId) return '';
  const postSuffix = (postId || '').split('_')[1] || postId || '';
  const commentSuffix = commentId.split('_')[1] || commentId;
  if (!postSuffix || !commentSuffix) return '';
  return `https://www.facebook.com/${pageId}/posts/${postSuffix}?comment_id=${commentSuffix}`;
}

function formatTimestamp(timestamp) {
  try {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  } catch (error) {
    return new Date().toISOString();
  }
}

function toSheetDefaults(base = {}) {
  return {
    sheetTimestamp: base.sheetTimestamp || '',
    sheetPageId: base.sheetPageId || '',
    sheetPostId: base.sheetPostId || '',
    sheetCommentId: base.sheetCommentId || '',
    sheetUserName: base.sheetUserName || '',
    sheetUserId: base.sheetUserId || '',
    sheetType: base.sheetType || '',
    sheetOriginalComment: base.sheetOriginalComment || '',
    sheetReplyMessage: base.sheetReplyMessage || '',
    sheetNotifiedChannel: base.sheetNotifiedChannel || '',
    sheetStatus: base.sheetStatus || '',
  };
}

for (const item of items) {
  const webhookUrl = (item.json.webhookUrl || '').replace(/\/webhook.*$/, '');
  const fallbackBase = ($env.WEBHOOK_URL || $env.N8N_ENDPOINT_URL || 'http://127.0.0.1:5678').replace(/\/$/, '');
  const baseUrl = (webhookUrl || fallbackBase).replace(/\/$/, '');
  const body = item.json.body ?? item.json;

  if (body && Array.isArray(body.events)) {
    // LINE webhook events
    for (const event of body.events) {
      if (!event || event.type !== 'message' || !event.message) {
        continue;
      }
      const text = event.message.text || '';
      const trimmed = text.trim();
      const routeMatch = trimmed.match(/^wf:([a-z0-9_\/-]+)\s*(.*)$/i);
      const timestamp = formatTimestamp(event.timestamp);

      const output = {
        source: 'line',
        route: 'log',
        timestamp,
        message: text,
        messageType: event.message.type,
        sheetTimestamp: timestamp,
        sheetPostId: '',
        sheetCommentId: '',
        sheetUserName: '',
        sheetUserId: event.source?.userId ?? '',
        sheetType: 'LINE_MESSAGE',
        sheetOriginalComment: text,
        sheetReplyMessage: '',
        sheetNotifiedChannel: '',
        sheetStatus: 'LINE_LOG',
        line: {
          enabled: false,
          targets: []
        }
      };

      if (routeMatch) {
        const targetPath = routeMatch[1];
        const remainder = routeMatch[2] || '';
        const productionUrl = `${baseUrl}/webhook/${targetPath}`;
        const testUrl = `${baseUrl}/webhook-test/${targetPath}`;

        output.route = 'subWorkflow';
        output.command = `wf:${targetPath}`;
        output.sheetStatus = `LINE_ROUTE:${targetPath}`;
        output.subWorkflow = {
          path: targetPath,
          productionUrl,
          testUrl,
          payload: {
            routedFromWorkflow: $workflow.id,
            originalEvent: event,
            userId: output.sheetUserId || 'unknown',
            timestamp: event.timestamp,
            message: text,
            content: remainder || text
          }
        };
      }

      results.push({ json: output });
    }
    continue;
  }

  if (body && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      const pageId = entry.id || body.id || '';
      const pageConfig = pageConfigs[pageId] || createPageConfig({ pageId });
      const changes = entry.changes || [];

      for (const change of changes) {
        if (!change || change.field !== 'feed') {
          continue;
        }
        const value = change.value || {};
        if (value.verb && value.verb !== 'add') {
          continue;
        }
        if (!value.comment_id || (value.item && value.item !== 'comment')) {
          continue;
        }

        const message = value.message || '';
        const attachments = (value.attachments?.data) || (value.attachment ? [value.attachment] : []);
        const hasSticker = attachments.some((att) => att?.type === 'sticker' || att?.media?.sticker_id) || Boolean(value.sticker_id);

        const sheetTimestamp = formatTimestamp((value.created_time || value.timestamp) ? (Number(value.created_time || value.timestamp) * 1000) : Date.now());
        const sheetRow = {
          sheetTimestamp,
          sheetPageId: pageId,
          sheetPostId: value.post_id || '',
          sheetCommentId: value.comment_id,
          sheetUserName: value.sender_name || value.from?.name || '',
          sheetUserId: value.sender_id || value.from?.id || '',
          sheetOriginalComment: message || (hasSticker ? '[sticker]' : ''),
        };

        if (!isPageActive(pageId)) {
          const disabled = toSheetDefaults({
            sheetTimestamp,
            sheetPageId: sheetRow.sheetPageId,
            sheetPostId: sheetRow.sheetPostId,
            sheetCommentId: sheetRow.sheetCommentId,
            sheetUserName: sheetRow.sheetUserName,
            sheetUserId: sheetRow.sheetUserId,
            sheetOriginalComment: sheetRow.sheetOriginalComment,
            sheetStatus: 'SKIPPED: PAGE_DISABLED',
            sheetType: 'FB_DISABLED',
          });
          disabled.source = 'facebook';
          disabled.route = 'log';
          disabled.message = message || (hasSticker ? '[sticker]' : '');
          disabled.messageType = hasSticker ? 'sticker' : 'text';
          results.push({ json: disabled });
          continue;
        }

        const commentUrl = buildCommentUrl(pageId, value.post_id, value.comment_id);

        let route = 'log';

        // Dedupe logic: prevent processing same comment multiple times (FB sends duplicate webhooks)
        // Use comment_id + created_time for more accurate deduplication
        const createdTime = value.created_time || value.timestamp || '';
        const dedupeKey = value.comment_id ? `${pageId}_${value.comment_id}_${createdTime}` : `${pageId}_${value.comment_id || ''}_${createdTime}`;
        const lastProcessedAt = staticData.processedComments[dedupeKey];
        const isDuplicate = Boolean(lastProcessedAt && (now - lastProcessedAt) < dedupeWindowMs);

        // Set timestamp IMMEDIATELY to prevent race condition (before processing)
        if (!isDuplicate) {
          staticData.processedComments[dedupeKey] = now;
          console.log(`[DEDUPE] New comment: ${dedupeKey}`);
        } else {
          console.log(`[DEDUPE] Duplicate detected: ${dedupeKey}, last processed ${Math.floor((now - lastProcessedAt) / 1000)}s ago`);
        }

        const isSelfComment = Boolean(
          (value.sender_id && value.sender_id === pageId) ||
          (value.from?.id && value.from.id === pageId)
        );

        let sheetType = 'FB_OTHER';
        let sheetReplyMessage = '';
        let sheetStatus = 'FB_LOG';
        let notifiedChannel = '';

        const normalized = normaliseText(message);
        const keywords = pageConfig.keywords;

        let replyMessage = '';
        let lineMessage = '';
        let stickerId = pageConfig.stickerId;

        const canAct = Boolean(pageConfig.pageAccessToken) && !isDuplicate && !isSelfComment;
        const lineTargets = Array.isArray(pageConfig.lineTargetUserIds) ? pageConfig.lineTargetUserIds.filter((id) => LINE_ID_REGEX.test(id)) : [];
        const lineToken = pageConfig.lineChannelAccessToken;
        const lineEnabled = Boolean(lineToken) && lineTargets.length > 0 && !isSelfComment;

        if (isSelfComment) {
          route = 'log';
          sheetType = 'FB_SELF_COMMENT';
          sheetReplyMessage = '';
          sheetStatus = 'SKIPPED: SELF_COMMENT';
          notifiedChannel = '';
        } else if (isDuplicate) {
          route = 'log';
          sheetType = 'FB_DUPLICATE';
          sheetReplyMessage = '';
          sheetStatus = 'SKIPPED: DUPLICATE_COMMENT';
          notifiedChannel = '';
        } else if (!canAct) {
          route = 'log';
          sheetStatus = 'SKIPPED: NO_PAGE_TOKEN';
        } else if (hasSticker) {
          route = 'fb_sticker';
          sheetType = 'FB_STICKER';
          sheetReplyMessage = stickerId ? `Sticker ID ${stickerId}` : '';
          sheetStatus = 'FB_STICKER_REPLY';
          lineMessage = [
            `[Facebook] มีคอมเมนต์สติกเกอร์บนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            commentUrl ? `ลิงก์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n');
        } else if (includesKeyword(normalized, keywords.negative)) {
          route = 'fb_negative';
          sheetType = 'FB_NEGATIVE';
          sheetReplyMessage = '[delete comment]';
          sheetStatus = 'FB_NEGATIVE_DELETE';
          lineMessage = [
            `[Facebook] ลบคอมเมนต์ไม่เหมาะสมบนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            commentUrl ? `ลิงก์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n');
        } else if (includesKeyword(normalized, keywords.complaint)) {
          route = 'fb_complaint';
          sheetType = 'FB_COMPLAINT';
          replyMessage = `ขอบคุณที่แจ้งเรื่องกับ ${pageConfig.pageName} ค่ะ หากต้องการแจ้งรายละเอียดเพิ่มเติมสามารถกรอกข้อมูลได้ที่ ${pageConfig.complaintUrl}`;
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_COMPLAINT_REPLY';
          lineMessage = [
            `[Facebook] มีการร้องทุกข์บนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            `ฟอร์มร้องทุกข์: ${pageConfig.complaintUrl}`,
            commentUrl ? `ลิงก์คอมเมนต์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n');
        } else if (includesKeyword(normalized, keywords.encouragement)) {
          route = 'fb_encouragement';
          sheetType = 'FB_ENCOURAGEMENT';
          const encouragementReplies = Array.isArray(pageConfig.encouragementReplies) && pageConfig.encouragementReplies.length
            ? pageConfig.encouragementReplies
            : DEFAULT_ENCOURAGEMENT_REPLIES;
          replyMessage = pickRandom(encouragementReplies, encouragementReplies[0] || DEFAULT_ENCOURAGEMENT_REPLIES[0]);
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_ENCOURAGEMENT_REPLY';
          lineMessage = [
            `[Facebook] มีคอมเมนต์ให้กำลังใจบนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            commentUrl ? `ลิงก์คอมเมนต์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n');
        } else {
          sheetStatus = 'FB_LOG';
          sheetReplyMessage = '';
        }

        notifiedChannel = lineEnabled && lineMessage ? (lineTargets.length > 1 ? 'LINE(multicast)' : 'LINE(push)') : '';

        const output = {
          source: 'facebook',
          route,
          sheetTimestamp,
          sheetPageId: sheetRow.sheetPageId,
          sheetPostId: sheetRow.sheetPostId,
          sheetCommentId: sheetRow.sheetCommentId,
          sheetUserName: sheetRow.sheetUserName,
          sheetUserId: sheetRow.sheetUserId,
          sheetType,
          sheetOriginalComment: sheetRow.sheetOriginalComment,
          sheetReplyMessage,
          sheetNotifiedChannel: notifiedChannel,
          sheetStatus,
          message: message,
          messageType: hasSticker ? 'sticker' : 'text',
          facebook: {
            pageId,
            pageName: pageConfig.pageName,
            postId: value.post_id || '',
            commentId: value.comment_id,
            parentId: value.parent_id || '',
            commentUrl,
            pageAccessToken: pageConfig.pageAccessToken,
            appId: pageConfig.appId || BASE_APP_ID,
            verifyToken: pageConfig.verifyToken || BASE_VERIFY_TOKEN,
            reply: replyMessage
              ? {
                  type: 'text',
                  message: replyMessage
                }
              : (route === 'fb_sticker' && stickerId
                ? {
                    type: 'sticker',
                    stickerId
                  }
                : null),
            delete: route === 'fb_negative'
          },
          line: {
            enabled: Boolean(lineEnabled && lineMessage),
            endpoint: lineTargets.length > 1
              ? 'https://api.line.me/v2/bot/message/multicast'
              : 'https://api.line.me/v2/bot/message/push',
            channelAccessToken: lineToken,
            targets: lineTargets,
            message: lineMessage,
            commentUrl
          }
        };

        results.push({ json: output });
      }
    }
    continue;
  }

  // Unsupported payload -> log only
  results.push({
    json: toSheetDefaults({
      sheetTimestamp: formatTimestamp(Date.now()),
      sheetStatus: 'SKIPPED: UNKNOWN_PAYLOAD'
    })
  });
}

return results;
