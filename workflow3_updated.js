// Process incoming webhook events from LINE and Facebook Pages and fan out actions
const items = $input.all();
const results = [];

let fs;
let path;
let os;
let fetchFn = typeof fetch === 'function' ? fetch : null;
let LOCK_DIR = null;

try {
  fs = require('fs');
  path = require('path');
  os = require('os');
  const resolvedLockDir = ($env.FB_REPLY_LOCK_DIR || path.join(os.tmpdir(), 'n8n-fb-reply-locks')).trim();
  LOCK_DIR = resolvedLockDir ? resolvedLockDir : null;
  if (!fetchFn && typeof fetch === 'function') {
    fetchFn = fetch;
  }
} catch (error) {
  fs = null;
  path = null;
  os = null;
  if (!fetchFn && typeof fetch === 'function') {
    fetchFn = fetch;
  }
  LOCK_DIR = null;
}

const LOCKS_ENABLED = Boolean(fs && path && os && LOCK_DIR);

const GRAPH_API_VERSION = ($env.FB_GRAPH_API_VERSION || 'v19.0').replace(/^v?/i, 'v');
const GRAPH_TIMEOUT_MS = Number($env.FB_GRAPH_TIMEOUT_MS || 5000);
const SKIP_FACEBOOK_API = ['true', '1', 'yes', 'y', 'on'].includes(
  String($env.WORKFLOW3_SKIP_FACEBOOK_API || '').trim().toLowerCase()
);

function parseDelaySeconds(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return fallback;
  }
  return num;
}

const LINE_MESSAGE_MAX_LENGTH = Number($env.WORKFLOW3_LINE_MESSAGE_MAX_LENGTH || 180);
const OWNER_USER_IDS = new Set(
  ($env.FB_OWNER_USER_IDS || '')
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const DEFAULT_DELAYS = Object.freeze({
  like: parseDelaySeconds($env.WORKFLOW3_LIKE_DELAY_SECONDS, 0),
  reply: parseDelaySeconds($env.WORKFLOW3_REPLY_DELAY_SECONDS, 0),
  line: parseDelaySeconds($env.WORKFLOW3_LINE_DELAY_SECONDS, 0),
  sheet: parseDelaySeconds($env.WORKFLOW3_SHEET_DELAY_SECONDS, 0)
});

const QUERY_MISSING_USER_INFO = ['true', '1', 'yes', 'y', 'on'].includes(
  String($env.WORKFLOW3_QUERY_MISSING_USER_INFO || '').trim().toLowerCase()
);

function cloneDelays() {
  return {
    like: DEFAULT_DELAYS.like,
    reply: DEFAULT_DELAYS.reply,
    line: DEFAULT_DELAYS.line,
    sheet: DEFAULT_DELAYS.sheet
  };
}

async function httpRequest(options = {}) {
  if (this?.helpers?.httpRequest) {
    return this.helpers.httpRequest(options);
  }

  if (!fetchFn) {
    if (typeof $httpRequest === 'function') {
      return $httpRequest(options);
    }
    throw new Error('HTTP helper is not available in this context');
  }

  const method = (options.method || 'GET').toUpperCase();
  const url = new URL(options.url);
  const headers = Object.assign({}, options.headers || {});

  if (options.qs && typeof options.qs === 'object') {
    for (const [key, value] of Object.entries(options.qs)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const entry of value) {
          url.searchParams.append(key, entry != null ? String(entry) : '');
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof Buffer) && typeof body !== 'string') {
    body = JSON.stringify(body);
    if (!headers['content-type'] && !headers['Content-Type']) {
      headers['content-type'] = 'application/json';
    }
  }

  let controller = null;
  let timeoutId = null;
  if (Number.isFinite(options.timeout) && options.timeout > 0) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), options.timeout);
  }

  try {
    const response = await fetchFn(url.toString(), {
      method,
      headers,
      body,
      signal: controller?.signal
    });

    if (timeoutId) clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => ({}));
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
      error.statusCode = response.status;
      error.body = data;
      throw error;
    }

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      body: data
    };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

function ensureLockDir() {
  if (!LOCKS_ENABLED) return;
  try {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      throw error;
    }
  }
}

function cleanupLockDir(maxAgeMs, referenceTs) {
  if (!LOCKS_ENABLED) return;
  try {
    ensureLockDir();
    const entries = fs.readdirSync(LOCK_DIR);
    for (const entry of entries) {
      const filePath = path.join(LOCK_DIR, entry);
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (!stats.isFile()) continue;
      const mtime = stats.mtimeMs || stats.ctimeMs || 0;
      if (!mtime || isNaN(mtime) || (referenceTs - mtime) > maxAgeMs) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  } catch {
    // ignore lock cleanup errors
  }
}

function toLockPath(key) {
  if (!LOCKS_ENABLED) return '';
  const safe = (key || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(LOCK_DIR, `${safe}.lock`);
}

function acquireReplyLock(key, payload) {
  if (!LOCKS_ENABLED) {
    return { ok: true, reason: 'locks_disabled' };
  }
  if (!key) {
    return { ok: false, reason: 'missing_key' };
  }
  try {
    ensureLockDir();
  } catch (error) {
    return {
      ok: false,
      reason: 'mkdir_failed',
      error: error?.message || String(error)
    };
  }

  const lockPath = toLockPath(key);
  const body = JSON.stringify({
    key,
    executionId: $execution.id,
    createdAt: Date.now(),
    payload: payload || {}
  });

  try {
    const fd = fs.openSync(lockPath, 'wx');
    try {
      fs.writeFileSync(fd, body, { encoding: 'utf8' });
    } finally {
      fs.closeSync(fd);
    }
    return { ok: true, path: lockPath };
  } catch (error) {
    if (error?.code === 'EEXIST') {
      return { ok: false, reason: 'exists', path: lockPath };
    }
    return {
      ok: false,
      reason: error?.code || 'lock_error',
      error: error?.message || String(error)
    };
  }
}

async function getReplyStatus(pageId, commentId, accessToken) {
  if (!pageId || !commentId || !accessToken) {
    return { alreadyReplied: false };
  }
  if (SKIP_FACEBOOK_API) {
    return { alreadyReplied: false, skipped: true };
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(commentId)}/comments`;
  try {
    const response = await httpRequest.call(this, {
      method: 'GET',
      url,
      qs: {
        access_token: accessToken,
        filter: 'stream',
        fields: 'from{id}',
        limit: 100
      },
      timeout: GRAPH_TIMEOUT_MS
    });

    const data = Array.isArray(response?.data) ? response.data : [];
    return {
      alreadyReplied: data.some((entry) => entry?.from?.id === pageId),
      dataCount: data.length
    };
  } catch (error) {
    return {
      alreadyReplied: false,
      error: {
        message: error?.message || 'Graph API lookup failed',
        name: error?.name || 'GraphLookupError',
        statusCode: error?.statusCode
      }
    };
  }
}

let staticData;
if (typeof $getWorkflowStaticData === 'function') {
  staticData = $getWorkflowStaticData('global');
} else if (this && typeof this.getWorkflowStaticData === 'function') {
  staticData = this.getWorkflowStaticData('global');
} else if (this?.helpers?.getWorkflowStaticData) {
  staticData = this.helpers.getWorkflowStaticData('global');
} else {
  staticData = {};
}
if (!staticData.processedComments) staticData.processedComments = {};
const processedInExecution = new Set();
let staticDataChanged = false;
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
      staticDataChanged = true;
    }
  }
  staticData.processedCommentsCleanup = now;
  staticDataChanged = true;
}
cleanupLockDir(dedupeWindowMs, now);

const THAI_TONE_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;
const LINE_ID_REGEX = /^U[0-9a-fA-F]{32}$/;
const WHOLE_WORD_SEPARATOR_REGEX = /[\s~!@#$%^&*()_+\-=\[\]{};:'",.<>/?|\\฿ๆฯ…、。！？]/;
const RAW_NEGATIVE_SUFFIX_TRIMS = [
  'สุดๆ',
  'ที่สุด',
  'มากๆ',
  'จริงๆ',
  'ฝุดๆ',
  'ๆ',
  'สุด',
  'มาก',
  'จริง',
  'จัด',
  'จัง',
  'เลย',
  'หนัก',
  'โคตร',
  'โครต',
  'เวอร์',
  'เว่อ',
  'ฝุด',
  'แบบนี้',
  'แบบนี',
  'แบบน',
  'มั้ย',
  'ไหม',
  'มัย',
  'มั้ง',
  'ป่าว',
  'เปล่า',
  'หรือเปล่า'
];
const NEGATIVE_SUFFIX_TRIMS = RAW_NEGATIVE_SUFFIX_TRIMS.map((entry) => sanitizeKeyword(entry)).filter(Boolean);

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

function includesWholeWordKeyword(normalisedText, keywords) {
  if (!normalisedText) return false;
  if (!Array.isArray(keywords) || !keywords.length) return false;

  const keywordSet = new Set(keywords.filter(Boolean));
  if (!keywordSet.size) {
    return false;
  }

  const tokens = normalisedText
    .replace(/\u200B/g, ' ')
    .split(WHOLE_WORD_SEPARATOR_REGEX)
    .filter(Boolean);

  if (!tokens.length) {
    return false;
  }

  return tokens.some((token) => {
    if (keywordSet.has(token)) {
      return true;
    }
    const trimmed = trimNegativeSuffix(token);
    return trimmed !== token && keywordSet.has(trimmed);
  });
}

function trimNegativeSuffix(token) {
  let result = token;
  let mutated = true;

  while (mutated && result) {
    mutated = false;
    for (const suffix of NEGATIVE_SUFFIX_TRIMS) {
      if (result.length > suffix.length && result.endsWith(suffix)) {
        result = result.slice(0, -suffix.length);
        mutated = true;
        break;
      }
    }
  }

  return result;
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
  'พลังบวก',
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
  'เยี่ยมมาก'
]);

const DEFAULT_ENCOURAGEMENT_REPLIES = [
  'ขอบคุณสำหรับกำลังใจที่มอบให้กันนะคะ ❤️',
  'ซาบซึ้งในกำลังใจมากๆ เลยค่ะ ขอบคุณนะคะ 💖',
  'ขอบคุณจากใจเลยค่ะ ทีมงานจะสู้ต่อไปนะคะ 💪',
  'ขอบคุณค่า ส่งกำลังใจกลับไปให้เช่นกันค่ะ 🤍'
];

const DEFAULT_ALERT_KEYWORDS = parseKeywordList($env.FB_ALERT_KEYWORDS, [
  'ร้องเรียน',
  'ตำหนิ',
  'ผิดพลาด',
  'ฝากดู',
  'ช่วยเหลือ'
]);

const EVENT_PRIORITY = ['blessing', 'funeral', 'wedding', 'birthday'];

const EVENT_RULE_TEMPLATES = {
  blessing: {
    envKey: 'BLESSING',
    displayName: 'งานบุญ/งานบวช',
    sheetType: 'FB_EVENT_BLESSING',
    sheetStatus: 'FB_EVENT_BLESSING_REPLY',
    defaultKeywords: [
      'งานบุญ',
      'งานบวช',
      'บวช',
      'บวชพระ',
      'ทำบุญ',
      'ร่วมบุญ',
      'ตักบาตร',
      'โมทนา',
      'อนุโมทนา',
      'สาธุ',
      'กุลบุตร',
      'ขอพร'
    ],
    defaultReplies: [
      'ขอบคุณที่ร่วมโมทนาบุญด้วยกันนะครับ ขอให้กุศลนี้ส่งผลดีถึงคุณและครอบครัวครับ 🙏',
      'ขอบคุณที่ร่วมยินดีกับงานบวชครับ ขอให้ได้รับพรดีๆ กลับไปเช่นกันครับ 😊',
      'ซาบซึ้งสำหรับคำอวยพรในงานบุญครั้งนี้มากครับ ขอให้บุญส่งผลดีคืนกลับนะครับ'
    ]
  },
  funeral: {
    envKey: 'FUNERAL',
    displayName: 'งานศพ',
    sheetType: 'FB_EVENT_FUNERAL',
    sheetStatus: 'FB_EVENT_FUNERAL_ACK',
    defaultKeywords: [
      'งานศพ',
      'ไว้อาลัย',
      'เสียใจ',
      'เสียชีวิต',
      'จากไป',
      'ขอแสดงความเสียใจ',
      'อาลัย',
      'สูญเสีย',
      'ขอให้ไปสู่สุคติ',
      'ขอเป็นกำลังใจ'
    ],
    defaultReplies: [
      'ขอบคุณที่ร่วมไว้อาลัยและส่งกำลังใจมาให้นะครับ ครอบครัวรู้สึกอบอุ่นมากจริงๆ 🖤',
      'ขอบคุณที่ร่วมแสดงความเสียใจด้วยครับ เราจะเก็บคำปลอบโยนนี้ไว้เป็นพลังใจครับ',
      'ซาบซึ้งกับกำลังใจในช่วงเวลาแห่งการสูญเสียครับ ขอบคุณมากนะครับ'
    ]
  },
  wedding: {
    envKey: 'WEDDING',
    displayName: 'งานแต่งงาน',
    sheetType: 'FB_EVENT_WEDDING',
    sheetStatus: 'FB_EVENT_WEDDING_REPLY',
    defaultKeywords: [
      'งานแต่ง',
      'แต่งงาน',
      'วิวาห์',
      'คู่บ่าวสาว',
      'เจ้าบ่าว',
      'เจ้าสาว',
      'ยินดีกับรัก',
      'ขอให้รักกัน',
      'ชีวิตคู่',
      'พิธีแต่ง'
    ],
    defaultReplies: [
      'ขอบคุณที่ร่วมยินดีกับคู่บ่าวสาวนะครับ ขอให้พลังดีๆ ที่ส่งมา กลับไปหาคุณเช่นกันครับ 💐',
      'ซาบซึ้งกับคำอวยพรงานแต่งมากครับ จะเก็บไว้เป็นกำลังใจในทุกวันของชีวิตคู่ครับ',
      'ขอบคุณที่ร่วมแสดงความยินดีกับเราในวันสำคัญครับ ขอให้ความรักอบอุ่นกับคุณเช่นกันครับ'
    ]
  },
  birthday: {
    envKey: 'BIRTHDAY',
    displayName: 'วันเกิดเจ้าของเพจ',
    sheetType: 'FB_EVENT_BIRTHDAY',
    sheetStatus: 'FB_EVENT_BIRTHDAY_REPLY',
    defaultKeywords: [
      'สุขสันต์วันเกิด',
      'hbd',
      'แฮปปี้เบิร์ธเดย์',
      'วันเกิด',
      'ขอให้สุขภาพดี',
      'birthday',
      'happy birthday',
      'อายุยืน',
      'กินเค้ก',
      'เป่าเค้ก'
    ],
    defaultReplies: [
      'ขอบคุณสำหรับคำอวยพรวันเกิดนะครับ ซาบซึ้งมากๆ จะเก็บไว้เป็นแรงบันดาลใจครับ 🎉',
      'ขอบคุณที่ร่วมฉลองวันเกิดกับเรานะครับ ขอให้คุณได้รับความสุขกลับไปหลายเท่าครับ',
      'ซึ้งใจในคำอวยพรวันเกิดทุกคำเลยครับ ขอให้พรดีๆ กลับไปหาคุณเช่นกันครับ'
    ]
  }
};

function buildEventRules() {
  const rules = [];
  for (const key of EVENT_PRIORITY) {
    const template = EVENT_RULE_TEMPLATES[key];
    if (!template) continue;
    const keywordEnvKey = `FB_EVENT_KEYWORDS_${template.envKey}`;
    const replyEnvKey = `FB_EVENT_REPLIES_${template.envKey}`;
    const keywords = parseKeywordList($env[keywordEnvKey], template.defaultKeywords);
    const replies = parseReplyList($env[replyEnvKey], template.defaultReplies);
    rules.push({
      key,
      displayName: template.displayName,
      sheetType: template.sheetType,
      sheetStatus: template.sheetStatus,
      keywords,
      replies
    });
  }
  return rules;
}

const EVENT_RULES = buildEventRules();

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

function getConfigCachePath() {
  if (!path) return '';
  const customPath = ($env.WORKFLOW3_CONFIG_CACHE_PATH || '').trim();
  if (customPath) {
    return customPath.endsWith('.json') ? customPath : path.join(customPath, 'keywords.json');
  }
  const userFolder = ($env.N8N_USER_FOLDER || '').trim();
  const baseDir = userFolder || path.join(process.cwd(), '.n8n-dev');
  const primaryDir = path.join(baseDir, 'config-cache');
  return path.join(primaryDir, 'keywords.json');
}

function loadConfigCache() {
  if (!fs || !path) return null;
  const cachePath = getConfigCachePath();
  try {
    if (!cachePath || !fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, 'utf8');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function extractReplyTexts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => (entry && entry.text !== undefined ? entry.text : entry))
    .map((entry) => (entry == null ? '' : entry.toString().trim()))
    .filter(Boolean);
}

function resolveCacheKeywords(cacheOverrides, key, fallback) {
  if (!cacheOverrides || !cacheOverrides.keywords) {
    return parseKeywordList(fallback, fallback);
  }
  const override = cacheOverrides.keywords[key];
  if (override && Array.isArray(override) && override.length) {
    return parseKeywordList(override, fallback);
  }
  return parseKeywordList(fallback, fallback);
}

function resolveCacheReplies(cacheOverrides, key, fallback) {
  if (!cacheOverrides || !cacheOverrides.replies) {
    return parseReplyList(fallback, fallback);
  }
  const override = cacheOverrides.replies[key];
  const texts = extractReplyTexts(override);
  if (texts.length) {
    return parseReplyList(texts, fallback);
  }
  return parseReplyList(fallback, fallback);
}

const CONFIG_CACHE = loadConfigCache();
const CACHE_PAGE_OVERRIDES = (CONFIG_CACHE && CONFIG_CACHE.pageOverrides) ? CONFIG_CACHE.pageOverrides : {};
const CACHE_EVENT_KEY_MAP = {
  event_blessing: 'blessing',
  event_funeral: 'funeral',
  event_wedding: 'wedding',
  event_birthday: 'birthday'
};

const pageConfigs = {
  '889083480945134': createPageConfig({
    pageId: '889083480945134',
    pageName: 'จ๊ะศรีกล้วยทอด',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN_889083480945134 || $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: $env.FB_COMPLAINT_FORM_URL_889083480945134 || DEFAULT_COMPLAINT_URL,
    stickerId: $env.FB_POSITIVE_STICKER_ID_889083480945134 || DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN_889083480945134 || $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS_889083480945134)
  }),
  '840212645843493': createPageConfig({
    pageId: '840212645843493',
    pageName: 'ความสุขนักวิ่ง',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN_840212645843493 || $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: $env.FB_COMPLAINT_FORM_URL_840212645843493 || DEFAULT_COMPLAINT_URL,
    stickerId: $env.FB_POSITIVE_STICKER_ID_840212645843493 || DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN_840212645843493 || $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS_840212645843493)
  }),
  '102450935821483': createPageConfig({
    pageId: '102450935821483',
    pageName: 'พชร จันทรวงทอง',
    pageAccessToken: $env.FB_PAGE_ACCESS_TOKEN_102450935821483 || $env.FB_PAGE_ACCESS_TOKEN || '',
    complaintUrl: $env.FB_COMPLAINT_FORM_URL_102450935821483 || DEFAULT_COMPLAINT_URL,
    stickerId: $env.FB_POSITIVE_STICKER_ID_102450935821483 || DEFAULT_STICKER_ID,
    lineChannelAccessToken: $env.LINE_CHANNEL_ACCESS_TOKEN_102450935821483 || $env.LINE_CHANNEL_ACCESS_TOKEN || '',
    lineTargetUserIds: parseIdList($env.LINE_ALERT_USER_IDS_102450935821483)
  })
};

function isPageActive(pageId) {
  const envValue = $env[`FB_PAGE_ACTIVE_${pageId}`];
  if (envValue === undefined || envValue === null) {
    return true;
  }
  const normalized = envValue.toString().trim().toLowerCase();
  return !['false', '0', 'off', 'no', 'disabled'].includes(normalized);
}

function createPageConfig({ pageId, pageName, pageAccessToken, complaintUrl, stickerId, lineChannelAccessToken, lineTargetUserIds, appId, appSecret, verifyToken }) {
  const envSuffix = pageId ? pageId.trim().replace(/[^0-9A-Z]+/gi, '_').toUpperCase() : '';
  const cacheOverrides = pageId && CACHE_PAGE_OVERRIDES ? CACHE_PAGE_OVERRIDES[pageId] : null;
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

  const resolvedLineTargetUserIds = resolveLineTargetUserIds(lineTargetUserIds, envSuffix);

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
  resolvedEncouragementReplies = resolveCacheReplies(cacheOverrides, 'encouragement', resolvedEncouragementReplies);

  const resolvedStickerReplies = resolveCacheReplies(cacheOverrides, 'sticker', resolvedEncouragementReplies);
  const resolvedComplaintReplies = resolveCacheReplies(cacheOverrides, 'complaint', []);
  const resolvedAlertReplies = resolveCacheReplies(cacheOverrides, 'alert', []);

  const keywordOverrides = {
    complaint: resolveCacheKeywords(cacheOverrides, 'complaint', DEFAULT_COMPLAINT_KEYWORDS),
    encouragement: resolveCacheKeywords(cacheOverrides, 'encouragement', DEFAULT_ENCOURAGEMENT_KEYWORDS),
    negative: resolveCacheKeywords(cacheOverrides, 'negative', DEFAULT_NEGATIVE_KEYWORDS),
    alert: resolveCacheKeywords(cacheOverrides, 'alert', DEFAULT_ALERT_KEYWORDS)
  };

  const eventRules = EVENT_RULES.map((rule) => {
    if (!cacheOverrides || !cacheOverrides.keywords || !cacheOverrides.replies) {
      return rule;
    }
    const cacheKey = Object.keys(CACHE_EVENT_KEY_MAP).find((key) => CACHE_EVENT_KEY_MAP[key] === rule.key);
    if (!cacheKey) return rule;
    const overrideKeywords = cacheOverrides.keywords[cacheKey];
    const overrideReplies = cacheOverrides.replies[cacheKey];
    const merged = { ...rule };
    if (overrideKeywords && Array.isArray(overrideKeywords) && overrideKeywords.length) {
      merged.keywords = parseKeywordList(overrideKeywords, rule.keywords || []);
    }
    const replyTexts = extractReplyTexts(overrideReplies);
    if (replyTexts.length) {
      merged.replies = parseReplyList(replyTexts, rule.replies || []);
    }
    return merged;
  });

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
    lineTargetUserIds: resolvedLineTargetUserIds,
    encouragementReplies: resolvedEncouragementReplies,
    replies: {
      encouragement: resolvedEncouragementReplies,
      sticker: resolvedStickerReplies,
      complaint: resolvedComplaintReplies,
      alert: resolvedAlertReplies
    },
    keywords: keywordOverrides,
    eventRules
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
  if (Array.isArray(rawValue)) {
    return rawValue.map((entry) => entry.toString().trim()).filter(Boolean);
  }

  const text = rawValue.toString().replace(/\r/g, '\n');
  const results = [];
  let buffer = '';

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) {
      results.push(trimmed);
    }
    buffer = '';
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '\n' || char === ',') {
      flush();
    } else {
      buffer += char;
    }
  }

  flush();
  return results;
}

function truncateLineText(text = '', maxLength = LINE_MESSAGE_MAX_LENGTH) {
  if (!text) return '';
  const clean = text.toString().trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildLineMessage({
  label = '',
  timestamp = '',
  pageName = '',
  userName = '',
  userId = '',
  message = '',
  extras = [],
  commentUrl = ''
} = {}) {
  const lines = [];
  if (label) {
    lines.push(`[Facebook | ${label}]`);
  }
  if (timestamp) {
    lines.push(`เวลา: ${timestamp}`);
  }
  if (pageName) {
    lines.push(`เพจ: ${pageName}`);
  }
  if (userName) {
    lines.push(`ผู้ใช้: ${userName}${userId ? ` (${userId})` : ''}`);
  }
  if (message) {
    lines.push(`ข้อความ: ${truncateLineText(message)}`);
  }
  if (Array.isArray(extras) && extras.length) {
    for (const extra of extras) {
      if (extra) {
        lines.push(extra);
      }
    }
  }
  if (commentUrl) {
    lines.push(`ลิงก์: ${commentUrl}`);
  }
  return lines.join('\n');
}

function resolveLineTargetUserIds(explicitList, envSuffix) {
  const merged = [];
  const seen = new Set();

  const addIds = (list) => {
    if (!list || !list.length) return;
    for (const id of list) {
      const trimmed = typeof id === 'string' ? id.trim() : '';
      if (trimmed && LINE_ID_REGEX.test(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        merged.push(trimmed);
      }
    }
  };

  addIds(parseIdList($env.LINE_ALERT_USER_IDS));

  if (envSuffix) {
    const envKey = `LINE_ALERT_USER_IDS_${envSuffix}`;
    addIds(parseIdList($env[envKey]));
  }

  if (explicitList) {
    addIds(Array.isArray(explicitList) ? explicitList : parseIdList(explicitList));
  }

  return merged;
}

function pickRandom(list, fallback = '') {
  if (Array.isArray(list) && list.length) {
    return list[Math.floor(Math.random() * list.length)];
  }
  return fallback;
}

function findEventRule(message, rules = EVENT_RULES) {
  if (!message) return null;
  const normalised = normaliseText(message);
  if (!normalised) return null;
  for (const rule of rules) {
    if (!Array.isArray(rule.keywords) || !rule.keywords.length) continue;
    if (rule.keywords.some((keyword) => keyword && normalised.includes(keyword))) {
      return rule;
    }
  }
  return null;
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

function isStickerComment(value = {}, message = '', attachments = []) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  if (!value) value = {};
  if (value.sticker_id) {
    return true;
  }
  if (safeAttachments.some((att) => att?.type === 'sticker' || att?.media?.sticker_id)) {
    return true;
  }
  const text = (message || '').trim();
  const stickerLikeTypes = new Set(['sticker', 'animated_image_share', 'animated_image_autoplay', 'gif', 'emoji']);
  const hasStickerLikeAttachment = safeAttachments.some((att) => {
    const type = (att?.type || '').toString().toLowerCase();
    if (stickerLikeTypes.has(type)) {
      return true;
    }
    if (type === 'photo' && att?.media?.image && !text) {
      return true;
    }
    return false;
  });
  if (hasStickerLikeAttachment) {
    return true;
  }
  if (!text) {
    const itemType = (value.item || '').toString().toLowerCase();
    if (!itemType || itemType === 'comment' || itemType === 'fan_comment' || itemType === 'status') {
      const mediaOnly = safeAttachments.length > 0 && safeAttachments.every((att) => {
        const type = (att?.type || '').toString().toLowerCase();
        if (!type) {
          return Boolean(att?.media?.image);
        }
        if (stickerLikeTypes.has(type)) {
          return true;
        }
        if (type === 'photo') {
          return true;
        }
        return false;
      });
      if (mediaOnly) {
        return true;
      }
    }
  }
  if (!text && safeAttachments.length === 0 && !value.sticker_id) {
    const itemType = (value.item || '').toString().toLowerCase();
    if (!itemType || itemType === 'comment' || itemType === 'fan_comment') {
      if (!value.verb || value.verb === 'add') {
        return true;
      }
    }
  }
  return false;
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
    eventCategory: base.eventCategory || '',
  };
}

function pushSkippedFacebookChange(reason, context = {}) {
  const timestamp = formatTimestamp(context.createdAtMs || Date.now());
  const record = toSheetDefaults({
    sheetTimestamp: timestamp,
    sheetPageId: context.pageId || '',
    sheetPostId: context.postId || '',
    sheetCommentId: context.commentId || '',
    sheetUserName: context.userName || '',
    sheetUserId: context.userId || '',
    sheetOriginalComment: context.message || (context.hasSticker ? '[sticker]' : ''),
    sheetStatus: reason,
    sheetType: context.sheetType || 'FB_SKIPPED',
  });

  record.source = 'facebook';
  record.route = 'log';
  record.message = context.message || (context.hasSticker ? '[sticker]' : '');
  record.messageType = context.hasSticker ? 'sticker' : 'text';
  record.needsDelay = false;

  results.push({ json: record });
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
        let value = change.value || {};
        let message = value.message || '';
        let attachments = (value.attachments?.data) || (value.attachment ? [value.attachment] : []);
        let hasSticker = isStickerComment(value, message, attachments);

        const createdAtMs = (value.created_time || value.timestamp)
          ? Number(value.created_time || value.timestamp) * 1000
          : Date.now();
        const sheetTimestamp = formatTimestamp(createdAtMs);
        const isoTimestamp = new Date(createdAtMs + (7 * 60 * 60 * 1000)).toISOString();
        const skipContext = {
          createdAtMs,
          pageId,
          postId: value.post_id || '',
          commentId: value.comment_id || '',
          userName: value.sender_name || value.from?.name || '',
          userId: value.sender_id || value.from?.id || '',
          message,
          hasSticker,
        };

        const senderId = value.sender_id || value.from?.id || '';
        if (OWNER_USER_IDS.has(senderId)) {
          pushSkippedFacebookChange('SKIPPED: OWNER_REPLY', {
            ...skipContext,
            message: message || value.message || '',
            sheetType: 'FB_SELF_COMMENT'
          });
          continue;
        }
        if (value.verb && value.verb !== 'add') {
          pushSkippedFacebookChange('SKIPPED: NON_ADD_EVENT', skipContext);
          continue;
        }
        if (!value.comment_id) {
          pushSkippedFacebookChange('SKIPPED: COMMENT_ID_MISSING', skipContext);
          continue;
        }
        if (value.item && value.item !== 'comment') {
          pushSkippedFacebookChange('SKIPPED: NOT_COMMENT_EVENT', skipContext);
          continue;
        }

        if (QUERY_MISSING_USER_INFO && !SKIP_FACEBOOK_API && pageConfig.pageAccessToken) {
          const missingUserInfo = !(value.sender_name || value.from?.name || value.sender_id || value.from?.id);
          const missingContent = !message && !hasSticker && attachments.length === 0;
          if (missingUserInfo || missingContent) {
            try {
              const graphResult = await httpRequest.call(this, {
                method: 'GET',
                url: `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(value.comment_id)}`,
                qs: {
                  access_token: pageConfig.pageAccessToken,
                  fields: ['from{name,id}', 'message', 'attachment'].join(',')
                },
                timeout: GRAPH_TIMEOUT_MS
              });
              const graphData = graphResult?.data || graphResult?.body || graphResult || {};
              if (graphData.from) {
                value.sender_name = graphData.from.name || value.sender_name;
                value.sender_id = graphData.from.id || value.sender_id;
              }
              if (typeof graphData.message === 'string' && graphData.message.trim()) {
                message = graphData.message;
              }
              if (graphData.attachment) {
                const att = graphData.attachment;
                const enrichedAttachments = Array.isArray(att.data) ? att.data : [att];
                if (enrichedAttachments.length) {
                  attachments.splice(0, attachments.length, ...enrichedAttachments);
                  hasSticker = isStickerComment(value, message, attachments) || hasSticker;
                }
              }
            } catch (error) {
            }
          }
        }

        const sheetRow = {
          sheetTimestamp,
          isoTimestamp,
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
        let needsDelay = true;
        
        const dedupeKey = value.comment_id ? `${pageId}_${value.comment_id}` : `${pageId}_${value.comment_id || ''}`;
        const dedupeEntry = staticData.processedComments[dedupeKey];
        const entryTimestamp = typeof dedupeEntry === 'object'
          ? Number(dedupeEntry.ts ?? dedupeEntry.timestamp ?? dedupeEntry.time ?? dedupeEntry)
          : Number(dedupeEntry ?? 0);
        const seenWithinWindow = Boolean(entryTimestamp && !isNaN(entryTimestamp) && (now - entryTimestamp) < dedupeWindowMs);
        const duplicateInExecution = processedInExecution.has(dedupeKey);
        const isDuplicateAcrossExecutions = Boolean(seenWithinWindow);
        const isDuplicate = Boolean(isDuplicateAcrossExecutions || duplicateInExecution);

        if (!seenWithinWindow) {
          staticData.processedComments[dedupeKey] = { ts: now, executionId: $execution.id };
          staticDataChanged = true;
        }

        if (!duplicateInExecution) {
          processedInExecution.add(dedupeKey);
        }

        const isSelfComment = Boolean(
          (value.sender_id && value.sender_id === pageId) ||
          (value.from?.id && value.from.id === pageId)
        );

        let sheetType = 'FB_OTHER';
        let sheetReplyMessage = '';
        let sheetStatus = 'FB_LOG';
        let notifiedChannel = '';
        let likeStatus = 'FB_LIKE_SKIP';
        let likeError = null;

        const normalized = normaliseText(message);
        const keywords = pageConfig.keywords;
        const eventRule = findEventRule(message, pageConfig.eventRules || EVENT_RULES);

        let replyMessage = '';
        let lineMessage = '';
        let lineLabelHint = '';
        let skipReason = '';
        let eventCategory = '';

        const canAct = Boolean(pageConfig.pageAccessToken) && !isDuplicate && !isSelfComment;
        const lineTargets = Array.isArray(pageConfig.lineTargetUserIds) ? pageConfig.lineTargetUserIds.filter((id) => LINE_ID_REGEX.test(id)) : [];
        const lineToken = pageConfig.lineChannelAccessToken;
        let lineEnabled = Boolean(lineToken) && lineTargets.length > 0 && !isSelfComment;

        const baseLinePayload = {
          label: '',
          timestamp: sheetTimestamp,
          pageName: pageConfig.pageName,
          userName: sheetRow.sheetUserName,
          userId: sheetRow.sheetUserId,
          message,
          commentUrl
        };

        const defaultExtras = ['สถานะระบบ: ตอบอัตโนมัติแล้ว'];

        if (isSelfComment) {
          route = 'log';
          sheetType = 'FB_SELF_COMMENT';
          sheetReplyMessage = '';
          sheetStatus = 'SKIPPED: SELF_COMMENT';
          notifiedChannel = '';
          skipReason = 'self_comment';
          needsDelay = false;
        } else if (isDuplicate) {
          route = 'log';
          sheetType = 'FB_DUPLICATE';
          sheetReplyMessage = '';
          sheetStatus = 'SKIPPED: DUPLICATE_COMMENT';
          notifiedChannel = '';
          skipReason = 'dedupe_processed';
          needsDelay = false;
        } else if (!canAct) {
          route = 'log';
          sheetStatus = 'SKIPPED: NO_PAGE_TOKEN';
          skipReason = 'missing_page_token';
          needsDelay = false;
        } else if (includesWholeWordKeyword(normalized, keywords.negative)) {
          route = 'fb_negative';
          needsDelay = false;
          sheetType = 'FB_NEGATIVE';
          sheetReplyMessage = '[delete comment]';
          sheetStatus = 'FB_NEGATIVE_DELETE';
          lineLabelHint = 'คอมเมนต์ไม่เหมาะสม';
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            extras: ['Action: ระบบลบคอมเมนต์แล้ว']
          });
        } else if (includesKeyword(normalized, keywords.complaint)) {
          route = 'fb_complaint';
          needsDelay = true;
          sheetType = 'FB_COMPLAINT';
          const complaintLink = pageConfig.complaintUrl || 'https://line.me/R/ti/p/@121rbtun';
          replyMessage = `ขอบคุณที่แจ้งเข้ามานะครับ ถ้ามีเรื่องต้องการร้องเรียนหรือปัญหาที่อยากให้ช่วยดูแล สามารถกรอกรายละเอียดได้ที่ ${complaintLink} เลยครับ ทีมงานจะรีบดำเนินการให้ครับ`;
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_COMPLAINT_REPLY';
          lineLabelHint = 'ร้องทุกข์';
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            extras: [
              replyMessage ? `ตอบกลับ: ${truncateLineText(replyMessage)}` : '',
              `ฟอร์ม: ${pageConfig.complaintUrl}`,
              'Action: ทีมงานติดต่อกลับภายใน 5 นาที'
            ]
          });
        } else if (includesKeyword(normalized, keywords.alert)) {
          route = 'fb_alert';
          needsDelay = false;
          sheetType = 'FB_ALERT';
          sheetReplyMessage = '';
          sheetStatus = 'FB_ALERT_REVIEW';
          lineLabelHint = 'คำร้อง/ตำหนิ';
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            extras: ['สถานะ: ส่งให้ทีมตรวจสอบ']
          });
        } else if (eventRule) {
          route = 'fb_encouragement';
          needsDelay = true;
          sheetType = eventRule.sheetType || 'FB_EVENT_ENCOURAGEMENT';
          eventCategory = eventRule.displayName || eventRule.key || '';
          const eventReplies = Array.isArray(eventRule.replies) && eventRule.replies.length
            ? eventRule.replies
            : pageConfig.replies?.encouragement || pageConfig.encouragementReplies;
          const fallbackReplies = pageConfig.encouragementReplies.length
            ? pageConfig.encouragementReplies
            : DEFAULT_ENCOURAGEMENT_REPLIES;
          replyMessage = pickRandom(eventReplies, fallbackReplies[0] || DEFAULT_ENCOURAGEMENT_REPLIES[0]);
          sheetReplyMessage = replyMessage;
          sheetStatus = eventRule.sheetStatus || 'FB_EVENT_ENCOURAGEMENT_REPLY';
          lineLabelHint = 'ให้กำลังใจ (เหตุการณ์)';
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            extras: [
              replyMessage ? `ตอบกลับ: ${truncateLineText(replyMessage)}` : '',
              eventCategory ? `หมวดเทศกาล: ${eventCategory}` : '',
              ...defaultExtras
            ]
          });
        } else if (includesKeyword(normalized, keywords.encouragement)) {
          route = 'fb_encouragement';
          needsDelay = true;
          sheetType = 'FB_ENCOURAGEMENT';
          const encouragementReplies = Array.isArray(pageConfig.replies?.encouragement) && pageConfig.replies.encouragement.length
            ? pageConfig.replies.encouragement
            : (pageConfig.encouragementReplies.length ? pageConfig.encouragementReplies : DEFAULT_ENCOURAGEMENT_REPLIES);
          replyMessage = pickRandom(encouragementReplies, encouragementReplies[0] || DEFAULT_ENCOURAGEMENT_REPLIES[0]);
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_ENCOURAGEMENT_REPLY';
          lineLabelHint = 'ให้กำลังใจ';
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            extras: [
              replyMessage ? `ตอบกลับ: ${truncateLineText(replyMessage)}` : '',
              ...defaultExtras
            ]
          });
        } else if (hasSticker) {
          route = 'fb_encouragement';
          needsDelay = true;
          sheetType = 'FB_STICKER_ENCOURAGEMENT';
          const encouragementReplies = Array.isArray(pageConfig.replies?.sticker) && pageConfig.replies.sticker.length
            ? pageConfig.replies.sticker
            : (pageConfig.replies?.encouragement && pageConfig.replies.encouragement.length
              ? pageConfig.replies.encouragement
              : DEFAULT_ENCOURAGEMENT_REPLIES);
          replyMessage = pickRandom(encouragementReplies, encouragementReplies[0] || DEFAULT_ENCOURAGEMENT_REPLIES[0]);
          sheetReplyMessage = replyMessage;
          sheetStatus = 'FB_STICKER_ENCOURAGEMENT_REPLY';
          lineLabelHint = 'สติกเกอร์/GIF (กำลังใจ)';
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            message: '[Sticker/GIF]',
            extras: [
              replyMessage ? `ตอบกลับ: ${truncateLineText(replyMessage)}` : '',
              ...defaultExtras
            ]
          });
        } else {
          // Default positive/neutral path -> reply with encouragement template (summary via daily digest)
          route = 'fb_encouragement';
          needsDelay = true;
          const hasUserInfo = Boolean(
            (sheetRow.sheetUserName && sheetRow.sheetUserName.trim()) ||
            sheetRow.sheetUserId ||
            value.sender_name ||
            value.sender_id ||
            value.from?.name ||
            value.from?.id
          );
          const isProbablySticker = !message;
          sheetType = isProbablySticker ? 'FB_STICKER_ENCOURAGEMENT' : 'FB_ENCOURAGEMENT';
          const encouragementReplies = Array.isArray(pageConfig.replies?.encouragement) && pageConfig.replies.encouragement.length
            ? pageConfig.replies.encouragement
            : (pageConfig.encouragementReplies.length ? pageConfig.encouragementReplies : DEFAULT_ENCOURAGEMENT_REPLIES);
          replyMessage = pickRandom(encouragementReplies, encouragementReplies[0] || DEFAULT_ENCOURAGEMENT_REPLIES[0]);
          sheetReplyMessage = replyMessage;
          sheetStatus = isProbablySticker ? 'FB_STICKER_ENCOURAGEMENT_REPLY' : 'FB_ENCOURAGEMENT_REPLY';
          lineLabelHint = isProbablySticker ? 'สติกเกอร์/GIF (กำลังใจ)' : 'ให้กำลังใจ';
          
          if (isProbablySticker || !message) { // <-- **FIXED** (Line 1 of 2)
            sheetRow.sheetOriginalComment = '[sticker]';
          }
          
          lineMessage = buildLineMessage({
            ...baseLinePayload,
            label: lineLabelHint,
            message: (isProbablySticker || !message) ? '[Sticker/GIF]' : message, // <-- **FIXED** (Line 2 of 2)
            extras: [
              replyMessage ? `ตอบกลับ: ${truncateLineText(replyMessage)}` : '',
              ...defaultExtras
            ]
          });
          skipReason = '';
        }

        if (route === 'log') {
          needsDelay = false;
        }

        let replyLockInfo = null;
        let replyStatusInfo = null;
        const intendsToReply = Boolean(
          canAct &&
          replyMessage &&
          sheetReplyMessage &&
          route !== 'fb_negative' &&
          route !== 'log'
        );

        if (intendsToReply) {
          const lockPayload = {
            pageId,
            commentId: value.comment_id,
            executionId: $execution.id
          };
          replyLockInfo = acquireReplyLock(dedupeKey, lockPayload);

          if (!replyLockInfo.ok) {
            const lockReason = (replyLockInfo.reason || 'LOCK_FAILED').toString().toUpperCase();
            route = 'log';
            sheetType = 'FB_DUPLICATE_LOCK';
            sheetReplyMessage = '';
            sheetStatus = lockReason === 'EXISTS'
              ? 'SKIPPED: REPLY_LOCKED'
              : `SKIPPED: ${lockReason}`;
            replyMessage = '';
            lineMessage = '';
            skipReason = lockReason === 'EXISTS' ? 'reply_locked' : `lock_${lockReason.toLowerCase()}`;
          } else {
            replyStatusInfo = await getReplyStatus(pageId, value.comment_id, pageConfig.pageAccessToken);
            if (replyStatusInfo?.alreadyReplied) {
              const alreadyRepliedNote = 'สถานะระบบ: พบว่าคอมเมนต์นี้ถูกตอบแล้วบน Facebook';
              route = 'log';
              sheetType = 'FB_ALREADY_REPLIED';
              sheetReplyMessage = sheetReplyMessage || replyMessage || '';
              sheetStatus = 'SKIPPED: REPLY_EXISTS';
              replyMessage = '';
              const alreadyExtras = [];
              if (sheetReplyMessage) {
                alreadyExtras.push(`ตอบกลับ: ${truncateLineText(sheetReplyMessage)}`);
              }
              if (eventCategory) {
                alreadyExtras.push(`หมวดเทศกาล: ${eventCategory}`);
              }
              alreadyExtras.push(alreadyRepliedNote);
              lineMessage = buildLineMessage({
                ...baseLinePayload,
                label: lineLabelHint || 'แจ้งเตือนคอมเมนต์',
                extras: alreadyExtras
              });
              skipReason = 'reply_exists_on_facebook';
            } else if (replyStatusInfo?.error) {
              // keep proceeding but record error
              sheetStatus = `${sheetStatus} (CHECK_WARN)`.trim();
            }
          }
        }

        const shouldNotifyLine = route === 'fb_negative';
        if (!shouldNotifyLine) {
          lineMessage = '';
        }
        lineEnabled = Boolean(shouldNotifyLine && lineToken && lineTargets.length > 0 && !isSelfComment);

        notifiedChannel = lineEnabled && lineMessage ? (lineTargets.length > 1 ? 'LINE(multicast)' : 'LINE(push)') : '';

        const shouldAttemptLike = Boolean(
          route !== 'fb_negative' &&
          route !== 'log' &&
          canAct &&
          !skipReason &&
          pageConfig.pageAccessToken &&
          !SKIP_FACEBOOK_API
        );

        if (shouldAttemptLike) {
          const likeDelayMs = DEFAULT_DELAYS.like * 1000;
          if (likeDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, likeDelayMs));
          }
          try {
            await httpRequest.call(this, {
              method: 'POST',
              url: `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(value.comment_id)}/likes`,
              qs: {
                access_token: pageConfig.pageAccessToken
              },
              timeout: GRAPH_TIMEOUT_MS
            });
            likeStatus = 'FB_LIKE_OK';
          } catch (error) {
            likeStatus = 'FB_LIKE_ERROR';
            likeError = {
              message: error?.message || 'Facebook like failed',
              statusCode: error?.statusCode,
              name: error?.name || 'GraphLikeError'
            };
          }
        }

        sheetRow.eventCategory = eventCategory || '';

        const output = {
          source: 'facebook',
          route,
          sheetTimestamp,
          isoTimestamp,
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
          eventCategory,
          likeStatus,
          facebook: {
            pageId,
            pageName: pageConfig.pageName,
            postId: value.post_id || '',
            commentId: value.comment_id,
            parentId: value.parent_id || '',
            commentUrl,
            pageAccessToken: pageConfig.pageAccessToken,
            graphApiVersion: GRAPH_API_VERSION,
            appId: pageConfig.appId || BASE_APP_ID,
            verifyToken: pageConfig.verifyToken || BASE_VERIFY_TOKEN,
            skipApi: SKIP_FACEBOOK_API,
            reply: replyMessage
              ? {
                  type: 'text',
                  message: replyMessage
                }
              : null,
            delete: route === 'fb_negative',
            like: {
              attempted: shouldAttemptLike,
              status: likeStatus,
              error: likeError
            }
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

        output.needsDelay = needsDelay;

        output.meta = {
          dedupeKey,
          executionId: $execution.id,
          dedupeMarkedAt: now,
          isDuplicate,
          replyLock: replyLockInfo,
          replyStatus: replyStatusInfo,
          skipReason: skipReason || null,
          eventCategory: eventCategory || null,
          likeStatus: likeStatus || null,
          likeError: likeError,
          skipFacebookApi: SKIP_FACEBOOK_API,
          delays: cloneDelays()
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

if (staticDataChanged) {
  staticData.__dataChanged = true;
}

return results;
