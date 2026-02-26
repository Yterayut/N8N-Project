#!/usr/bin/env node

/**
 * Sync keywords/replies from Google Sheets into a local cache file for workflow3.
 *
 * - Reads two tabs (keywords + replies) from the sheet defined by env:
 *   CONFIG_SHEET_ID, CONFIG_TAB_KEYWORDS, CONFIG_TAB_REPLIES
 * - Builds a per-page override for page 102450935821483 only
 * - Writes cache to .n8n-dev/config/keywords.json with meta info
 * - Logs result to logs/config-sync-YYYYMMDD-HHMM.log
 *
 * Usage:
 *   CONFIG_SHEET_ID=... CONFIG_TAB_KEYWORDS=... CONFIG_TAB_REPLIES=... node scripts/config_sync_from_sheet.js
 * Optional:
 *   CONFIG_SHEET_API_KEY=...            // Google API key if sheet is private via API
 *   CONFIG_CACHE_MAX_AGE_MINUTES=60     // Not used here but documented for runtime loader
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PAGE_ID_TARGET = '102450935821483';
const CUSTOM_CACHE_PATH = process.env.WORKFLOW3_CONFIG_CACHE_PATH ? process.env.WORKFLOW3_CONFIG_CACHE_PATH.trim() : '';

function nowISO() {
  return new Date().toISOString();
}

function formatOffsetIso(date, offsetMinutes) {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const base = shifted.toISOString().replace('Z', '');
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${base}${sign}${hh}:${mm}`;
}

function nowBangkok() {
  // Thailand is UTC+7 year-round
  return formatOffsetIso(new Date(), 7 * 60);
}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function readEnv(key, fallback = '') {
  return (process.env[key] || fallback).trim();
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function writeLogFile(content) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date();
    const name = `config-sync-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}-${String(stamp.getHours()).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}.log`;
    const target = path.join(logsDir, name);
    fs.writeFileSync(target, content, 'utf8');
    log(`log written: ${target}`);
  } catch (error) {
    log(`warn: unable to write log file (${error.message || error})`);
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
          resolve(data);
        });
      })
      .on('error', reject);
  });
}

async function fetchTab(sheetId, tabName, apiKey) {
  // Prefer Sheets API JSON, fallback to gviz CSV (requires sheet public)
  if (apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(tabName)}?key=${encodeURIComponent(apiKey)}`;
    return { source: 'sheets_api', data: await fetchJson(url), format: 'json' };
  }
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  return { source: 'gviz_csv', data: await fetchText(url), format: 'csv' };
}

function parseCsv(text) {
  const rows = [[]];
  let current = '';
  let inQuotes = false;
  const pushCell = () => {
    rows[rows.length - 1].push(current);
    current = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        pushCell();
      } else if (ch === '\n') {
        pushCell();
        rows.push([]);
      } else if (ch === '\r') {
        continue;
      } else {
        current += ch;
      }
    }
  }
  pushCell();
  return rows.filter((r) => r.length);
}

function parseRows(response, format) {
  if (format === 'csv') {
    const table = parseCsv(response);
    if (!table.length) return [];
    const [headerRow, ...rows] = table;
    const headers = headerRow.map((h) => h.toString().trim());
    return rows.map((row) => {
      const obj = {};
      row.forEach((cell, idx) => {
        obj[headers[idx] || `col${idx}`] = cell;
      });
      return obj;
    });
  }
  // response from Sheets API: { values: [ [header...], [...rows] ] }
  if (response && Array.isArray(response.values)) {
    const [headerRow, ...rows] = response.values;
    const headers = (headerRow || []).map((h) => h.toString().trim());
    return rows.map((row) => {
      const obj = {};
      row.forEach((cell, idx) => {
        obj[headers[idx] || `col${idx}`] = cell;
      });
      return obj;
    });
  }
  throw new Error('Unsupported sheet response format');
}

function normaliseCategory(value) {
  return (value || '').toString().trim().toLowerCase();
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = value.toString().trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

function buildOverride(rowsKeywords, rowsReplies) {
  const override = {
    keywords: {},
    replies: {},
  };

  for (const row of rowsKeywords) {
    const active = parseBool(row.Active, true);
    if (!active) continue;
    const category = normaliseCategory(row.Category);
    const raw = (row.Keyword || '').toString();
    const tokens = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!category || !tokens.length) continue;
    if (!override.keywords[category]) override.keywords[category] = [];
    override.keywords[category].push(...tokens);
  }

  for (const row of rowsReplies) {
    const category = normaliseCategory(row.Category);
    const raw = (row.Reply || '').toString();
    if (!category || !raw) continue;
    const weight = parseNumber(row.Weight, 1);
    const locale = (row.Locale || '').toString().trim() || undefined;
    const parts = raw
      .split(/(?:\|\||,)/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!parts.length) continue;
    if (!override.replies[category]) override.replies[category] = [];
    for (const text of parts) {
      override.replies[category].push({
        text,
        weight: weight > 0 ? weight : 1,
        locale
      });
    }
  }

  return override;
}

async function main() {
  const sheetId = readEnv('CONFIG_SHEET_ID');
  const tabKeywords = readEnv('CONFIG_TAB_KEYWORDS');
  const tabReplies = readEnv('CONFIG_TAB_REPLIES');
  const apiKey = readEnv('CONFIG_SHEET_API_KEY', '');

  if (!sheetId || !tabKeywords || !tabReplies) {
    throw new Error('CONFIG_SHEET_ID, CONFIG_TAB_KEYWORDS, CONFIG_TAB_REPLIES are required');
  }

  log(`Reading sheet ${sheetId} tabs [${tabKeywords}, ${tabReplies}] ...`);

  const [keywordsRes, repliesRes] = await Promise.all([
    fetchTab(sheetId, tabKeywords, apiKey),
    fetchTab(sheetId, tabReplies, apiKey),
  ]);

  const keywordsRows = parseRows(keywordsRes.data, keywordsRes.format);
  const repliesRows = parseRows(repliesRes.data, repliesRes.format);

  const pageOverrides = {};
  pageOverrides[PAGE_ID_TARGET] = buildOverride(keywordsRows, repliesRows);

  const payload = {
    meta: {
      updatedAt: nowISO(),
      updatedAtLocal: nowBangkok(),
      sheetId,
      tabKeywords,
      tabReplies,
      source: [keywordsRes.source, repliesRes.source].join('+'),
    },
    pageOverrides,
  };

  let cachePath = '';
  if (CUSTOM_CACHE_PATH) {
    cachePath = CUSTOM_CACHE_PATH;
  } else {
    const primaryDir = path.join(process.cwd(), '.n8n-dev', 'config-cache');
    const fallbackDir = path.join(process.cwd(), '.n8n-dev', '.n8n', 'config-cache');
    let configDir = primaryDir;
    try {
      fs.mkdirSync(configDir, { recursive: true });
    } catch (error) {
      if (error.code === 'ENOTDIR') {
        configDir = fallbackDir;
        fs.mkdirSync(configDir, { recursive: true });
      } else if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    cachePath = path.join(configDir, 'keywords.json');
  }
  fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf8');
  log(`cache written: ${cachePath}`);

  const logContent = [
    `timestamp=${nowISO()}`,
    `timestamp_th=${nowBangkok()}`,
    `sheetId=${sheetId}`,
    `tabs=${tabKeywords},${tabReplies}`,
    `source=${payload.meta.source}`,
    `pageOverride=${PAGE_ID_TARGET}`,
    `keywords=${Object.keys(pageOverrides[PAGE_ID_TARGET].keywords).join(',')}`,
    `replies=${Object.keys(pageOverrides[PAGE_ID_TARGET].replies).join(',')}`,
    '',
  ].join('\n');
  writeLogFile(logContent);
}

main().catch((error) => {
  const message = error?.stack || error?.message || String(error);
  log(`ERROR: ${message}`);
  writeLogFile(`timestamp=${nowISO()}\ntimestamp_th=${nowBangkok()}\nerror=${message}\n`);
  process.exitCode = 1;
});
