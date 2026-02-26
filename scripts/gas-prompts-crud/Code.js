var CONFIG = {
  SPREADSHEET_ID: "12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0",
  DEFAULT_SHEET_NAME: "PROMPTS",
  AUTO_UPDATED_AT_COLUMN: "updated_at"
};

function doGet(e) {
  try {
    var action = getAction_(e);
    if (action === "sheets") {
      return jsonResponse_({ ok: true, data: listSheets() });
    }
    if (action === "read" || action === "") {
      var sheetName = getSheetNameFromQuery_(e);
      var filter = getFilterFromQuery_(e);
      return jsonResponse_({ ok: true, data: readRows(sheetName, filter) });
    }
    return jsonResponse_({ ok: false, error: "Unsupported action for GET. Use action=read|sheets." });
  } catch (err) {
    return jsonResponse_({ ok: false, error: toErrorMessage_(err) });
  }
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    var action = String(payload.action || "").toLowerCase();
    var sheetName = String(payload.sheet || CONFIG.DEFAULT_SHEET_NAME);

    if (action === "create") {
      return jsonResponse_({ ok: true, data: createRow(sheetName, payload.data || {}) });
    }
    if (action === "read") {
      return jsonResponse_({ ok: true, data: readRows(sheetName, payload.filter || {}) });
    }
    if (action === "update") {
      return jsonResponse_({
        ok: true,
        data: updateRow(sheetName, payload.match || {}, payload.data || {}, payload.options || {})
      });
    }
    if (action === "delete") {
      return jsonResponse_({
        ok: true,
        data: deleteRow(sheetName, payload.match || {}, payload.options || {})
      });
    }
    if (action === "sheets") {
      return jsonResponse_({ ok: true, data: listSheets() });
    }
    if (action === "reserve_key") {
      return jsonResponse_({
        ok: true,
        data: reserveKey(payload.sheet || "OCR_DEDUPE", payload.key_column || "row_key", payload.key_value)
      });
    }
    if (action === "replace_rows") {
      return jsonResponse_({
        ok: true,
        data: replaceRows(sheetName, payload.rows || [], payload.options || {})
      });
    }

    return jsonResponse_({ ok: false, error: "Unsupported action. Use create/read/update/delete/sheets/reserve_key/replace_rows." });
  } catch (err) {
    return jsonResponse_({ ok: false, error: toErrorMessage_(err) });
  }
}

function listSheets() {
  var ss = getSpreadsheet_();
  var sheets = ss.getSheets();
  var out = [];
  for (var i = 0; i < sheets.length; i++) {
    out.push({ name: sheets[i].getName() });
  }
  return out;
}

function createRow(sheetName, data) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var row = [];
  var now = formatNowThai_();
  var i;

  for (i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === CONFIG.AUTO_UPDATED_AT_COLUMN) {
      row.push(now);
    } else {
      row.push(normalizeWriteValue_(data[h]));
    }
  }

  sheet.appendRow(row);
  return { inserted: true, sheet: sheet.getName(), row: rowToObject_(headers, row) };
}

function readRows(sheetName, filter) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var out = [];
  var i;

  for (i = 0; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    if (matchesFilter_(obj, filter || {})) {
      obj._row = i + 2;
      out.push(obj);
    }
  }
  return out;
}

function updateRow(sheetName, match, data, options) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var rows = findMatchingRows_(sheet, headers, match || {});
  if (!rows.length) throw new Error("updateRow: no rows matched");

  var updateMany = Boolean(options && options.updateMany);
  var targetRows = updateMany ? rows : [rows[0]];
  var now = formatNowThai_();
  var updated = [];
  var i;
  var j;

  for (i = 0; i < targetRows.length; i++) {
    var rowIndex = targetRows[i];
    var current = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];

    for (j = 0; j < headers.length; j++) {
      var h = headers[j];
      if (Object.prototype.hasOwnProperty.call(data, h)) {
        current[j] = normalizeWriteValue_(data[h]);
      }
    }
    if (indexOf_(headers, CONFIG.AUTO_UPDATED_AT_COLUMN) !== -1) {
      current[indexOf_(headers, CONFIG.AUTO_UPDATED_AT_COLUMN)] = now;
    }

    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([current]);
    var obj = rowToObject_(headers, current);
    obj._row = rowIndex;
    updated.push(obj);
  }

  return {
    updated_count: updated.length,
    sheet: sheet.getName(),
    rows: updated
  };
}

function deleteRow(sheetName, match, options) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var rows = findMatchingRows_(sheet, headers, match || {});
  if (!rows.length) throw new Error("deleteRow: no rows matched");

  var deleteMany = Boolean(options && options.deleteMany);
  var targetRows = deleteMany ? rows : [rows[0]];

  targetRows.sort(function (a, b) { return b - a; });

  var i;
  for (i = 0; i < targetRows.length; i++) {
    sheet.deleteRow(targetRows[i]);
  }

  return {
    deleted_count: targetRows.length,
    sheet: sheet.getName(),
    deleted_rows: targetRows
  };
}

function reserveKey(sheetName, keyColumn, keyValue) {
  var key = String(keyValue || "").trim();
  if (!key) throw new Error("reserveKey: key_value is required");

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(sheetName);
    var headers = getHeaders_(sheet);
    var keyIdx = indexOf_(headers, String(keyColumn || "row_key"));
    if (keyIdx === -1) throw new Error("reserveKey: key column not found: " + keyColumn);

    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var values = sheet.getRange(2, keyIdx + 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0] || "").trim() === key) {
          return { reserved: false, duplicate: true, key: key, sheet: sheet.getName() };
        }
      }
    }

    var row = [];
    var now = formatNowThai_();
    for (var j = 0; j < headers.length; j++) {
      if (headers[j] === keyColumn) row.push(key);
      else if (headers[j] === CONFIG.AUTO_UPDATED_AT_COLUMN) row.push(now);
      else row.push("");
    }
    sheet.appendRow(row);
    return { reserved: true, duplicate: false, key: key, sheet: sheet.getName() };
  } finally {
    lock.releaseLock();
  }
}

function replaceRows(sheetName, rows, options) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_(sheetName);
    var headers = getHeaders_(sheet);
    var keepHeader = !(options && options.keepHeader === false);

    var maxRows = sheet.getMaxRows();
    if (maxRows > 1) {
      sheet.getRange(2, 1, maxRows - 1, Math.max(1, sheet.getLastColumn())).clearContent();
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return { replaced: true, sheet: sheet.getName(), rows_written: 0, keep_header: keepHeader };
    }

    var matrix = [];
    for (var i = 0; i < rows.length; i++) {
      var src = rows[i] || {};
      var out = [];
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j];
        if (h === CONFIG.AUTO_UPDATED_AT_COLUMN && !Object.prototype.hasOwnProperty.call(src, h)) {
          out.push(formatNowThai_());
        } else {
          out.push(normalizeWriteValue_(src[h]));
        }
      }
      matrix.push(out);
    }
    sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
    return { replaced: true, sheet: sheet.getName(), rows_written: matrix.length, keep_header: keepHeader };
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(sheetName) {
  var ss = getSpreadsheet_();
  var name = String(sheetName || CONFIG.DEFAULT_SHEET_NAME);
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Sheet not found: " + name);
  return sheet;
}

function getHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error("Sheet has no header row: " + sheet.getName());
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var cleaned = [];
  var i;
  for (i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").trim();
    if (!h) throw new Error("Empty header at column " + (i + 1) + " in sheet " + sheet.getName());
    cleaned.push(h);
  }
  return cleaned;
}

function rowToObject_(headers, row) {
  var out = {};
  var i;
  for (i = 0; i < headers.length; i++) {
    out[headers[i]] = row[i];
  }
  return out;
}

function matchesFilter_(item, filter) {
  var k;
  for (k in filter) {
    if (!Object.prototype.hasOwnProperty.call(filter, k)) continue;
    if (!Object.prototype.hasOwnProperty.call(item, k)) return false;

    var itemValue = normalizeCompareValue_(item[k]);
    var filterValue = normalizeCompareValue_(filter[k]);
    if (itemValue !== filterValue) return false;
  }
  return true;
}

function findMatchingRows_(sheet, headers, match) {
  if (!match || typeof match !== "object") throw new Error("match is required");
  if (Object.keys(match).length === 0) throw new Error("match is required");

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var rows = [];
  var i;

  for (i = 0; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    if (matchesFilter_(obj, match)) rows.push(i + 2);
  }
  return rows;
}

function normalizeCompareValue_(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(v).trim();
}

function normalizeWriteValue_(v) {
  if (v === null || v === undefined) return "";
  return v;
}

function getFilterFromQuery_(e) {
  if (!e || !e.parameter) return {};
  if (!e.parameter.filter) return {};
  try {
    return JSON.parse(e.parameter.filter);
  } catch (_err) {
    throw new Error("Invalid filter JSON in query parameter");
  }
}

function getSheetNameFromQuery_(e) {
  if (!e || !e.parameter) return CONFIG.DEFAULT_SHEET_NAME;
  return String(e.parameter.sheet || CONFIG.DEFAULT_SHEET_NAME);
}

function parsePayload_(e) {
  var body = e && e.postData && e.postData.contents ? e.postData.contents : "";
  if (!body) throw new Error("Missing JSON body");
  return JSON.parse(body);
}

function getAction_(e) {
  if (!e || !e.parameter) return "";
  return String(e.parameter.action || "").toLowerCase();
}

function toErrorMessage_(err) {
  return err && err.message ? err.message : String(err);
}

function indexOf_(arr, value) {
  var i;
  for (i = 0; i < arr.length; i++) {
    if (arr[i] === value) return i;
  }
  return -1;
}

function formatNowThai_() {
  return Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
