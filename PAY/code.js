// This script is now an API for the mobile app and also serves the web app.

const SPREADSHEET_ID = '1ptHPEg2d_19vbecMjzZga2ETJu3ARfuS6LLomYhyIds';
const SHEET_NAME = 'Sheet1';

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
          result = { success: false, error: 'Invalid endpoint' };
      }
    } catch (error) {
      Logger.log(`doGet API Error for endpoint ${endpoint}: ${error.toString()}`);
      result = { success: false, error: `API Error: ${error.message}` };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Serve Web App (default behavior)
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('My Finance App')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handles POST requests for creating or deleting data.
 */
function doPost(e) {
  let result;
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action || (requestData.data && requestData.data.action);
    Logger.log(`doPost action: ${action}`);
    logApi(action, requestData);
    
    switch (action) {
      case 'addTransaction':
        result = addTransaction(requestData.data);
        break;
      case 'handleN8nTransaction':
        result = handleN8nTransaction(requestData.data || requestData);
        break;
      case 'deleteTransaction':
        // Expects the actual row number in the sheet.
        result = deleteTransactionByRow(requestData.rowIndex || (requestData.data && requestData.data.rowIndex));
        break;
      case 'updateCategory':
        result = updateCategory(
          requestData.rowIndex || (requestData.data && requestData.data.rowIndex),
          requestData.category || (requestData.data && requestData.data.category)
        );
        break;
      case 'updateTransaction':
        result = updateTransaction(
          requestData.rowIndex || (requestData.data && requestData.data.rowIndex),
          requestData.data || requestData
        );
        break;
      case 'addCategory':
        result = addCategory(requestData.category || (requestData.data && requestData.data.category));
        break;
      default:
        if (looksLikeSlipPayload(requestData.data || requestData)) {
          result = handleN8nTransaction(requestData.data || requestData);
        } else {
          result = { success: false, error: 'Invalid action' };
        }
    }
  } catch (error) {
    Logger.log(`doPost Error: ${error.toString()}`);
    logApi('doPostError', { message: error.message });
    result = { success: false, error: `POST Error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// =================================================================
//  API & WEB APP FUNCTIONS
// =================================================================

/**
 * Adds a new transaction row to the sheet.
 */
function addTransaction(data) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    
    const payload = normalizeIncomingSlipPayload(data || {});
    payload.status = cleanCell(data && data.status ? data.status : 'active');
    const newRow = buildSlipRow(sheet, payload);
    
    sheet.appendRow(newRow);
    
    return { success: true, message: 'Transaction added successfully.' };
  } catch (error) {
    Logger.log(`addTransaction ERROR: ${error.toString()}`);
    return { success: false, error: error.message };
  }
}

function handleN8nTransaction(data) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }

    const payload = normalizeIncomingSlipPayload(data || {});
    const duplicate = findDuplicateSlip(sheet, payload);
    if (duplicate) {
      return {
        success: false,
        duplicate: true,
        error: duplicate.message,
        rowIndex: duplicate.rowIndex
      };
    }

    const newRow = buildSlipRow(sheet, payload);
    sheet.appendRow(newRow);
    const rowIndex = sheet.getLastRow();

    logApi('handleN8nTransaction', {
      rowIndex: rowIndex,
      refId: payload.refId,
      executionId: payload.executionId,
      amount: payload.amount,
      category: payload.category
    });

    return {
      success: true,
      rowIndex: rowIndex,
      message: 'Transaction added successfully.'
    };
  } catch (error) {
    Logger.log(`handleN8nTransaction ERROR: ${error.toString()}`);
    logApi('handleN8nTransactionError', { message: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a transaction from the web app.
 * NOTE: This function is called by the OLD web app UI.
 * The `index` is a 0-based array index from the UI.
 */
function deleteTransaction(index) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    // This is fragile. It assumes the UI list matches the sheet order.
    // The +2 accounts for the header row and 1-based sheet indexing.
    sheet.deleteRow(index + 2); 
    return { success: true, message: 'Transaction deleted.' };
  } catch (error) {
    Logger.log(`deleteTransaction ERROR: ${error.toString()}`);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a transaction by its actual row number.
 * This is the new, more robust method for the API.
 */
function deleteTransactionByRow(rowIndex) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    const idx = toRowIndex(rowIndex);
    if (!idx) return { success: false, error: 'Invalid rowIndex' };
    sheet.deleteRow(idx);
    return { success: true, message: 'Transaction deleted.' };
  } catch (error) {
    Logger.log(`deleteTransactionByRow ERROR: ${error.toString()}`);
    return { success: false, error: error.message };
  }
}

/**
 * Updates category for a specific row.
 */
function updateCategory(rowIndex, category) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    const idx = toRowIndex(rowIndex);
    if (!idx) return { success: false, error: 'Invalid rowIndex' };
    const cleanCategory = String(category || '').trim();
    if (!cleanCategory) {
      return { success: false, error: 'Category is empty' };
    }
    const lastRow = sheet.getLastRow();
    if (idx > lastRow) {
      return { success: false, error: `Row ${idx} out of range (lastRow ${lastRow})` };
    }
    Logger.log(`updateCategory rowIndex=${idx} category=${cleanCategory}`);
    logApi('updateCategory', { rowIndex: idx, category: cleanCategory });
    sheet.getRange(idx, 5).setValue(cleanCategory); // Column E: Category
    return { success: true, message: 'Category updated.' };
  } catch (error) {
    Logger.log(`updateCategory ERROR: ${error.toString()}`);
    logApi('updateCategoryError', { message: error.message, rowIndex: rowIndex, category: category });
    return { success: false, error: error.message };
  }
}

function updateTransaction(rowIndex, data) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    const idx = toRowIndex(rowIndex);
    if (!idx) return { success: false, error: 'Invalid rowIndex' };

    const lastRow = sheet.getLastRow();
    if (idx > lastRow) {
      return { success: false, error: `Row ${idx} out of range (lastRow ${lastRow})` };
    }

    const payload = normalizeIncomingSlipPayload(data || {});
    payload.status = cleanCell(data && data.status ? data.status : 'active');
    const updatedRow = buildSlipRow(sheet, payload);

    sheet.getRange(idx, 1, 1, updatedRow.length).setValues([updatedRow]);
    logApi('updateTransaction', {
      rowIndex: idx,
      category: payload.category,
      type: payload.type,
      amount: payload.amount,
      refId: payload.refId
    });

    return { success: true, message: 'Transaction updated.', rowIndex: idx };
  } catch (error) {
    Logger.log(`updateTransaction ERROR: ${error.toString()}`);
    logApi('updateTransactionError', { message: error.message, rowIndex: rowIndex });
    return { success: false, error: error.message };
  }
}

/**
 * Adds a new category to the Categories sheet.
 */
function addCategory(category) {
  try {
    if (!category || !String(category).trim()) {
      return { success: false, error: 'Category is empty' };
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Categories') || ss.insertSheet('Categories');
    const cleanCategory = String(category).trim();
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 0
      ? sheet.getRange(1, 1, lastRow, 1).getValues().flat().map(String)
      : [];
    if (existing.includes(cleanCategory)) {
      return { success: true, message: 'Category already exists.' };
    }
    sheet.appendRow([cleanCategory]);
    return { success: true, message: 'Category added.' };
  } catch (error) {
    Logger.log(`addCategory ERROR: ${error.toString()}`);
    return { success: false, error: error.message };
  }
}

function toRowIndex(value) {
  const idx = parseInt(value, 10);
  if (!idx || idx < 2) return null;
  return idx;
}

function logApi(action, payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('ApiLogs') || ss.insertSheet('ApiLogs');
    const row = [
      new Date(),
      action || '',
      payload && payload.rowIndex ? payload.rowIndex : '',
      payload && payload.category ? payload.category : '',
      JSON.stringify(payload || {})
    ];
    sheet.appendRow(row);
  } catch (e) {
    Logger.log(`logApi ERROR: ${e.toString()}`);
  }
}

function normalizeIncomingSlipPayload(data) {
  const payload = data || {};
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
    refId: cleanCell(payload.ref_id || payload.refId || payload.reference || payload.reference_id),
    executionId: cleanCell(payload.execution_id || payload.executionId),
    status: cleanCell(payload.status || 'active')
  };
  const classified = classifyTransactionRecord(normalized);
  normalized.type = classified.type;
  normalized.category = classified.category;
  return normalized;
}

function findDuplicateSlip(sheet, payload) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const refId = payload.refId;
  const executionId = payload.executionId;

  // Only check duplicates when a stable identifier exists.
  if (!refId && !executionId) {
    return null;
  }

  const width = Math.max(sheet.getLastColumn(), 11);
  const rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const existingRefId = cleanCell(row[9]);
    const existingExecutionId = cleanCell(row[10]);
    const rowIndex = i + 2;

    if (refId && existingRefId && existingRefId === refId) {
      return {
        rowIndex: rowIndex,
        message: `⚠️ สลิปนี้บันทึกไปแล้วครับ (Ref: ${refId})`
      };
    }

    if (executionId && existingExecutionId && existingExecutionId === executionId) {
      return {
        rowIndex: rowIndex,
        message: `⚠️ รายการนี้ถูกประมวลผลแล้วครับ (Execution: ${executionId})`
      };
    }
  }

  return null;
}

function buildSlipRow(sheet, payload) {
  const width = Math.max(sheet.getLastColumn(), 11);
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
  return raw;
}

function normalizeIncomingAmount(value) {
  const amount = parseFloat(value);
  return isNaN(amount) ? 0 : amount;
}

function cleanCell(value) {
  return String(value || '').trim();
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
  const senderName = cleanCell(record.senderName || record.sender_name);
  const receiverName = cleanCell(record.receiverName || record.receiver_name);
  const receiverBank = cleanCell(record.receiverBank || record.receiver_bank);
  const amount = normalizeIncomingAmount(record.amount);
  const category = cleanCategory(record.category || record.category_name || 'ไม่ระบุ');
  const rawType = cleanCell(record.type || record.transaction_type);

  const senderIsOwner = isLikelyOwnerName(senderName);
  const receiverIsOwner = isLikelyOwnerName(receiverName);
  const walletTopup = isWalletTopup(receiverName, category);
  const donation = isDonationReceiver(receiverName, category);
  const merchant = isMerchantReceiver(receiverName, receiverBank, category);
  const personalReceiver = isPersonalReceiver(receiverName);

  let type = normalizeTxType(rawType, amount);
  let finalCategory = inferCategory(category, receiverName, receiverBank, type);

  if (receiverIsOwner && !senderIsOwner) {
    type = 'income';
  } else if (senderIsOwner && !receiverIsOwner) {
    if (walletTopup || donation || merchant) {
      type = 'expense';
    } else if (personalReceiver) {
      type = 'transfer';
    } else if (type === 'income') {
      type = 'transfer';
    }
  } else {
    if (walletTopup || donation || merchant) {
      if (type !== 'income') type = 'expense';
    } else if (personalReceiver && type === 'income' && rawType.toLowerCase() === 'transfer') {
      type = 'transfer';
    }
  }

  if (walletTopup) {
    finalCategory = 'E-wallet Topup';
    if (type !== 'income') type = 'expense';
  } else if (donation) {
    finalCategory = 'Donation';
    if (type !== 'income') type = 'expense';
  } else if (merchant) {
    finalCategory = inferCategory(finalCategory, receiverName, receiverBank, 'expense');
    if (type !== 'income') type = 'expense';
  } else if (type === 'transfer') {
    finalCategory = 'Transfer';
  }

  return {
    type: type,
    category: finalCategory
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
  return [
    'ธีรยุทธ',
    'teerayut',
    'yeerahem',
    'หยีราเหม',
    'yterayut'
  ].some(token => value.indexOf(token) !== -1);
}

function isWalletTopup(receiverName, category) {
  const value = normalizeComparableText(receiverName + ' ' + category);
  return containsAny(value, [
    'topup',
    'top up',
    'top-up',
    'promptpay topup',
    'wallet topup',
    'truemoney topup',
    'e-wallet topup',
    'เติมเงิน'
  ]);
}

function isDonationReceiver(receiverName, category) {
  const value = normalizeComparableText(receiverName + ' ' + category);
  return containsAny(value, [
    'donation',
    'มูลนิธิ',
    'foundation',
    'charity',
    'มัสยิด',
    'mosque',
    'วัด',
    'temple',
    'บริจาค'
  ]);
}

function isMerchantReceiver(receiverName, receiverBank, category) {
  const value = normalizeComparableText(receiverName + ' ' + receiverBank + ' ' + category);
  return containsAny(value, [
    'shop',
    'merchant',
    'store',
    '7-eleven',
    '7 eleven',
    'cp all',
    'shopee',
    'lazada',
    'parking',
    'smart parking',
    'mbk',
    'ร้าน',
    'ถุงเงิน',
    'บริษัท',
    'จำกัด',
    'co.,ltd',
    'co., ltd',
    'group',
    'bill',
    'payment',
    'ประกัน',
    'ไฟฟ้า',
    'water',
    'internet',
    'cafe',
    'coffee',
    'restaurant',
    'food'
  ]);
}

function isPersonalReceiver(receiverName) {
  const value = normalizeComparableText(receiverName);
  if (!value) return false;
  if (isMerchantReceiver(receiverName, '', '')) return false;
  if (isDonationReceiver(receiverName, '')) return false;
  return containsAny(value, [
    'นาย',
    'นาง',
    'น.ส',
    'นส',
    'mr',
    'mrs',
    'ms',
    'miss'
  ]) || value.split(' ').length >= 2;
}

function inferCategory(currentCategory, receiverName, receiverBank, type) {
  const category = cleanCategory(currentCategory);
  if (category && category !== 'ไม่ระบุ' && category !== 'อื่นๆ') {
    if (type === 'transfer' && category === 'Transfer') return 'Transfer';
    if (type !== 'transfer') return category;
  }

  const value = normalizeComparableText(receiverName + ' ' + receiverBank + ' ' + category);
  if (isWalletTopup(receiverName, category)) return 'E-wallet Topup';
  if (isDonationReceiver(receiverName, category)) return 'Donation';
  if (containsAny(value, ['parking', 'smart parking', 'mbk'])) return 'Transport';
  if (containsAny(value, ['cafe', 'coffee', 'restaurant', 'food', '7-eleven', 'cp all', 'ร้าน', 'ถุงเงิน'])) return 'Food';
  if (containsAny(value, ['bill', 'payment', 'ประกัน', 'ไฟฟ้า', 'water', 'internet'])) return 'Bill Payment';
  if (containsAny(value, ['shop', 'store', 'merchant', 'shopee', 'lazada'])) return 'Shopping';
  if (type === 'transfer') return 'Transfer';
  return category || 'Transfer';
}

function normalizeComparableText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(value, keywords) {
  return keywords.some(keyword => value.indexOf(keyword) !== -1);
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
        const classified = classifyTransactionRecord({
          type: row[2],
          amount: amount,
          category: row[4],
          senderName: row[5],
          senderBank: row[6],
          receiverName: row[7],
          receiverBank: row[8]
        });
        const type = classified.type;
        const category = classified.category;
        
        if (type === 'income') totalIncome += amount;
        else if (type === 'expense') {
          totalExpense += amount;
          categoryExpenses[category] = (categoryExpenses[category] || 0) + amount;
        }
        
        recentTransactions.push({
          rowIndex: i + 1,
          date: formatSheetDate(date),
          time: formatSheetTime(row[1]),
          type: type,
          amount: amount,
          category: category
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
      const classified = classifyTransactionRecord({
        type: row[2],
        amount: amount,
        category: row[4],
        senderName: row[5],
        senderBank: row[6],
        receiverName: row[7],
        receiverBank: row[8]
      });
      const type = classified.type;
      const categoryRaw = classified.category;
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
        const refId = cleanCell(row[9]);
        const executionId = cleanCell(row[10]);
        const status = cleanCell(row[11] || 'active');
        transactions.push({
          rowIndex: i + 1, // Actual row number for deletion
          date: formatSheetDate(date),
          time: formatSheetTime(row[1]),
          type: type,
          amount: amount,
          category: categoryRaw,
          senderName: String(row[5] || ''),
          senderBank: String(row[6] || ''),
          receiverName: String(row[7] || ''),
          receiverBank: String(row[8] || ''),
          refId: refId,
          executionId: executionId,
          status: status,
          source: refId || executionId ? 'slip' : 'manual'
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
        const classified = classifyTransactionRecord({
          type: row[2],
          amount: amount,
          category: row[4],
          senderName: row[5],
          senderBank: row[6],
          receiverName: row[7],
          receiverBank: row[8]
        });
        const type = classified.type;
        
        if (type === 'income') {
          monthlyData[month].income += amount;
        } else if (type === 'expense') {
          const category = classified.category;
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
