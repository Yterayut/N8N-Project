// This script is now an API for the mobile app and also serves the web app.

const SPREADSHEET_ID = '1ptHPEg2d_19vbecMjzZga2ETJu3ARfuS6LLomYhyIds';
const SHEET_NAME = 'Sheet1';
const CANONICAL_HEADERS = [
  'date',
  'time',
  'type',
  'amount',
  'category',
  'sender_name',
  'sender_bank',
  'receiver_name',
  'receiver_bank',
  'ref_id',
  'execution_id',
  'status',
  'transaction_id',
  'source',
  'created_at',
  'updated_at',
  'note'
];
const API_SECRET_PROPERTY_KEYS = ['PAY_API_SHARED_SECRET', 'API_SHARED_SECRET'];
const OWNER_ALIASES_PROPERTY_KEYS = ['PAY_OWNER_ALIASES', 'OWNER_ALIASES'];
const REST_GET_ENABLED_PROPERTY_KEYS = ['PAY_ENABLE_REST_GET_API', 'ENABLE_REST_GET_API'];
const IFRAME_ALLOW_PROPERTY_KEYS = ['PAY_ALLOW_IFRAME_EMBED', 'ALLOW_IFRAME_EMBED'];
const DEFAULT_CLASSIFICATION_CONFIG = {
  walletTopupKeywords: ['topup', 'top up', 'top-up', 'promptpay topup', 'wallet topup', 'truemoney topup', 'e-wallet topup', 'เติมเงิน'],
  donationKeywords: ['donation', 'มูลนิธิ', 'foundation', 'charity', 'มัสยิด', 'mosque', 'วัด', 'temple', 'บริจาค'],
  merchantKeywords: ['shop', 'merchant', 'store', '7-eleven', '7 eleven', 'cp all', 'shopee', 'lazada', 'parking', 'smart parking', 'mbk', 'ร้าน', 'ถุงเงิน', 'บริษัท', 'จำกัด', 'co.,ltd', 'co., ltd', 'bill', 'ประกัน', 'ไฟฟ้า', 'water', 'internet', 'cafe', 'coffee', 'restaurant'],
  foodKeywords: ['cafe', 'coffee', 'restaurant', 'food', '7-eleven', '7 eleven', 'cp all', 'ร้าน', 'ถุงเงิน'],
  billKeywords: ['bill', 'payment', 'ประกัน', 'ไฟฟ้า', 'water', 'internet'],
  shoppingKeywords: ['shop', 'store', 'merchant', 'shopee', 'lazada'],
  transportKeywords: ['parking', 'smart parking', 'mbk'],
  personalKeywords: ['นาย', 'นาง', 'น.ส', 'นส', 'mr', 'mrs', 'ms', 'miss']
};

// =================================================================
//  ROUTING (doGet / doPost)
// =================================================================

/**
 * Handles GET requests.
 * If 'endpoint' param exists, it acts as a JSON API.
 * Otherwise, it serves the HTML web app.
 */
function doGet(e) {
  // API Endpoint Router
  if (e.parameter.endpoint) {
    if (!isRestGetApiEnabled_()) {
      return jsonResponse_(makeApiResponse_('validation_error', null, 'REST GET API disabled'));
    }
    let result;
    const endpoint = e.parameter.endpoint;
    
    try {
      switch (endpoint) {
        case 'dashboard':
          const month = e.parameter.month || new Date().getMonth() + 1;
          const year = e.parameter.year || new Date().getFullYear();
          result = getDashboardData(month, year);
          break;
        case 'transactions':
          result = getAllTransactions(e.parameter); // Use single-value params for filters
          break;
        case 'statistics':
          const statYear = e.parameter.year || new Date().getFullYear();
          result = getStatisticsData(statYear);
          break;
        case 'categories':
          result = getUniqueCategories();
          break;
        case 'userinfo':
           result = getUserInfo();
           break;
        default:
          result = makeApiResponse_('validation_error', null, 'Invalid endpoint');
      }
    } catch (error) {
      Logger.log(`doGet API Error for endpoint ${endpoint}: ${error.toString()}`);
      result = makeApiResponse_('internal_error', null, `API Error: ${error.message}`);
    }
    
    return jsonResponse_(result);
  }

  // Serve Web App (default behavior)
  const output = HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('My Finance App');
  if (isIframeEmbeddingAllowed_()) {
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return output;
}

/**
 * Handles POST requests for creating or deleting data.
 */
function doPost(e) {
  let result;
  try {
    const requestData = parsePostBody_(e);
    const auth = verifyApiAuth_(requestData, e);
    if (!auth.ok) {
      return jsonResponse_(makeApiResponse_('unauthorized', null, auth.error));
    }
    const action = requestData.action || (requestData.data && requestData.data.action);
    Logger.log(`doPost action: ${action}`);
    logApi(action || 'unknown', {
      status: 'received',
      source: cleanCell(requestData.source || (requestData.data && requestData.data.source) || 'api'),
      requestId: cleanCell(requestData.request_id || requestData.requestId || ''),
      transactionId: cleanCell(requestData.transaction_id || requestData.transactionId || '')
    });
    
    switch (action) {
      case 'addTransaction':
        result = addTransaction(requestData.data);
        break;
      case 'handleN8nTransaction':
        result = handleN8nTransaction(requestData.data || requestData);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(
          requestData.transaction_id ||
          requestData.transactionId ||
          (requestData.data && (requestData.data.transaction_id || requestData.data.transactionId)),
          requestData.rowIndex || (requestData.data && requestData.data.rowIndex)
        );
        break;
      case 'updateCategory':
        result = updateCategory(
          requestData.transaction_id ||
          requestData.transactionId ||
          requestData.rowIndex ||
          (requestData.data && (requestData.data.transaction_id || requestData.data.transactionId || requestData.data.rowIndex)),
          requestData.category || (requestData.data && requestData.data.category)
        );
        break;
      case 'addCategory':
        result = addCategory(requestData.category || (requestData.data && requestData.data.category));
        break;
      case 'renameCategory':
        result = renameCategory(
          requestData.old_category ||
          requestData.oldCategory ||
          (requestData.data && (requestData.data.old_category || requestData.data.oldCategory)),
          requestData.new_category ||
          requestData.newCategory ||
          (requestData.data && (requestData.data.new_category || requestData.data.newCategory))
        );
        break;
      case 'updateTransaction':
        result = updateTransaction(
          requestData.transaction_id ||
          requestData.transactionId ||
          requestData.rowIndex ||
          (requestData.data && (requestData.data.transaction_id || requestData.data.transactionId || requestData.data.rowIndex)),
          requestData.data || requestData
        );
        break;
      case 'adminSetSharedSecret':
        result = makeApiResponse_(
          'ok',
          adminSetSharedSecret(
            requestData.secret ||
            (requestData.data && requestData.data.secret)
          )
        );
        break;
      case 'adminSetOwnerAliases':
        result = makeApiResponse_(
          'ok',
          adminSetOwnerAliases(
            requestData.owner_aliases ||
            requestData.ownerAliases ||
            (requestData.data && (requestData.data.owner_aliases || requestData.data.ownerAliases))
          )
        );
        break;
      case 'migrateSchema':
      case 'migrateSheetSchema':
        result = migrateSheetSchema();
        break;
      default:
        if (looksLikeSlipPayload(requestData.data || requestData)) {
          result = handleN8nTransaction(requestData.data || requestData);
        } else {
          result = makeApiResponse_('validation_error', null, 'Invalid action');
        }
    }
  } catch (error) {
    Logger.log(`doPost Error: ${error.toString()}`);
    logApi('doPostError', { status: 'error', error: error.message });
    result = makeApiResponse_('internal_error', null, `POST Error: ${error.message}`);
  }

  return jsonResponse_(result);
}

// =================================================================
//  API & WEB APP FUNCTIONS
// =================================================================

/**
 * Adds a new transaction row to the sheet.
 */
function addTransaction(data) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) {
      return makeApiResponse_('internal_error', null, 'Sheet not found');
    }
    ensureCanonicalSchema_(sheet);
    const validation = validateManualTransaction_(data || {});
    if (!validation.ok) {
      return makeApiResponse_('validation_error', null, validation.error);
    }
    const normalized = normalizeManualTransactionPayload_(data || {});
    const newRow = buildSlipRow(sheet, normalized);
    sheet.appendRow(newRow);
    const rowIndex = sheet.getLastRow();
    logApi('addTransaction', {
      status: 'ok',
      rowIndex: rowIndex,
      transactionId: normalized.transactionId,
      source: normalized.source,
      category: normalized.category
    });
    return makeApiResponse_('ok', {
      rowIndex: rowIndex,
      transaction_id: normalized.transactionId,
      message: 'Transaction added successfully.'
    });
  } catch (error) {
    Logger.log(`addTransaction ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

function handleN8nTransaction(data) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) {
      return makeApiResponse_('internal_error', null, 'Sheet not found');
    }
    ensureCanonicalSchema_(sheet);

    const payload = normalizeIncomingSlipPayload(data || {});
    const validation = validateSlipTransaction_(payload);
    if (!validation.ok) {
      return makeApiResponse_('validation_error', null, validation.error);
    }
    const duplicate = findDuplicateSlip(sheet, payload);
    if (duplicate) {
      return makeApiResponse_('duplicate', {
        rowIndex: duplicate.rowIndex,
        transaction_id: duplicate.transactionId || '',
        duplicate: true
      }, duplicate.message);
    }

    const newRow = buildSlipRow(sheet, payload);
    sheet.appendRow(newRow);
    const rowIndex = sheet.getLastRow();

    logApi('handleN8nTransaction', {
      rowIndex: rowIndex,
      refId: payload.refId,
      executionId: payload.executionId,
      transactionId: payload.transactionId,
      amount: payload.amount,
      category: payload.category,
      source: payload.source,
      status: 'ok'
    });

    return makeApiResponse_('ok', {
      rowIndex: rowIndex,
      transaction_id: payload.transactionId,
      message: 'Transaction added successfully.'
    });
  } catch (error) {
    Logger.log(`handleN8nTransaction ERROR: ${error.toString()}`);
    logApi('handleN8nTransactionError', { status: 'error', error: error.message });
    return makeApiResponse_('internal_error', null, error.message);
  }
}

/**
 * Deletes a transaction from the web app.
 * NOTE: This function is called by the OLD web app UI.
 * The `index` is a 0-based array index from the UI.
 */
function deleteTransaction(transactionId, rowIndex) {
  const txId = cleanCell(transactionId);
  if (txId) {
    return deleteTransactionById(txId);
  }
  return deleteTransactionByRow(rowIndex);
}

function deleteTransactionById(transactionId) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) return makeApiResponse_('internal_error', null, 'Sheet not found');
    const resolved = resolveTransactionTarget_(sheet, transactionId);
    if (!resolved.ok) return makeApiResponse_('validation_error', null, resolved.error);
    return deleteTransactionByRow(resolved.rowIndex);
  } catch (error) {
    Logger.log(`deleteTransactionById ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

/**
 * Deletes a transaction by its actual row number.
 * This is the new, more robust method for the API.
 */
function deleteTransactionByRow(rowIndex) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) {
      return makeApiResponse_('internal_error', null, 'Sheet not found');
    }
    const idx = toRowIndex(rowIndex);
    if (!idx) return makeApiResponse_('validation_error', null, 'Invalid rowIndex');
    const lastRow = sheet.getLastRow();
    if (idx > lastRow) return makeApiResponse_('validation_error', null, `Row ${idx} out of range`);
    const width = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
    const existingRow = sheet.getRange(idx, 1, 1, width).getValues()[0];
    sheet.deleteRow(idx);
    logApi('deleteTransactionByRow', {
      status: 'ok',
      rowIndex: idx,
      transactionId: cleanCell(existingRow[12])
    });
    return makeApiResponse_('ok', { rowIndex: idx, transaction_id: cleanCell(existingRow[12]), message: 'Transaction deleted.' });
  } catch (error) {
    Logger.log(`deleteTransactionByRow ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

/**
 * Updates category for a specific row.
 */
function updateCategory(target, category) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) {
      return makeApiResponse_('internal_error', null, 'Sheet not found');
    }
    const resolved = resolveTransactionTarget_(sheet, target);
    if (!resolved.ok) return makeApiResponse_('validation_error', null, resolved.error);
    const idx = resolved.rowIndex;
    const cleanCategory = cleanCategoryValue_(category);
    if (!cleanCategory) return makeApiResponse_('validation_error', null, 'Category is empty');
    const lastRow = sheet.getLastRow();
    if (idx > lastRow) {
      return makeApiResponse_('validation_error', null, `Row ${idx} out of range (lastRow ${lastRow})`);
    }
    Logger.log(`updateCategory rowIndex=${idx} category=${cleanCategory}`);
    const width = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
    const existingRow = sheet.getRange(idx, 1, 1, width).getValues()[0];
    sheet.getRange(idx, 5).setValue(cleanCategory); // Column E: Category
    if (width >= 16) {
      sheet.getRange(idx, 16).setValue(nowIso_());
    }
    logApi('updateCategory', {
      status: 'ok',
      rowIndex: idx,
      category: cleanCategory,
      transactionId: cleanCell(existingRow[12])
    });
    return makeApiResponse_('ok', {
      rowIndex: idx,
      transaction_id: cleanCell(existingRow[12]),
      category: cleanCategory,
      message: 'Category updated.'
    });
  } catch (error) {
    Logger.log(`updateCategory ERROR: ${error.toString()}`);
    logApi('updateCategoryError', { status: 'error', error: error.message, target: target, category: category });
    return makeApiResponse_('internal_error', null, error.message);
  }
}

function updateTransaction(target, data) {
  const txId = cleanCell(target);
  if (txId && !/^\d+$/.test(txId)) {
    return updateTransactionById(txId, data);
  }
  return updateTransactionByRow(target, data);
}

function updateTransactionById(transactionId, data) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) return makeApiResponse_('internal_error', null, 'Sheet not found');
    const resolved = resolveTransactionTarget_(sheet, transactionId);
    if (!resolved.ok) return makeApiResponse_('validation_error', null, resolved.error);
    return updateTransactionByRow(resolved.rowIndex, Object.assign({}, data || {}, {
      transaction_id: resolved.transactionId,
      transactionId: resolved.transactionId
    }));
  } catch (error) {
    Logger.log(`updateTransactionById ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

function updateTransactionByRow(rowIndex, data) {
  try {
    const sheet = getMainSheet_();
    if (!sheet) return makeApiResponse_('internal_error', null, 'Sheet not found');
    ensureCanonicalSchema_(sheet);
    const idx = toRowIndex(rowIndex);
    if (!idx) return makeApiResponse_('validation_error', null, 'Invalid rowIndex');
    const lastRow = sheet.getLastRow();
    if (idx > lastRow) return makeApiResponse_('validation_error', null, `Row ${idx} out of range (lastRow ${lastRow})`);

    const width = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
    const currentRow = sheet.getRange(idx, 1, 1, width).getValues()[0];
    const currentRecord = rowToCanonicalRecord_(currentRow);
    const merged = normalizeManualTransactionPayload_(Object.assign({}, currentRecord, data || {}, {
      transaction_id: currentRecord.transactionId,
      transactionId: currentRecord.transactionId,
      source: currentRecord.source || 'webapp',
      created_at: currentRecord.createdAt,
      createdAt: currentRecord.createdAt
    }));
    const validation = validateManualTransaction_(merged);
    if (!validation.ok) return makeApiResponse_('validation_error', null, validation.error);

    const classified = classifyTransactionRecord(merged);
    merged.type = classified.type;
    merged.category = classified.category;
    merged.updatedAt = nowIso_();

    const updatedRow = buildSlipRow(sheet, merged);
    sheet.getRange(idx, 1, 1, width).setValues([updatedRow]);
    logApi('updateTransactionByRow', {
      status: 'ok',
      rowIndex: idx,
      transactionId: merged.transactionId,
      source: merged.source,
      category: merged.category
    });
    return makeApiResponse_('ok', {
      rowIndex: idx,
      transaction_id: merged.transactionId,
      message: 'Transaction updated.'
    });
  } catch (error) {
    Logger.log(`updateTransactionByRow ERROR: ${error.toString()}`);
    logApi('updateTransactionByRowError', { status: 'error', error: error.message, rowIndex: rowIndex });
    return makeApiResponse_('internal_error', null, error.message);
  }
}

/**
 * Adds a new category to the Categories sheet.
 */
function addCategory(category) {
  try {
    if (!category || !String(category).trim()) return makeApiResponse_('validation_error', null, 'Category is empty');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Categories') || ss.insertSheet('Categories');
    const cleanCategory = cleanCategoryValue_(category);
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 0
      ? sheet.getRange(1, 1, lastRow, 1).getValues().flat().map(normalizeCategory)
      : [];
    if (existing.includes(normalizeCategory(cleanCategory))) {
      return makeApiResponse_('ok', { category: cleanCategory, message: 'Category already exists.' });
    }
    sheet.appendRow([cleanCategory]);
    logApi('addCategory', { status: 'ok', category: cleanCategory });
    return makeApiResponse_('ok', { category: cleanCategory, message: 'Category added.' });
  } catch (error) {
    Logger.log(`addCategory ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

function renameCategory(oldCategory, newCategory) {
  try {
    const current = cleanCategoryValue_(oldCategory);
    const next = cleanCategoryValue_(newCategory);
    if (!current) return makeApiResponse_('validation_error', null, 'old category is required');
    if (!next) return makeApiResponse_('validation_error', null, 'new category is required');
    if (normalizeCategory(current) === normalizeCategory(next)) {
      return makeApiResponse_('ok', { old_category: current, new_category: next, updated_rows: 0, message: 'Category unchanged.' });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const mainSheet = ss.getSheetByName(SHEET_NAME);
    const categoriesSheet = ss.getSheetByName('Categories') || ss.insertSheet('Categories');
    let updatedRows = 0;

    if (mainSheet && mainSheet.getLastRow() >= 2) {
      const values = mainSheet.getRange(2, 5, mainSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < values.length; i++) {
        if (normalizeCategory(values[i][0]) === normalizeCategory(current)) {
          mainSheet.getRange(i + 2, 5).setValue(next);
          updatedRows++;
        }
      }
    }

    const lastRow = categoriesSheet.getLastRow();
    if (lastRow > 0) {
      const values = categoriesSheet.getRange(1, 1, lastRow, 1).getValues();
      let foundCurrent = false;
      let foundNext = false;
      for (let i = 0; i < values.length; i++) {
        const normalized = normalizeCategory(values[i][0]);
        if (normalized === normalizeCategory(next)) foundNext = true;
        if (normalized === normalizeCategory(current)) {
          categoriesSheet.getRange(i + 1, 1).setValue(next);
          foundCurrent = true;
        }
      }
      if (!foundCurrent && !foundNext) categoriesSheet.appendRow([next]);
    } else {
      categoriesSheet.appendRow([next]);
    }

    logApi('renameCategory', {
      status: 'ok',
      source: 'webapp',
      category: `${current} -> ${next}`,
      updatedRows: updatedRows
    });
    return makeApiResponse_('ok', { old_category: current, new_category: next, updated_rows: updatedRows, message: 'Category renamed.' });
  } catch (error) {
    Logger.log(`renameCategory ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

function toRowIndex(value) {
  const idx = parseInt(value, 10);
  if (!idx || idx < 2) return null;
  return idx;
}

function jsonResponse_(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function makeApiResponse_(status, data, error, extra) {
  const response = Object.assign({
    success: status === 'ok',
    status: status
  }, extra || {});
  if (data !== undefined && data !== null) response.data = data;
  if (error) response.error = error;
  return response;
}

function parsePostBody_(e) {
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    const params = {};
    raw.split('&').forEach(pair => {
      if (!pair) return;
      const parts = pair.split('=');
      const key = decodeURIComponent(parts[0] || '').trim();
      const value = decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, ' '));
      if (key) params[key] = value;
    });
    return params;
  }
}

function getConfiguredApiSecret_() {
  const props = PropertiesService.getScriptProperties();
  for (let i = 0; i < API_SECRET_PROPERTY_KEYS.length; i++) {
    const val = cleanCell(props.getProperty(API_SECRET_PROPERTY_KEYS[i]));
    if (val) return val;
  }
  return '';
}

function getClassificationConfig_() {
  const config = JSON.parse(JSON.stringify(DEFAULT_CLASSIFICATION_CONFIG));
  const props = PropertiesService.getScriptProperties();
  const rawJson = cleanCell(props.getProperty('PAY_CLASSIFICATION_CONFIG_JSON'));
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      Object.keys(config).forEach((key) => {
        if (Array.isArray(parsed[key])) {
          config[key] = parsed[key].map(normalizeComparableText).filter(Boolean);
        }
      });
      return normalizeClassificationConfig_(config);
    } catch (error) {
      Logger.log(`getClassificationConfig_ property parse error: ${error}`);
    }
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const configSheet = ss.getSheetByName('Config');
  if (!configSheet || configSheet.getLastRow() < 1) return normalizeClassificationConfig_(config);
  const values = configSheet.getRange(1, 1, configSheet.getLastRow(), 2).getValues();
  values.forEach((row) => {
    const key = cleanCell(row[0]);
    const value = cleanCell(row[1]);
    if (Object.prototype.hasOwnProperty.call(config, key) && value) {
      config[key] = value.split(',').map(normalizeComparableText).filter(Boolean);
    }
  });
  return normalizeClassificationConfig_(config);
}

function normalizeClassificationConfig_(config) {
  const normalized = {};
  Object.keys(DEFAULT_CLASSIFICATION_CONFIG).forEach((key) => {
    normalized[key] = (config[key] || DEFAULT_CLASSIFICATION_CONFIG[key]).map(normalizeComparableText).filter(Boolean);
  });
  return normalized;
}

function getOwnerAliases_() {
  const props = PropertiesService.getScriptProperties();
  for (let i = 0; i < OWNER_ALIASES_PROPERTY_KEYS.length; i++) {
    const raw = cleanCell(props.getProperty(OWNER_ALIASES_PROPERTY_KEYS[i]));
    if (raw) {
      return raw.split(',').map(v => normalizeComparableText(v)).filter(Boolean);
    }
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const configSheet = ss.getSheetByName('Config');
  if (configSheet && configSheet.getLastRow() >= 1) {
    const values = configSheet.getRange(1, 1, configSheet.getLastRow(), 2).getValues();
    for (let i = 0; i < values.length; i++) {
      const key = cleanCell(values[i][0]).toLowerCase();
      if (key === 'owner_aliases') {
        return cleanCell(values[i][1]).split(',').map(v => normalizeComparableText(v)).filter(Boolean);
      }
    }
  }

  return [
    'ธีรยุทธ',
    'teerayut',
    'yeerahem',
    'หยีราเหม',
    'yterayut'
  ].map(normalizeComparableText).filter(Boolean);
}

function adminSetSharedSecret(secret) {
  const value = cleanCell(secret);
  if (!value) throw new Error('secret is required');
  PropertiesService.getScriptProperties().setProperty('PAY_API_SHARED_SECRET', value);
  return { success: true, secret_set: true };
}

function adminSetOwnerAliases(csv) {
  const value = cleanCell(csv);
  if (!value) throw new Error('owner aliases csv is required');
  PropertiesService.getScriptProperties().setProperty('PAY_OWNER_ALIASES', value);
  return { success: true, owner_aliases_set: true };
}

function isRestGetApiEnabled_() {
  return getBooleanProperty_(REST_GET_ENABLED_PROPERTY_KEYS, true);
}

function isIframeEmbeddingAllowed_() {
  return getBooleanProperty_(IFRAME_ALLOW_PROPERTY_KEYS, false);
}

function getBooleanProperty_(keys, fallback) {
  const props = PropertiesService.getScriptProperties();
  for (let i = 0; i < keys.length; i++) {
    const raw = cleanCell(props.getProperty(keys[i]));
    if (!raw) continue;
    return ['1', 'true', 'yes', 'on'].indexOf(raw.toLowerCase()) !== -1;
  }
  return fallback;
}

function verifyApiAuth_(requestData, e) {
  const configured = getConfiguredApiSecret_();
  if (!configured) return { ok: true };
  const payload = requestData || {};
  const candidate = cleanCell(
    payload.api_key ||
    payload.apiKey ||
    (payload.data && (payload.data.api_key || payload.data.apiKey)) ||
    (e && e.parameter && (e.parameter.api_key || e.parameter.apiKey))
  );
  if (candidate && candidate === configured) return { ok: true };
  logApi('authDenied', { status: 'unauthorized', source: cleanCell(payload.source || 'api') });
  return { ok: false, error: 'Unauthorized request' };
}

function getMainSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
}

function ensureCanonicalSchema_(sheet) {
  if (!sheet) return;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CANONICAL_HEADERS.length).setValues([CANONICAL_HEADERS]);
    return;
  }
  const currentWidth = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
  const headerRow = sheet.getRange(1, 1, 1, currentWidth).getValues()[0];
  const missingHeaders = [];
  for (let i = headerRow.length; i < CANONICAL_HEADERS.length; i++) {
    missingHeaders.push(CANONICAL_HEADERS[i]);
  }
  if (missingHeaders.length > 0) {
    sheet.getRange(1, headerRow.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
  for (let i = 0; i < Math.min(CANONICAL_HEADERS.length, currentWidth); i++) {
    if (!cleanCell(headerRow[i])) {
      sheet.getRange(1, i + 1).setValue(CANONICAL_HEADERS[i]);
    }
  }
}

function rowToCanonicalRecord_(row) {
  return {
    date: cleanCell(row[0]),
    time: cleanCell(row[1]),
    type: cleanCell(row[2]),
    amount: normalizeIncomingAmount(row[3]),
    category: cleanCategory(row[4]),
    senderName: cleanCell(row[5]),
    senderBank: cleanCell(row[6]),
    receiverName: cleanCell(row[7]),
    receiverBank: cleanCell(row[8]),
    refId: cleanCell(row[9]),
    executionId: cleanCell(row[10]),
    status: cleanCell(row[11] || 'active'),
    transactionId: cleanCell(row[12]),
    source: cleanCell(row[13] || 'webapp'),
    createdAt: cleanCell(row[14]),
    updatedAt: cleanCell(row[15]),
    note: cleanCell(row[16])
  };
}

function resolveTransactionTarget_(sheet, target) {
  const raw = cleanCell(target);
  if (!raw) return { ok: false, error: 'Missing transaction target' };
  if (/^\d+$/.test(raw)) {
    const rowIndex = toRowIndex(raw);
    if (!rowIndex) return { ok: false, error: 'Invalid rowIndex' };
    const width = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
    const row = sheet.getRange(rowIndex, 1, 1, width).getValues()[0];
    return {
      ok: true,
      rowIndex: rowIndex,
      transactionId: cleanCell(row[12])
    };
  }
  return findRowByTransactionId_(sheet, raw);
}

function findRowByTransactionId_(sheet, transactionId) {
  const txId = cleanCell(transactionId);
  if (!txId) return { ok: false, error: 'Missing transaction_id' };
  ensureCanonicalSchema_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: `Transaction not found: ${txId}` };
  const txCol = CANONICAL_HEADERS.indexOf('transaction_id') + 1;
  const values = sheet.getRange(2, txCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (cleanCell(values[i][0]) === txId) {
      return { ok: true, rowIndex: i + 2, transactionId: txId };
    }
  }
  return { ok: false, error: `Transaction not found: ${txId}` };
}

function nowIso_() {
  return Utilities.formatDate(new Date(), 'GMT+7', "yyyy-MM-dd'T'HH:mm:ss");
}

function generateTransactionId_() {
  return Utilities.getUuid();
}

function cleanCategoryValue_(value) {
  const cleaned = cleanCategory(value);
  return cleaned === 'อื่นๆ' && !String(value || '').trim() ? '' : cleaned;
}

function validateManualTransaction_(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Manual transaction payload is required' };
  if (!cleanCell(data.date)) return { ok: false, error: 'date is required' };
  if (!cleanCell(data.time)) return { ok: false, error: 'time is required' };
  if (normalizeIncomingAmount(data.amount) <= 0) return { ok: false, error: 'amount must be greater than 0' };
  if (!cleanCell(data.type || 'expense')) return { ok: false, error: 'type is required' };
  if (!cleanCategoryValue_(data.category)) return { ok: false, error: 'category is required' };
  return { ok: true };
}

function validateSlipTransaction_(payload) {
  if (!payload.date) return { ok: false, error: 'date is required' };
  if (!payload.time) return { ok: false, error: 'time is required' };
  if (payload.amount <= 0) return { ok: false, error: 'amount must be greater than 0' };
  if (!payload.type) return { ok: false, error: 'type is required' };
  return { ok: true };
}

function normalizeManualTransactionPayload_(data) {
  const now = nowIso_();
  return {
    date: normalizeIncomingDate(data.date),
    time: normalizeIncomingTime(data.time),
    type: normalizeTxType(data.type || 'expense', normalizeIncomingAmount(data.amount)),
    amount: normalizeIncomingAmount(data.amount),
    category: cleanCategory(data.category),
    senderName: cleanCell(data.senderName || data.sender_name),
    senderBank: cleanCell(data.senderBank || data.sender_bank),
    receiverName: cleanCell(data.receiverName || data.receiver_name),
    receiverBank: cleanCell(data.receiverBank || data.receiver_bank),
    refId: normalizeRefId_(data.refId || data.ref_id),
    executionId: cleanCell(data.executionId || data.execution_id),
    status: cleanCell(data.status || 'active'),
    transactionId: cleanCell(data.transactionId || data.transaction_id) || generateTransactionId_(),
    source: cleanCell(data.source || 'webapp'),
    createdAt: cleanCell(data.createdAt || data.created_at) || now,
    updatedAt: now,
    note: cleanCell(data.note || '')
  };
}

function logApi(action, payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('ApiLogs') || ss.insertSheet('ApiLogs');
    const row = [
      new Date(),
      action || '',
      payload && payload.status ? payload.status : '',
      payload && payload.rowIndex ? payload.rowIndex : '',
      payload && payload.transactionId ? payload.transactionId : '',
      payload && payload.source ? payload.source : '',
      payload && payload.category ? payload.category : '',
      JSON.stringify({
        error: payload && payload.error ? payload.error : '',
        requestId: payload && payload.requestId ? payload.requestId : '',
        refId: payload && payload.refId ? payload.refId : '',
        executionId: payload && payload.executionId ? payload.executionId : ''
      })
    ];
    sheet.appendRow(row);
  } catch (e) {
    Logger.log(`logApi ERROR: ${e.toString()}`);
  }
}

function normalizeIncomingSlipPayload(data) {
  const payload = data || {};
  const now = nowIso_();
  const normalized = {
    date: normalizeIncomingDate(
      payload.date || payload.txDate || payload.transactionDate || payload.slip_date
    ),
    time: normalizeIncomingTime(
      payload.time || payload.txTime || payload.transactionTime || payload.slip_time
    ),
    type: normalizeIncomingType(
      payload.type || payload.transaction_type || payload.transactionType
    ),
    amount: normalizeIncomingAmount(payload.amount),
    category: cleanCategory(payload.category || payload.category_name || 'ไม่ระบุ'),
    senderName: cleanCell(payload.sender_name || payload.senderName),
    senderBank: cleanCell(payload.sender_bank || payload.senderBank),
    receiverName: cleanCell(payload.receiver_name || payload.receiverName),
    receiverBank: cleanCell(payload.receiver_bank || payload.receiverBank),
    refId: normalizeRefId_(payload.ref_id || payload.refId || payload.reference || payload.reference_id),
    executionId: cleanCell(payload.execution_id || payload.executionId),
    status: cleanCell(payload.status || 'active'),
    transactionId: cleanCell(payload.transaction_id || payload.transactionId) || generateTransactionId_(),
    source: cleanCell(payload.source || 'n8n'),
    createdAt: cleanCell(payload.created_at || payload.createdAt) || now,
    updatedAt: now,
    note: cleanCell(payload.note || '')
  };
  const classified = classifyTransactionRecord(normalized);
  normalized.type = classified.type;
  normalized.category = classified.category;
  return normalized;
}

function findDuplicateSlip(sheet, payload) {
  ensureCanonicalSchema_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const refId = normalizeRefId_(payload.refId);
  const executionId = payload.executionId;
  const fingerprints = buildDuplicateFingerprints_(payload);

  // Only check duplicates when a stable identifier exists.
  if (!refId && !executionId && fingerprints.length === 0) {
    return null;
  }

  const width = Math.max(sheet.getLastColumn(), 11);
  const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const existingRefId = normalizeRefId_(row[9]);
    const existingExecutionId = cleanCell(row[10]);
    const existingTransactionId = cleanCell(row[12]);
    const existingFingerprints = buildDuplicateFingerprints_({
      date: row[0],
      time: row[1],
      amount: row[3],
      receiverName: row[7],
      receiverBank: row[8]
    });
    const rowIndex = i + 2;

    if (refId && existingRefId && existingRefId === refId) {
      return {
        rowIndex: rowIndex,
        transactionId: existingTransactionId,
        message: `⚠️ สลิปนี้บันทึกไปแล้วครับ (Ref: ${refId})`
      };
    }

    if (executionId && existingExecutionId && existingExecutionId === executionId) {
      return {
        rowIndex: rowIndex,
        transactionId: existingTransactionId,
        message: `⚠️ รายการนี้ถูกประมวลผลแล้วครับ (Execution: ${executionId})`
      };
    }

    if (fingerprints.length && existingFingerprints.length && fingerprints.some((fp) => existingFingerprints.indexOf(fp) !== -1)) {
      return {
        rowIndex: rowIndex,
        transactionId: existingTransactionId,
        message: '⚠️ ตรวจพบรายการซ้ำจากวันที่ เวลา จำนวนเงิน และผู้รับ',
        confidence: 'weak'
      };
    }
  }

  return null;
}

function buildSlipRow(sheet, payload) {
  ensureCanonicalSchema_(sheet);
  const width = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
  const row = new Array(width).fill('');
  row[0] = payload.date;
  row[1] = payload.time;
  row[2] = payload.type;
  row[3] = payload.amount;
  row[4] = payload.category;
  row[5] = payload.senderName;
  row[6] = payload.senderBank;
  row[7] = payload.receiverName;
  row[8] = payload.receiverBank;
  row[9] = payload.refId;
  row[10] = payload.executionId;
  if (width >= 12) {
    row[11] = payload.status;
  }
  if (width >= 13) row[12] = payload.transactionId || generateTransactionId_();
  if (width >= 14) row[13] = payload.source || 'app';
  if (width >= 15) row[14] = payload.createdAt || nowIso_();
  if (width >= 16) row[15] = payload.updatedAt || nowIso_();
  if (width >= 17) row[16] = payload.note || '';
  return row;
}

function normalizeIncomingDate(value) {
  if (!value) return Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
  const parsed = parseSheetDate(value);
  if (!parsed) return String(value).trim();
  return Utilities.formatDate(parsed, 'GMT+7', 'yyyy-MM-dd');
}

function normalizeIncomingTime(value) {
  if (!value) return Utilities.formatDate(new Date(), 'GMT+7', 'HH:mm');
  return formatSheetTime(value) || String(value).trim();
}

function normalizeIncomingType(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'expense';
  const normalized = normalizeTxType(raw, 0);
  if (normalized === 'income') return 'income';
  if (normalized === 'expense') return 'expense';
  return 'transfer';
}

function migrateSheetSchema() {
  try {
    const sheet = getMainSheet_();
    if (!sheet) return makeApiResponse_('internal_error', null, 'Sheet not found');
    ensureCanonicalSchema_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return makeApiResponse_('ok', { updated: 0, message: 'No rows to migrate.' });
    const width = Math.max(sheet.getLastColumn(), CANONICAL_HEADERS.length);
    const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    let updated = 0;
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      let changed = false;
      if (!cleanCell(row[11])) { row[11] = 'active'; changed = true; }
      if (!cleanCell(row[12])) { row[12] = generateTransactionId_(); changed = true; }
      if (!cleanCell(row[13])) { row[13] = cleanCell(row[9] || row[10]) ? 'n8n' : 'webapp'; changed = true; }
      if (!cleanCell(row[14])) { row[14] = nowIso_(); changed = true; }
      row[15] = nowIso_();
      const classified = classifyTransactionRecord({
        type: row[2],
        amount: row[3],
        category: row[4],
        senderName: row[5],
        senderBank: row[6],
        receiverName: row[7],
        receiverBank: row[8]
      });
      if (cleanCell(row[2]) !== classified.type) { row[2] = classified.type; changed = true; }
      if (cleanCell(row[4]) !== classified.category) { row[4] = classified.category; changed = true; }
      if (changed) {
        sheet.getRange(i + 2, 1, 1, width).setValues([row]);
        updated++;
      }
    }
    logApi('migrateSchema', { status: 'ok', source: 'migration', rowIndex: '', transactionId: '', category: '', requestId: '', error: '', executionId: '', refId: '', updated: updated });
    return makeApiResponse_('ok', { updated: updated, message: 'Schema migration completed.' });
  } catch (error) {
    Logger.log(`migrateSheetSchema ERROR: ${error.toString()}`);
    return makeApiResponse_('internal_error', null, error.message);
  }
}

function normalizeIncomingAmount(value) {
  const amount = parseFloat(value);
  return isNaN(amount) ? 0 : amount;
}

function cleanCell(value) {
  return String(value || '').trim();
}

function normalizeRefId_(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

  if (!/^\d+$/.test(cleaned)) return cleaned;
  if (cleaned.length <= 8) return cleaned.replace(/^0+/, '') || '0';

  const prefix = cleaned.slice(0, 8);
  const suffix = cleaned.slice(8);
  try {
    return `${prefix}${BigInt(suffix).toString()}`;
  } catch (_) {
    return `${prefix}${suffix.replace(/^0+/, '') || '0'}`;
  }
}

function looksLikeSlipPayload(data) {
  if (!data) return false;
  return !!(
    data.ref_id ||
    data.refId ||
    data.execution_id ||
    data.executionId ||
    data.amount ||
    data.transaction_type ||
    data.transactionType
  );
}

function classifyTransactionRecord(record) {
  const cfg = getClassificationConfig_();
  const senderName = cleanCell(record.senderName || record.sender_name);
  const receiverName = cleanCell(record.receiverName || record.receiver_name);
  const receiverBank = cleanCell(record.receiverBank || record.receiver_bank);
  const amount = normalizeIncomingAmount(record.amount);
  const category = cleanCategory(record.category || record.category_name || 'ไม่ระบุ');
  const rawType = cleanCell(record.type || record.transaction_type);
  const ruleHits = [];

  const senderIsOwner = isLikelyOwnerName(senderName);
  const receiverIsOwner = isLikelyOwnerName(receiverName);
  const walletTopup = isWalletTopup(receiverName, category, cfg);
  const donation = isDonationReceiver(receiverName, category, cfg);
  const merchant = isMerchantReceiver(receiverName, receiverBank, category, cfg);
  const personalReceiver = isPersonalReceiver(receiverName, cfg);

  let type = normalizeTxType(rawType, amount);
  let finalCategory = inferCategory(category, receiverName, receiverBank, type, cfg);

  if (senderIsOwner && receiverIsOwner) {
    ruleHits.push('both_owner_transfer');
    type = 'transfer';
  } else if (receiverIsOwner && !senderIsOwner) {
    ruleHits.push('receiver_is_owner');
    type = 'income';
  } else {
    // New policy: if receiver is not owner, classify as expense.
    ruleHits.push('receiver_not_owner_expense');
    type = 'expense';
  }

  if (walletTopup) {
    ruleHits.push('wallet_topup');
    finalCategory = 'E-wallet Topup';
    if (type !== 'income') type = 'expense';
  } else if (donation) {
    ruleHits.push('donation');
    finalCategory = 'Donation';
    if (type !== 'income') type = 'expense';
  } else if (merchant) {
    ruleHits.push('merchant');
    finalCategory = inferCategory(finalCategory, receiverName, receiverBank, 'expense', cfg);
    if (type !== 'income') type = 'expense';
  } else if (type === 'transfer') {
    ruleHits.push('transfer');
    finalCategory = 'Transfer';
  }

  return {
    type: type,
    category: finalCategory,
    ruleHits: ruleHits
  };
}

function repairMisclassifiedTransactions(startRow) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const firstRow = Math.max(parseInt(startRow || 2, 10) || 2, 2);
  const lastRow = sheet.getLastRow();
  if (lastRow < firstRow) return { success: true, updated: 0, rows: [] };

  const width = Math.max(sheet.getLastColumn(), 11);
  const values = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, width).getValues();
  const updates = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;

    const currentType = cleanCell(row[2]);
    const currentCategory = cleanCategory(row[4]);
    const classified = classifyTransactionRecord({
      type: currentType,
      amount: row[3],
      category: currentCategory,
      senderName: row[5],
      senderBank: row[6],
      receiverName: row[7],
      receiverBank: row[8]
    });

    if (currentType !== classified.type || currentCategory !== classified.category) {
      const rowIndex = firstRow + i;
      sheet.getRange(rowIndex, 3).setValue(classified.type);
      sheet.getRange(rowIndex, 5).setValue(classified.category);
      updates.push({
        rowIndex: rowIndex,
        fromType: currentType,
        toType: classified.type,
        fromCategory: currentCategory,
        toCategory: classified.category,
        refId: cleanCell(row[9])
      });
    }
  }

  logApi('repairMisclassifiedTransactions', {
    updated: updates.length,
    rows: updates.slice(0, 50)
  });

  return {
    success: true,
    updated: updates.length,
    rows: updates
  };
}

function isLikelyOwnerName(name) {
  const value = normalizeComparableText(name);
  if (!value) return false;
  return getOwnerAliases_().some(token => value.indexOf(token) !== -1);
}

function isWalletTopup(receiverName, category, cfg) {
  const value = normalizeComparableText(receiverName + ' ' + category);
  return containsAny(value, cfg.walletTopupKeywords);
}

function isDonationReceiver(receiverName, category, cfg) {
  const value = normalizeComparableText(receiverName + ' ' + category);
  return containsAny(value, cfg.donationKeywords);
}

function isMerchantReceiver(receiverName, receiverBank, category, cfg) {
  const value = normalizeComparableText(receiverName + ' ' + receiverBank + ' ' + category);
  return containsAny(value, cfg.merchantKeywords);
}

function isPersonalReceiver(receiverName, cfg) {
  const value = normalizeComparableText(receiverName);
  if (!value) return false;
  if (isMerchantReceiver(receiverName, '', '', cfg)) return false;
  if (isDonationReceiver(receiverName, '', cfg)) return false;
  return containsAny(value, cfg.personalKeywords) || value.split(' ').length >= 2;
}

function inferCategory(currentCategory, receiverName, receiverBank, type, cfg) {
  const category = cleanCategory(currentCategory);
  if (category && category !== 'ไม่ระบุ' && category !== 'อื่นๆ') {
    if (type === 'transfer' && category === 'Transfer') return 'Transfer';
    if (type !== 'transfer') return category;
  }

  const value = normalizeComparableText(receiverName + ' ' + receiverBank + ' ' + category);
  if (isWalletTopup(receiverName, category, cfg)) return 'E-wallet Topup';
  if (isDonationReceiver(receiverName, category, cfg)) return 'Donation';
  if (containsAny(value, cfg.transportKeywords)) return 'Transport';
  if (containsAny(value, cfg.foodKeywords)) return 'Food';
  if (containsAny(value, cfg.billKeywords)) return 'Bill Payment';
  if (containsAny(value, cfg.shoppingKeywords)) return 'Shopping';
  if (type === 'transfer') return 'Transfer';
  return category || 'Transfer';
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMerchantNameForDuplicate_(value) {
  const normalized = normalizeComparableText(value)
    .replace(/[|]+/g, ' ')
    .replace(/\s*[(-]?\s*(สาขา|branch)\s+.+$/i, '')
    .replace(/\s+(สาขา|branch)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return normalized;
}

function containsAny(value, keywords) {
  return keywords.some(keyword => value.indexOf(keyword) !== -1);
}

function buildDuplicateFingerprints_(payload) {
  const date = normalizeIncomingDate(payload.date);
  const time = normalizeIncomingTime(payload.time);
  const amount = normalizeIncomingAmount(payload.amount);
  const receiverName = normalizeComparableText(payload.receiverName || payload.receiver_name || '');
  const merchantName = normalizeMerchantNameForDuplicate_(payload.receiverName || payload.receiver_name || '');
  const receiverBank = normalizeComparableText(payload.receiverBank || payload.receiver_bank || '');
  if (!date || !time || !amount || (!receiverName && !receiverBank && !merchantName)) return [];
  const amountFixed = amount.toFixed(2);
  const keys = [];
  if (receiverName) keys.push([date, time, amountFixed, receiverName].join('|'));
  if (merchantName) keys.push([date, time, amountFixed, merchantName].join('|'));
  if (receiverName && receiverBank) keys.push([date, time, amountFixed, receiverName, receiverBank].join('|'));
  if (merchantName && receiverBank) keys.push([date, time, amountFixed, merchantName, receiverBank].join('|'));
  if (!receiverName && receiverBank) keys.push([date, time, amountFixed, receiverBank].join('|'));
  return Array.from(new Set(keys));
}

function getStoredTypeAndCategory_(row) {
  const type = normalizeIncomingType(row[2]);
  const category = cleanCategory(row[4]);
  if (type && category && category !== 'ไม่ระบุ') {
    return { type: type, category: category };
  }
  return classifyTransactionRecord({
    type: row[2],
    amount: row[3],
    category: row[4],
    senderName: row[5],
    senderBank: row[6],
    receiverName: row[7],
    receiverBank: row[8]
  });
}


// ดึงข้อมูลสรุปภาพรวม (Dashboard)
function getDashboardData(month, year) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return { success: false, error: 'ไม่พบ Sheet: ' + SHEET_NAME };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, balance: 0, income: 0, expense: 0, categoryExpenses: {}, recentTransactions: [] };

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryExpenses = {};
    const recentTransactions = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const date = parseSheetDate(row[0]);
      if (!date) continue;
      if (date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month)) {
        const amount = parseFloat(row[3]) || 0;
        const stored = getStoredTypeAndCategory_(row);
        const type = stored.type;
        const category = stored.category;
        
        if (type === 'income') totalIncome += amount;
        else if (type === 'expense') {
          totalExpense += amount;
          categoryExpenses[category] = (categoryExpenses[category] || 0) + amount;
        }
        
        recentTransactions.push({
          rowIndex: i + 1,
          transaction_id: cleanCell(row[12]),
          date: formatSheetDate(date),
          time: formatSheetTime(row[1]),
          type: type,
          amount: amount,
          category: category,
          senderName: String(row[5] || ''),
          senderBank: String(row[6] || ''),
          receiverName: String(row[7] || ''),
          receiverBank: String(row[8] || ''),
          refId: cleanCell(row[9]),
          source: cleanCell(row[13]),
          createdAt: cleanCell(row[14]),
          updatedAt: cleanCell(row[15]),
          note: cleanCell(row[16])
        });
      }
    }
    
    recentTransactions.sort((a, b) => toTimestamp(b.date, b.time) - toTimestamp(a.date, a.time));
    
    return {
      success: true,
      balance: totalIncome - totalExpense,
      income: totalIncome,
      expense: totalExpense,
      categoryExpenses: categoryExpenses,
      recentTransactions: recentTransactions.slice(0, 5) // Return only top 5
    };
    
  } catch (error) {
    Logger.log('ERROR getDashboardData: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ดึงรายการทั้งหมด (Transaction List)
function getAllTransactions(filters) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return { success: false, error: 'ไม่พบ Sheet' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, transactions: [] };
    
    const transactions = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const date = parseSheetDate(row[0]);
      if (!date) continue;
      const amount = parseFloat(row[3]) || 0;
      const stored = getStoredTypeAndCategory_(row);
      const type = stored.type;
      const categoryRaw = stored.category;
      const categoryCompare = normalizeCategory(categoryRaw);
      let includeRow = true;
        
      // Apply filters
      if (filters) {
        const filterType = normalizeFilter(filters.type);
        const filterCategory = normalizeCategory(filters.category);
        if (filterType && filterType !== 'all' && type !== filterType) includeRow = false;
        if (filterCategory && filterCategory !== 'all' && categoryCompare !== filterCategory) includeRow = false;
        if (filters.startDate && date < new Date(filters.startDate)) includeRow = false;
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59);
          if (date > endDate) includeRow = false;
        }
        if (filters.search) {
          const searchTerm = String(filters.search || '').toLowerCase();
          const rawCategory = categoryRaw;
          const searchableText = (
            rawCategory + ' ' +
            categoryCompare + ' ' +
            String(row[5] || '') + ' ' +
            String(row[6] || '') + ' ' +
            String(row[7] || '') + ' ' +
            String(row[8] || '')
          ).toLowerCase();
          if (!searchableText.includes(searchTerm)) includeRow = false;
        }
      }
        
      if (includeRow) {
        transactions.push({
          rowIndex: i + 1, // Actual row number for deletion
          transaction_id: cleanCell(row[12]),
          date: formatSheetDate(date),
          time: formatSheetTime(row[1]),
          type: type,
          amount: amount,
          category: categoryRaw,
          senderName: String(row[5] || ''),
          senderBank: String(row[6] || ''),
          receiverName: String(row[7] || ''),
          receiverBank: String(row[8] || ''),
          refId: cleanCell(row[9]),
          status: cleanCell(row[11]),
          source: cleanCell(row[13]),
          createdAt: cleanCell(row[14]),
          updatedAt: cleanCell(row[15]),
          note: cleanCell(row[16])
        });
      }
    }
    
    transactions.sort((a, b) => toTimestamp(b.date, b.time) - toTimestamp(a.date, a.time));
    
    return { success: true, transactions: transactions };
    
  } catch (error) {
    Logger.log('ERROR getAllTransactions: ' + error.message);
    return { success: false, error: error.message };
  }
}

// ดึงข้อมูลสถิติ
function getStatisticsData(year) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return { success: false, error: 'ไม่พบ Sheet' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, monthlyData: [], yearlyTotal: { income: 0, expense: 0, balance: 0 }, topCategories: [] };
    
    const monthlyData = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
    const categoryTotals = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      
      const date = parseSheetDate(row[0]);
      if (!date) continue;
      if (date.getFullYear() === parseInt(year)) {
        const month = date.getMonth(); // 0-11
        const amount = parseFloat(row[3]) || 0;
        const stored = getStoredTypeAndCategory_(row);
        const type = stored.type;
        
        if (type === 'income') {
          monthlyData[month].income += amount;
        } else if (type === 'expense') {
          const category = stored.category;
          monthlyData[month].expense += amount;
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        }
      }
    }
    
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const monthlyArray = monthlyData.map((d, i) => ({
      monthName: monthNames[i],
      ...d
    }));
    
    const yearlyTotal = monthlyData.reduce((acc, cur) => {
      acc.income += cur.income;
      acc.expense += cur.expense;
      return acc;
    }, { income: 0, expense: 0 });
    yearlyTotal.balance = yearlyTotal.income - yearlyTotal.expense;
    
    const topCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    
    return { success: true, monthlyData: monthlyArray, yearlyTotal, topCategories };
    
  } catch (error) {
    Logger.log('ERROR getStatisticsData: ' + error.message);
    return { success: false, error: error.message };
  }
}

function toTimestamp(dateStr, timeStr) {
  try {
    if (!dateStr) return 0;
    const parts = String(dateStr).split('/');
    if (parts.length !== 3) return 0;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    let hours = 0;
    let minutes = 0;
    if (timeStr) {
      const timeParts = String(timeStr).trim().split(':');
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
      }
    }
    return new Date(year, month, day, hours, minutes, 0).getTime();
  } catch (e) {
    return 0;
  }
}

// ดึงหมวดหมู่ทั้งหมด
function getUniqueCategories() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return { success: false, error: 'ไม่พบ Sheet' };
    
    const data = sheet.getRange("E2:E").getValues(); // Get only category column
    const categories = new Set(data.flat().map(cleanCategory).filter(String));

    const catSheet = ss.getSheetByName('Categories');
    if (catSheet) {
      const catData = catSheet.getRange(1, 1, catSheet.getLastRow(), 1).getValues();
      catData.flat().map(cleanCategory).filter(String).forEach(c => categories.add(c));
    }
    
    return { success: true, categories: Array.from(categories).sort() };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function normalizeFilter(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function normalizeCategory(value) {
  if (!value) return '';
  let v = String(value).trim().toLowerCase();
  v = v.replace(/\s+/g, ' ');
  if (v === 'accomodation') v = 'accommodation';
  if (v === 'accommodations') v = 'accommodation';
  if (v === 'uncategorized' || v === 'uncategorised') v = 'อื่นๆ';
  return v;
}

function cleanCategory(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'อื่นๆ';
  return raw.replace(/\s+/g, ' ');
}

function parseSheetDate(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getTime());
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // yyyy-mm-dd (common in this sheet)
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  // dd/mm/yyyy
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

function formatSheetDate(dateObj) {
  return Utilities.formatDate(dateObj, 'GMT+7', 'dd/MM/yyyy');
}

function formatSheetTime(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, 'GMT+7', 'HH:mm');
  }
  const raw = String(value).trim();
  if (!raw) return '';
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const hh = ('0' + Number(m[1])).slice(-2);
  const mm = ('0' + Number(m[2])).slice(-2);
  return `${hh}:${mm}`;
}

function normalizeTxType(rawType, amount) {
  const t = String(rawType || '').trim().toLowerCase();
  if (t === 'income' || t === 'รายรับ' || t === 'credit') return 'income';
  if (t === 'expense' || t === 'รายจ่าย' || t === 'purchase' || t === 'payment' || t === 'bill payment' || t === 'debit' || t === 'top-up' || t === 'topup') return 'expense';
  if (t === 'transfer' || t === 'โอน') return 'transfer';
  if (amount < 0) return 'expense';
  return 'transfer';
}

// ดึงข้อมูลผู้ใช้
function getUserInfo() {
  try {
    const user = Session.getEffectiveUser().getEmail();
    return { success: true, email: user || 'unknown', displayName: user ? user.split('@')[0] : 'User' };
  } catch (error) {
    // Return mock data if permissions are not granted
    return { success: true, email: 'user@example.com', displayName: 'User' };
  }
}
