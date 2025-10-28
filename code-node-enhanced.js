// Enhanced Code Node for n8n Workflow 3
// Supports: text, sticker, photo, video, gif, mixed, empty comments
// Version: 2.0 (27 Oct 2025)

// ========== Configuration ==========
const items = $input.all();
const results = [];

const DEFAULT_COMPLAINT_URL = $env.FB_COMPLAINT_FORM_URL || 'https://docs.google.com/forms';
const DEFAULT_STICKER_ID = $env.FB_POSITIVE_STICKER_ID || '369239343222814';

// Response Policies
const REPLY_TO_STICKER = ($env.FB_REPLY_TO_STICKER || 'true') === 'true';
const REPLY_TO_PHOTO = ($env.FB_REPLY_TO_PHOTO || 'false') === 'true';
const REPLY_TO_VIDEO = ($env.FB_REPLY_TO_VIDEO || 'false') === 'true';
const REPLY_TO_QUESTION = ($env.FB_REPLY_TO_QUESTION || 'false') === 'true';
const REPLY_TO_NORMAL = ($env.FB_REPLY_TO_NORMAL || 'false') === 'true';

// Notification Policies
const NOTIFY_ALL = ($env.FB_NOTIFY_ALL || 'false') === 'true';
const NOTIFY_COMPLAINT = ($env.FB_NOTIFY_COMPLAINT || 'true') === 'true';
const NOTIFY_QUESTION = ($env.FB_NOTIFY_QUESTION || 'true') === 'true';
const NOTIFY_NEGATIVE = ($env.FB_NOTIFY_NEGATIVE || 'true') === 'true';

// Keywords
const DEFAULT_COMPLAINT_KEYWORDS = parseKeywordList($env.FB_COMPLAINT_KEYWORDS, [
  'ร้องทุกข์', 'ร้องเรียน', 'เดือดร้อน', 'แจ้งปัญหา', 'ช่วยด้วย'
]);

const DEFAULT_ENCOURAGEMENT_KEYWORDS = parseKeywordList($env.FB_ENCOURAGEMENT_KEYWORDS, [
  'กำลังใจ', 'เป็นกำลังใจ', 'ส่งกำลังใจ', 'สู้ๆ', 'สู้ ๆ', 'สู้นะ', 'สู้นะคะ',
  'ฮึบ', 'ฮึบๆ', 'เชียร์', 'cheer', 'cheering', 'keep going', 'fighting',
  'you can do it', 'great job', 'สุดยอด', 'เยี่ยมมาก'
]);

const DEFAULT_NEGATIVE_KEYWORDS = parseKeywordList($env.FB_NEGATIVE_KEYWORDS, [
  'ด่า', 'โจมตี', 'เหยียด', 'ดูถูก', 'เลว', 'เหี้ย', 'สถุน', 'โง่', 'บ้า',
  'เกลียด', 'สาบาน', 'แย่มาก', 'แย่สุดๆ', 'fuck', 'shit', 'idiot', 'stupid', 'trash'
]);

const DEFAULT_QUESTION_KEYWORDS = parseKeywordList($env.FB_QUESTION_KEYWORDS, [
  'ราคา', 'ราคาเท่าไหร่', 'เท่าไหร่', 'ขาย', 'สั่ง', 'จอง', 'ติดต่อ', 'เบอร์',
  'ที่อยู่', 'อยู่ไหน', 'เปิดกี่โมง', 'ส่ง', 'เดลิเวอรี่'
]);

// Page configs
const pageConfigs = {
  '889083480945134': createPageConfig({
    pageId: '889083480945134',
    pageName: 'จ๊ะศรีกล้วยทอด',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: DEFAULT_COMPLAINT_URL,
    stickerId: DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS)
  })
};

// ========== Helper Functions ==========

function createPageConfig({ pageId, pageName, pageAccessToken, complaintUrl, stickerId, lineChannelAccessToken, lineTargetUserIds }) {
  const envSuffix = pageId ? pageId.trim().replace(/[^0-9A-Z]+/gi, '_').toUpperCase() : '';
  if (!pageAccessToken && envSuffix) {
    const envKey = `FB_PAGE_ACCESS_TOKEN_${envSuffix}`;
    pageAccessToken = $env[envKey] || pageAccessToken;
  }
  if ((!lineTargetUserIds || lineTargetUserIds.length === 0) && envSuffix) {
    const envKey = `LINE_ALERT_USER_IDS_${envSuffix}`;
    lineTargetUserIds = parseIdList($env[envKey]);
  }
  if (!lineChannelAccessToken && envSuffix) {
    const envKey = `LINE_CHANNEL_ACCESS_TOKEN_${envSuffix}`;
    lineChannelAccessToken = $env[envKey] || lineChannelAccessToken;
  }
  if (!complaintUrl && envSuffix) {
    const envKey = `FB_COMPLAINT_FORM_URL_${envSuffix}`;
    complaintUrl = $env[envKey] || complaintUrl;
  }

  return {
    pageId,
    pageName: pageName || pageId,
    pageAccessToken: pageAccessToken || '',
    complaintUrl: complaintUrl || DEFAULT_COMPLAINT_URL,
    stickerId: stickerId || DEFAULT_STICKER_ID,
    lineChannelAccessToken: lineChannelAccessToken || '',
    lineTargetUserIds: Array.isArray(lineTargetUserIds) ? lineTargetUserIds.filter(Boolean) : [],
    keywords: {
      complaint: DEFAULT_COMPLAINT_KEYWORDS,
      encouragement: DEFAULT_ENCOURAGEMENT_KEYWORDS,
      negative: DEFAULT_NEGATIVE_KEYWORDS,
      question: DEFAULT_QUESTION_KEYWORDS
    }
  };
}

function parseKeywordList(rawValue, fallback) {
  if (!rawValue) {
    return Array.isArray(fallback) ? fallback : [];
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => sanitizeKeyword(entry)).filter(Boolean);
  }
  return rawValue
    .split(/[\n,]/)
    .map((entry) => sanitizeKeyword(entry))
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

function sanitizeKeyword(value) {
  if (!value) return '';
  return stripAccents(value.toString())
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

const THAI_TONE_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;

function stripAccents(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(THAI_TONE_MARKS, '');
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

function isQuestion(message) {
  if (!message) return false;
  return message.includes('?') || message.includes('ไหม') || message.includes('หรือ');
}

// ========== NEW: Content Type Detection ==========

function detectContentType(value) {
  const message = value.message || '';
  const attachments = value.attachments?.data || [];

  // Empty check
  if (!message && attachments.length === 0 && !value.sticker_id) {
    return 'empty';
  }

  // Check for sticker (Facebook doesn't send attachments for stickers, only absence of message)
  const hasSticker = value.sticker_id || (!message && attachments.length === 0);
  const hasPhoto = attachments.some(a => a.type === 'photo');
  const hasVideo = attachments.some(a => a.type === 'video');
  const hasGif = attachments.some(a => a.type === 'animated_image_share');
  const hasLink = attachments.some(a => a.type === 'share');

  // Mixed content (text + media)
  if (message && (hasSticker || hasPhoto || hasVideo || hasGif || hasLink)) {
    return 'mixed';
  }

  // Media only (no text)
  if (!message) {
    if (hasSticker) return 'sticker';
    if (hasPhoto) return 'photo';
    if (hasVideo) return 'video';
    if (hasGif) return 'gif';
    if (hasLink) return 'link';
    return 'unknown_media';
  }

  // Text only
  return 'text';
}

// ========== NEW: Intent Detection ==========

function detectIntent(contentType, message, keywords) {
  // No text = unknown intent
  if (!message || ['sticker', 'photo', 'video', 'gif', 'link'].includes(contentType)) {
    return 'unknown';
  }

  const normalized = normaliseText(message);

  // Priority order (highest to lowest)
  if (includesKeyword(normalized, keywords.negative)) {
    return 'negative';  // Must delete
  }
  if (includesKeyword(normalized, keywords.complaint)) {
    return 'complaint';
  }
  if (includesKeyword(normalized, keywords.encouragement)) {
    return 'encouragement';
  }
  if (includesKeyword(normalized, keywords.question) || isQuestion(message)) {
    return 'question';
  }

  return 'normal';
}

// ========== NEW: Route Decision ==========

function decideRoute(contentType, intent, config) {
  // Policy 1: Negative must be deleted
  if (intent === 'negative') {
    return 'fb_negative';
  }

  // Policy 2: Reply based on intent
  if (intent === 'complaint') return 'fb_complaint';
  if (intent === 'encouragement') return 'fb_encouragement';

  // Policy 3: Media-only comments
  if (contentType === 'sticker') {
    return config.replyToSticker ? 'fb_sticker' : 'log';
  }
  if (contentType === 'photo') {
    return config.replyToPhoto ? 'fb_photo' : 'log';
  }
  if (contentType === 'video') {
    return config.replyToVideo ? 'fb_video' : 'log';
  }

  // Policy 4: Questions
  if (intent === 'question') {
    return config.replyToQuestion ? 'fb_question' : 'log';
  }

  // Policy 5: Mixed content - intent takes priority
  if (contentType === 'mixed' && intent !== 'normal' && intent !== 'unknown') {
    return `fb_${intent}`;
  }

  // Policy 6: Normal text
  if (contentType === 'text' && intent === 'normal') {
    return config.replyToNormal ? 'fb_normal' : 'log';
  }

  // Default: log only
  return 'log';
}

// ========== Main Processing Loop ==========

for (const item of items) {
  const webhookUrl = (item.json.webhookUrl || '').replace(/\/webhook.*$/, '');
  const fallbackBase = ($env.WEBHOOK_URL || $env.N8N_ENDPOINT_URL || 'http://127.0.0.1:5678').replace(/\/$/, '');
  const baseUrl = (webhookUrl || fallbackBase).replace(/\/$/, '');
  const body = item.json.body ?? item.json;

  // ========== LINE Events Processing ==========
  if (body && Array.isArray(body.events)) {
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
        contentType: 'text',
        intent: 'unknown',
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

  // ========== Facebook Events Processing ==========
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

        // ========== NEW: Content & Intent Detection ==========
        const message = value.message || '';
        const contentType = detectContentType(value);
        const intent = detectIntent(contentType, message, pageConfig.keywords);

        const config = {
          replyToSticker: REPLY_TO_STICKER,
          replyToPhoto: REPLY_TO_PHOTO,
          replyToVideo: REPLY_TO_VIDEO,
          replyToQuestion: REPLY_TO_QUESTION,
          replyToNormal: REPLY_TO_NORMAL
        };

        const route = decideRoute(contentType, intent, config);

        // Sheet row data
        const sheetTimestamp = formatTimestamp((value.created_time || value.timestamp) ? (Number(value.created_time || value.timestamp) * 1000) : Date.now());
        const sheetRow = {
          sheetTimestamp,
          sheetPostId: value.post_id || '',
          sheetCommentId: value.comment_id,
          sheetUserName: value.sender_name || value.from?.name || '',
          sheetUserId: value.sender_id || value.from?.id || '',
          sheetOriginalComment: message || (contentType === 'sticker' ? '[sticker]' : contentType === 'photo' ? '[photo]' : contentType === 'video' ? '[video]' : '[media]'),
        };

        const commentUrl = buildCommentUrl(pageId, value.post_id, value.comment_id);

        // Determine reply message and status based on route
        let sheetType = `FB_${contentType.toUpperCase()}`;
        let sheetReplyMessage = '';
        let sheetStatus = 'FB_LOG';
        let replyMessage = '';
        let lineMessage = '';
        let stickerId = pageConfig.stickerId;

        const canAct = Boolean(pageConfig.pageAccessToken);
        const lineTargets = Array.isArray(pageConfig.lineTargetUserIds) ? pageConfig.lineTargetUserIds.filter(Boolean) : [];
        const lineToken = pageConfig.lineChannelAccessToken;
        const lineEnabled = Boolean(lineToken) && lineTargets.length > 0;

        // Build response based on route
        if (!canAct) {
          sheetStatus = 'SKIPPED: NO_PAGE_TOKEN';
        } else if (route === 'fb_negative') {
          sheetType = 'FB_NEGATIVE';
          sheetReplyMessage = '[delete comment]';
          sheetStatus = 'FB_NEGATIVE_DELETE';
          lineMessage = NOTIFY_NEGATIVE ? [
            `[Facebook] ลบคอมเมนต์ไม่เหมาะสมบนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            commentUrl ? `ลิงก์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        } else if (route === 'fb_complaint') {
          sheetType = 'FB_COMPLAINT';
          replyMessage = `ขอบคุณที่แจ้งเรื่องกับ ${pageConfig.pageName} ค่ะ หากต้องการแจ้งรายละเอียดเพิ่มเติมสามารถกรอกข้อมูลได้ที่ ${pageConfig.complaintUrl}`;
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_COMPLAINT_REPLY';
          lineMessage = NOTIFY_COMPLAINT ? [
            `[Facebook] มีการร้องทุกข์บนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            `ฟอร์มร้องทุกข์: ${pageConfig.complaintUrl}`,
            commentUrl ? `ลิงก์คอมเมนต์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        } else if (route === 'fb_encouragement') {
          sheetType = 'FB_ENCOURAGEMENT';
          replyMessage = 'ขอบคุณสำหรับกำลังใจที่มอบให้กันนะคะ ❤️';
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_ENCOURAGEMENT_REPLY';
          lineMessage = NOTIFY_ALL ? [
            `[Facebook] มีคอมเมนต์ให้กำลังใจบนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            commentUrl ? `ลิงก์คอมเมนต์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        } else if (route === 'fb_sticker') {
          sheetType = 'FB_STICKER';
          sheetReplyMessage = stickerId ? `Sticker ID ${stickerId}` : '';
          sheetStatus = 'FB_STICKER_REPLY';
          lineMessage = NOTIFY_ALL ? [
            `[Facebook] มีคอมเมนต์สติกเกอร์บนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            commentUrl ? `ลิงก์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        } else if (route === 'fb_question') {
          sheetType = 'FB_QUESTION';
          replyMessage = 'ขอบคุณสำหรับคำถามนะคะ ทีมงานจะตอบกลับให้เร็วที่สุดค่ะ 🙏';
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_QUESTION_REPLY';
          lineMessage = NOTIFY_QUESTION ? [
            `[Facebook] มีคำถามบนเพจ ${pageConfig.pageName} ⚠️`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `คำถาม: ${message}` : '',
            commentUrl ? `ลิงก์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        } else {
          sheetStatus = 'FB_LOG';
          sheetReplyMessage = '';
          lineMessage = NOTIFY_ALL ? [
            `[Facebook] คอมเมนต์ใหม่บนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            `ประเภท: ${contentType}`,
            message ? `ข้อความ: ${message}` : '',
            commentUrl ? `ลิงก์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        }

        const notifiedChannel = lineEnabled && lineMessage ? (lineTargets.length > 1 ? 'LINE(multicast)' : 'LINE(push)') : '';

        const output = {
          source: 'facebook',
          route,
          contentType,
          intent,
          sheetTimestamp,
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
          messageType: contentType === 'sticker' ? 'sticker' : contentType === 'photo' ? 'photo' : contentType === 'video' ? 'video' : 'text',
          facebook: {
            pageId,
            pageName: pageConfig.pageName,
            postId: value.post_id || '',
            commentId: value.comment_id,
            parentId: value.parent_id || '',
            commentUrl,
            pageAccessToken: pageConfig.pageAccessToken,
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
      sheetStatus: 'SKIPPED: UNKNOWN_PAYLOAD',
      contentType: 'unknown',
      intent: 'unknown'
    })
  });
}

return results;
