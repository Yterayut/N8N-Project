// Enhanced Code Node for n8n Workflow 3
// Supports: text, sticker, photo, video, gif, mixed, dedupe, multi-page
// Version: 3.0 (31 Oct 2025)

// ========== Configuration ==========
const items = $input.all();
const results = [];

const staticData = $getWorkflowStaticData('global');
if (!staticData.processedComments) staticData.processedComments = {};

const dedupeWindowMs = Number($env.FB_REPLY_DEDUPE_WINDOW_MS || 6 * 60 * 60 * 1000);
const now = Date.now();
if (!staticData.processedCommentsCleanup || now - staticData.processedCommentsCleanup > dedupeWindowMs) {
  for (const key of Object.keys(staticData.processedComments)) {
    if (now - staticData.processedComments[key] > dedupeWindowMs) {
      delete staticData.processedComments[key];
    }
  }
  staticData.processedCommentsCleanup = now;
}

const DEFAULT_COMPLAINT_URL = ($env.FB_COMPLAINT_FORM_URL || 'https://docs.google.com/forms').trim();
const DEFAULT_STICKER_ID = ($env.FB_POSITIVE_STICKER_ID || '369239343222814').trim();

const BASE_APP_ID = ($env.FB_APP_ID || '').trim();
const BASE_APP_SECRET = ($env.FB_APP_SECRET || '').trim();
const BASE_VERIFY_TOKEN = ($env.FB_VERIFY_TOKEN || '').trim();

// Response Policies
const REPLY_TO_STICKER = parseBoolean($env.FB_REPLY_TO_STICKER, true);
const REPLY_TO_PHOTO = parseBoolean($env.FB_REPLY_TO_PHOTO, false);
const REPLY_TO_VIDEO = parseBoolean($env.FB_REPLY_TO_VIDEO, false);
const REPLY_TO_QUESTION = parseBoolean($env.FB_REPLY_TO_QUESTION, false);
const REPLY_TO_NORMAL = parseBoolean($env.FB_REPLY_TO_NORMAL, false);

// Notification Policies
const NOTIFY_ALL = parseBoolean($env.FB_NOTIFY_ALL, false);
const NOTIFY_COMPLAINT = parseBoolean($env.FB_NOTIFY_COMPLAINT, true);
const NOTIFY_QUESTION = parseBoolean($env.FB_NOTIFY_QUESTION, true);
const NOTIFY_NEGATIVE = parseBoolean($env.FB_NOTIFY_NEGATIVE, true);

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

const LINE_ID_REGEX = /^U[0-9a-fA-F]{32}$/;

const BASE_PAGE_DEFINITIONS = [
  {
    pageId: '889083480945134',
    pageName: 'จ๊ะศรีกล้วยทอด'
  },
  {
    pageId: '840212645843493',
    pageName: 'ความสุขนักวิ่ง'
  },
  {
    pageId: '102450935821483',
    pageName: 'พชร จันทรรวงทอง'
  }
];

const pageConfigs = {};
for (const definition of BASE_PAGE_DEFINITIONS) {
  const cfg = createPageConfig(definition);
  pageConfigs[cfg.pageId] = cfg;
}

// ========== Helper Functions ==========

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalised = value.toString().trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalised)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalised)) return false;
  return fallback;
}

function createPageConfig({
  pageId,
  pageName,
  pageAccessToken,
  complaintUrl,
  stickerId,
  lineChannelAccessToken,
  lineTargetUserIds,
  appId,
  appSecret,
  verifyToken,
  active
}) {
  const envSuffix = pageId ? pageId.trim().replace(/[^0-9A-Z]+/gi, '_').toUpperCase() : '';

  let resolvedActive = active === undefined ? true : Boolean(active);
  if (envSuffix) {
    const envActiveKey = `FB_PAGE_ACTIVE_${envSuffix}`;
    if ($env[envActiveKey] !== undefined) {
      resolvedActive = parseBoolean($env[envActiveKey], resolvedActive);
    }
  }

  const basePageToken = ($env.FB_PAGE_ACCESS_TOKEN || '').trim();

  let resolvedPageAccessToken = (pageAccessToken || '').trim();
  if (envSuffix) {
    const envKey = `FB_PAGE_ACCESS_TOKEN_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedPageAccessToken = envValue;
    }
  }
  if (!resolvedPageAccessToken) {
    resolvedPageAccessToken = basePageToken;
  }

  let resolvedLineTargets = Array.isArray(lineTargetUserIds) ? lineTargetUserIds : parseIdList(lineTargetUserIds);
  if (envSuffix) {
    const envKey = `LINE_ALERT_USER_IDS_${envSuffix}`;
    const envValue = $env[envKey];
    if (envValue) {
      resolvedLineTargets = parseIdList(envValue);
    }
  }
  if (!resolvedLineTargets || resolvedLineTargets.length === 0) {
    resolvedLineTargets = parseIdList($env.LINE_ALERT_USER_IDS);
  }
  resolvedLineTargets = resolvedLineTargets
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter((id) => LINE_ID_REGEX.test(id));

  let resolvedLineToken = (lineChannelAccessToken || '').trim();
  if (envSuffix) {
    const envKey = `LINE_CHANNEL_ACCESS_TOKEN_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedLineToken = envValue;
    }
  }
  if (!resolvedLineToken) {
    resolvedLineToken = ($env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  }

  let resolvedComplaintUrl = (complaintUrl || '').trim();
  if (envSuffix) {
    const envKey = `FB_COMPLAINT_FORM_URL_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedComplaintUrl = envValue;
    }
  }
  if (!resolvedComplaintUrl) {
    resolvedComplaintUrl = DEFAULT_COMPLAINT_URL;
  }

  let resolvedStickerId = (stickerId || '').trim() || DEFAULT_STICKER_ID;
  if (envSuffix) {
    const envKey = `FB_POSITIVE_STICKER_ID_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedStickerId = envValue;
    }
  }

  let resolvedAppId = (appId || '').trim();
  if (envSuffix) {
    const envKey = `FB_APP_ID_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedAppId = envValue;
    }
  }
  if (!resolvedAppId) {
    resolvedAppId = BASE_APP_ID;
  }

  let resolvedAppSecret = (appSecret || '').trim();
  if (envSuffix) {
    const envKey = `FB_APP_SECRET_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedAppSecret = envValue;
    }
  }
  if (!resolvedAppSecret) {
    resolvedAppSecret = BASE_APP_SECRET;
  }

  let resolvedVerifyToken = (verifyToken || '').trim();
  if (envSuffix) {
    const envKey = `FB_VERIFY_TOKEN_${envSuffix}`;
    const envValue = ($env[envKey] || '').trim();
    if (envValue) {
      resolvedVerifyToken = envValue;
    }
  }
  if (!resolvedVerifyToken) {
    resolvedVerifyToken = BASE_VERIFY_TOKEN;
  }

  const resolvedPageName = (pageName || '').trim() || pageId;

  return {
    pageId,
    pageName: resolvedPageName,
    pageAccessToken: resolvedPageAccessToken,
    complaintUrl: resolvedComplaintUrl,
    stickerId: resolvedStickerId,
    lineChannelAccessToken: resolvedLineToken,
    lineTargetUserIds: resolvedLineTargets,
    appId: resolvedAppId,
    appSecret: resolvedAppSecret,
    verifyToken: resolvedVerifyToken,
    active: resolvedActive,
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
    return Array.isArray(fallback) ? fallback.map((entry) => sanitizeKeyword(entry)).filter(Boolean) : [];
  }
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => sanitizeKeyword(entry)).filter(Boolean);
  }
  return rawValue
    .toString()
    .split(/[\n,]/)
    .map((entry) => sanitizeKeyword(entry))
    .filter(Boolean);
}

function parseIdList(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue.map((entry) => entry.toString().trim()).filter(Boolean);
  return rawValue
    .toString()
    .split(/[\n,]/)
    .map((entry) => entry.toString().trim())
    .filter(Boolean);
}

function sanitizeKeyword(value) {
  if (!value) return '';
  return stripAccents(value.toString())
    .replace(/^["']+|["']+$/g, '')
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

function isQuestion(message) {
  if (!message) return false;
  return message.includes('?') || message.includes('ไหม') || message.includes('หรือ');
}

// ========== Content & Intent Detection ==========

function detectContentType(value) {
  const message = value.message || '';
  const attachments = value.attachments?.data || [];

  if (!message && attachments.length === 0 && !value.sticker_id) {
    return 'empty';
  }

  const hasSticker = value.sticker_id || (!message && attachments.length === 0);
  const hasPhoto = attachments.some((a) => a.type === 'photo');
  const hasVideo = attachments.some((a) => a.type === 'video');
  const hasGif = attachments.some((a) => a.type === 'animated_image_share');
  const hasLink = attachments.some((a) => a.type === 'share');

  if (message && (hasSticker || hasPhoto || hasVideo || hasGif || hasLink)) {
    return 'mixed';
  }

  if (!message) {
    if (hasSticker) return 'sticker';
    if (hasPhoto) return 'photo';
    if (hasVideo) return 'video';
    if (hasGif) return 'gif';
    if (hasLink) return 'link';
    return 'unknown_media';
  }

  return 'text';
}

function detectIntent(contentType, message, keywords) {
  if (!message || ['sticker', 'photo', 'video', 'gif', 'link'].includes(contentType)) {
    return 'unknown';
  }

  const normalized = normaliseText(message);

  if (includesKeyword(normalized, keywords.negative)) {
    return 'negative';
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

function decideRoute(contentType, intent, policy) {
  if (intent === 'negative') {
    return 'fb_negative';
  }
  if (intent === 'complaint') return 'fb_complaint';
  if (intent === 'encouragement') return 'fb_encouragement';

  if (contentType === 'sticker') {
    return policy.replyToSticker ? 'fb_sticker' : 'log';
  }
  if (contentType === 'photo') {
    return policy.replyToPhoto ? 'fb_photo' : 'log';
  }
  if (contentType === 'video') {
    return policy.replyToVideo ? 'fb_video' : 'log';
  }
  if (intent === 'question') {
    return policy.replyToQuestion ? 'fb_question' : 'log';
  }

  if (contentType === 'mixed' && intent !== 'normal' && intent !== 'unknown') {
    return `fb_${intent}`;
  }

  if (contentType === 'text' && intent === 'normal') {
    return policy.replyToNormal ? 'fb_normal' : 'log';
  }

  return 'log';
}

// ========== Main Processing Loop ==========

for (const item of items) {
  const webhookUrl = (item.json.webhookUrl || '').replace(/\/webhook.*$/, '');
  const fallbackBase = ($env.WEBHOOK_URL || $env.N8N_ENDPOINT_URL || 'http://127.0.0.1:5678').replace(/\/$/, '');
  const baseUrl = (webhookUrl || fallbackBase).replace(/\/$/, '');
  const body = item.json.body ?? item.json;

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
        sheetPageId: '',
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
      if (!pageId) {
        continue;
      }

      const pageConfig = pageConfigs[pageId] || createPageConfig({ pageId });
      pageConfigs[pageId] = pageConfig;

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
        const contentType = detectContentType(value);
        const intent = detectIntent(contentType, message, pageConfig.keywords);

        const policy = {
          replyToSticker: REPLY_TO_STICKER,
          replyToPhoto: REPLY_TO_PHOTO,
          replyToVideo: REPLY_TO_VIDEO,
          replyToQuestion: REPLY_TO_QUESTION,
          replyToNormal: REPLY_TO_NORMAL
        };

        let route = decideRoute(contentType, intent, policy);

        const sheetTimestamp = formatTimestamp((value.created_time || value.timestamp) ? (Number(value.created_time || value.timestamp) * 1000) : Date.now());
        const sheetRow = {
          sheetTimestamp,
          sheetPageId: pageId,
          sheetPostId: value.post_id || '',
          sheetCommentId: value.comment_id,
          sheetUserName: value.sender_name || value.from?.name || '',
          sheetUserId: value.sender_id || value.from?.id || '',
          sheetOriginalComment: message || (contentType === 'sticker' ? '[sticker]' : contentType === 'photo' ? '[photo]' : contentType === 'video' ? '[video]' : '[media]')
        };

        const commentUrl = buildCommentUrl(pageId, value.post_id, value.comment_id);

        const dedupeKey = value.comment_id ? `${pageId}_${value.comment_id}` : `${pageId}_${value.comment_id || ''}`;
        const lastProcessedAt = staticData.processedComments[dedupeKey];
        const isDuplicate = Boolean(lastProcessedAt && (now - lastProcessedAt) < dedupeWindowMs);
        if (!isDuplicate) {
          staticData.processedComments[dedupeKey] = now;
        }

        const isSelfComment = Boolean(
          (value.sender_id && value.sender_id === pageId) ||
          (value.from?.id && value.from.id === pageId)
        );

        let sheetType = `FB_${contentType.toUpperCase()}`;
        let sheetReplyMessage = '';
        let sheetStatus = 'FB_LOG';
        let replyMessage = '';
        let lineMessage = '';
        const stickerId = pageConfig.stickerId;

        const hasPageToken = Boolean(pageConfig.pageAccessToken);
        const lineTargets = Array.isArray(pageConfig.lineTargetUserIds) ? pageConfig.lineTargetUserIds : [];
        const lineToken = pageConfig.lineChannelAccessToken;
        const lineEnabled = Boolean(lineToken) && lineTargets.length > 0 && !isSelfComment && !isDuplicate;

        if (!pageConfig.active) {
          route = 'log';
          sheetType = 'FB_DISABLED';
          sheetStatus = 'SKIPPED: PAGE_DISABLED';
        } else if (isSelfComment) {
          route = 'log';
          sheetType = 'FB_SELF_COMMENT';
          sheetStatus = 'SKIPPED: SELF_COMMENT';
        } else if (isDuplicate) {
          route = 'log';
          sheetType = 'FB_DUPLICATE';
          sheetStatus = 'SKIPPED: DUPLICATE_COMMENT';
        } else if (!hasPageToken) {
          route = 'log';
          sheetType = `FB_${contentType.toUpperCase()}`;
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
          lineMessage = (NOTIFY_ALL || parseBoolean($env.FB_NOTIFY_ENCOURAGEMENT, false)) ? [
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
        } else if (route === 'fb_normal') {
          sheetType = 'FB_NORMAL';
          replyMessage = 'ขอบคุณสำหรับข้อความจากคุณนะคะ หากต้องการข้อมูลเพิ่มเติมแจ้งเราได้เลยค่ะ 🙏';
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_NORMAL_REPLY';
          lineMessage = NOTIFY_ALL ? [
            `[Facebook] คอมเมนต์ใหม่บนเพจ ${pageConfig.pageName}`,
            sheetRow.sheetUserName ? `ผู้ใช้: ${sheetRow.sheetUserName}` : '',
            message ? `ข้อความ: ${message}` : '',
            commentUrl ? `ลิงก์คอมเมนต์: ${commentUrl}` : ''
          ].filter(Boolean).join('\n') : '';
        } else {
          sheetType = `FB_${contentType.toUpperCase()}`;
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
          message,
          messageType: contentType === 'sticker' ? 'sticker' : contentType === 'photo' ? 'photo' : contentType === 'video' ? 'video' : 'text',
          facebook: {
            pageId,
            pageName: pageConfig.pageName,
            postId: value.post_id || '',
            commentId: value.comment_id,
            parentId: value.parent_id || '',
            commentUrl,
            pageAccessToken: pageConfig.pageAccessToken,
            appId: pageConfig.appId || BASE_APP_ID,
            appSecret: pageConfig.appSecret || BASE_APP_SECRET,
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
