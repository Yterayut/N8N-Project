# T029B — OCR KM Suggestion: Knowledge Generation Phase

**Author:** Claude Code (CC)
**Date:** 2026-02-25 (revised post-Codex Discussion)
**Assignee:** Codex
**Priority:** Medium
**Risk:** ต่ำ-กลาง (generate suggestions only — no auto-activate, human review required)
**Depends on:** T029A verified (ocr-km-logger active, TRAIN_CASES has ≥7 rows confirmed)

---

## Overview

Scheduled workflow ที่อ่านข้อมูลสะสมจาก OCR_TRAIN_CASES → วิเคราะห์ pattern → เขียน suggestion rows ลง OCR_KM_LESSONS

**ไม่มีผลต่อ runtime** — ทุก suggestion มี `status=suggestion` รอ human approve ก่อนเสมอ

**Codex Discussion Fixes applied (2026-02-25):**
1. Timezone: n8n runs UTC (GENERIC_TIMEZONE not set) → cron `0 23 * * *` = 06:00 Bangkok
2. Sheet creation: ใช้ Google Sheets API โดยตรง (not temp workflow)
3. source=manual excluded by default (add `include_manual=true` flag for debug)
4. P1 renamed: "repeated error pattern" (tag-based) — not field-level (ไม่อ่าน FIELD_DIFFS ใน T029B)
5. P1 excludes `full_ocr_failure` (P3 handles it) ป้องกัน duplicate suggestions
6. Remove RULE_CHANGELOG write from T029B scope — changelog only when rules created (T029C)
7. Node naming cleaned up — dedup inside Analyze node, no separate Deduplicate node
8. Timestamp comparison: use `new Date().getTime()` ไม่ใช่ string compare
9. Error handling: `continueOnFail` on Sheets → workflow never crashes (not 500)

---

## Scope

**In scope:**
- สร้าง workflow ใหม่ `ocr-km-suggest` (scheduled + on-demand webhook)
- สร้าง Sheet tab `OCR_KM_LESSONS` ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0` ด้วย Sheets API โดยตรง
- Pattern 1: Repeated error pattern (same root_cause_tag + vendor ≥3 cases/30d) — excludes `no_diff` + `full_ocr_failure`
- Pattern 2: High severity rate (>50% cases ที่ severity=high ใน 7 วัน ต่อ doc_type)
- Pattern 3: Full OCR failure (root_cause_tag = `full_ocr_failure` ≥2 ครั้ง ต่อ vendor/doc_type)
- Dedup: ห้ามสร้าง lesson ซ้ำ (เช็ค existing lessons ก่อน — same doc_type + vendor + pattern keyword)
- Telegram notify admin เมื่อมี new suggestions
- source=manual excluded by default (webhook param: `include_manual=true` to override)

**Out of scope (explicit):**
- ห้าม auto-approve lesson ใดๆ
- ห้ามแตะ OCR_KM_RUNTIME_RULES + OCR_RULE_CHANGELOG (T029C)
- ห้าม read OCR_TRAIN_FIELD_DIFFS (defer to future T029B+ enhancement)
- ห้ามแตะ main OCR workflow

---

## Technical Spec

### Pre-step: Create Sheet Tabs (Codex does this FIRST before creating workflow)

ใช้ Google Sheets API บน access_token จาก n8n credential (หรือ service account) สร้าง 2 tabs:

```bash
# Check existing tabs
SPREADSHEET_ID="12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0"

# 1. Get existing sheet names
curl -s "https://sheets.googleapis.com/v4/spreadsheets/$SPREADSHEET_ID?fields=sheets.properties.title" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 2. batchUpdate to add missing tabs
curl -s -X POST "https://sheets.googleapis.com/v4/spreadsheets/$SPREADSHEET_ID:batchUpdate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"requests":[
    {"addSheet":{"properties":{"title":"OCR_KM_LESSONS"}}},
    {"addSheet":{"properties":{"title":"OCR_RULE_CHANGELOG"}}}
  ]}'

# 3. Write headers to OCR_KM_LESSONS row 1
LESSONS_HEADERS="lesson_id,created_at,status,doc_type,vendor_tax_id,field_affected,pattern_observed,lesson_text,suggested_action,evidence_count,source_case_ids,approved_by,approved_at,rule_id_ref"
curl -s -X PUT "https://sheets.googleapis.com/v4/spreadsheets/$SPREADSHEET_ID/values/OCR_KM_LESSONS!A1:N1?valueInputOption=RAW" \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"values\":[[$(echo $LESSONS_HEADERS | sed 's/,/\",\"/g' | sed 's/^/\"/' | sed 's/$/\"/')]]}"
```

**Note:** ACCESS_TOKEN ได้จาก n8n OAuth2 credential — Codex ต้องดู pattern ใน `cmd.md` สำหรับวิธี get token

---

### Workflow: `ocr-km-suggest` (13 nodes)

```
Schedule Trigger ──┐
                   ├──► Code (Auth + Config) → Google Sheets (Read TRAIN_CASES) → Google Sheets (Read KM_LESSONS existing)
Webhook (trigger) ─┘                              ↓                                       ↓
                                          Code (Analyze Patterns) ← (both inputs) ────────┘
                                                  ↓
                                          IF (any new lessons?)
                                          ↙              ↘
                               Google Sheets              Respond (no new lessons)
                            (Append KM_LESSONS)
                                    ↓
                            Code (Build Telegram)
                                    ↓
                            Telegram (Admin Notify) [continueOnFail]
                                    ↓
                            Respond to Webhook (success)
```

**Node list:**

1. `Schedule Trigger` — Cron: `0 23 * * *` (23:00 UTC = 06:00 Bangkok)
2. `Webhook (trigger)` — path: `ocr-km-suggest`, POST, responseMode: responseNode, **ต้องมี webhookId UUID**
3. `Code (Auth + Config)` — validate x-api-key (from webhook) OR allow schedule trigger, set config vars (include_manual, window_days)
4. `Google Sheets (Read TRAIN_CASES)` — Read all rows from `OCR_TRAIN_CASES`, spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`, `continueOnFail: true`
5. `Google Sheets (Read KM_LESSONS existing)` — Read all from `OCR_KM_LESSONS`, `continueOnFail: true`
6. `Code (Analyze Patterns)` — Pattern 1+2+3 + dedup → returns `new_lessons[]` array (see logic below)
7. `IF (any new lessons?)` — `{{ $json.new_lessons.length > 0 }}`
8. `Code (Prepare Lesson Rows)` — map each lesson to flat object for Sheets append
9. `Google Sheets (Append KM_LESSONS)` — append N rows, `continueOnFail: true`, **autoMapInputData**
10. `Code (Build Telegram)` — format message
11. `Telegram (Admin Notify)` — chatId `{{ $env.TELEGRAM_ADMIN_CHAT_ID }}`, `continueOnFail: true`
12. `Respond to Webhook (success)` — `{"ok":true,"new_lessons":N,"analyzed_cases":M}`
13. `Respond to Webhook (no new lessons)` — `{"ok":true,"new_lessons":0}`

---

### Code (Auth + Config)

```javascript
// From schedule: $input.first().json = {} (no auth needed — internal)
// From webhook: $input.first().json = { headers: {...}, body: {...} }
const src = $input.first().json;
const isWebhook = !!src.headers;

if (isWebhook) {
  const givenKey = String(src.headers?.['x-api-key'] || src.headers?.['X-Api-Key'] || '');
  const expectedKey = String($env.OCR_SHARED_API_KEY || '');
  if (!expectedKey || givenKey !== expectedKey) {
    return [{ json: { _error: 'UNAUTHORIZED', _status: 401 } }];
  }
}

const body = src.body || {};
return [{ json: {
  include_manual: body.include_manual === true,
  window_30d: Date.now() - 30 * 86400 * 1000,
  window_7d: Date.now() - 7 * 86400 * 1000,
  _config_ok: true,
} }];
```

**IF after auth:** check `$json._error` → true path = Respond 401, false path = continue

---

### Code (Analyze Patterns)

```javascript
// Inputs from 2 Sheets reads (use explicit node refs)
const rawCases = $('Google Sheets (Read TRAIN_CASES)').all().map(i => i.json);
const rawExisting = $('Google Sheets (Read KM_LESSONS existing)').all().map(i => i.json);
const cfg = $('Code (Auth + Config)').first().json;

const now = new Date();
const nowISO = now.toISOString();
const rand6 = () => Math.random().toString(36).slice(2, 8);
const w30 = cfg.window_30d;
const w7 = cfg.window_7d;

// Filter cases: skip empty rows, optional skip manual
const cases = rawCases.filter(c => {
  if (!c.case_id || !c.created_at || !c.doc_type) return false;
  const ts = new Date(c.created_at).getTime();
  if (isNaN(ts)) return false;
  if (!cfg.include_manual && c.source === 'manual') return false;
  return true;
});

const recent30 = cases.filter(c => new Date(c.created_at).getTime() >= w30);
const recent7 = cases.filter(c => new Date(c.created_at).getTime() >= w7);

// Existing lesson dedup key: doc_type|vendor_tax_id|pattern_keyword
const existingKeys = new Set(
  rawExisting
    .filter(l => ['suggestion', 'approved'].includes(l.status))
    .map(l => [l.doc_type || '*', l.vendor_tax_id || '*', (l.pattern_observed || '').slice(0, 30)].join('|'))
);

function makeLesson(doc_type, vendor_tax_id, field_affected, pattern_observed, lesson_text, suggested_action, evidence_count, case_ids) {
  return {
    lesson_id: `ls_${Date.now()}_${rand6()}`,
    created_at: nowISO,
    status: 'suggestion',
    doc_type: doc_type || '*',
    vendor_tax_id: vendor_tax_id || '*',
    field_affected: field_affected || '*',
    pattern_observed,
    lesson_text,
    suggested_action,
    evidence_count,
    source_case_ids: case_ids.join(','),
    approved_by: '',
    approved_at: '',
    rule_id_ref: '',
  };
}

const newLessons = [];

// --- PATTERN 1: Repeated error pattern per vendor/doc_type (tag-based, excl. no_diff + full_ocr_failure) ---
const EXCLUDE_TAGS = new Set(['no_diff', 'full_ocr_failure']);
const p1Groups = {};
for (const c of recent30) {
  if (!c.root_cause_tag || EXCLUDE_TAGS.has(c.root_cause_tag)) continue;
  const key = [c.doc_type, c.vendor_tax_id || '*', c.root_cause_tag].join('|');
  if (!p1Groups[key]) p1Groups[key] = [];
  p1Groups[key].push(c.case_id);
}
for (const [key, ids] of Object.entries(p1Groups)) {
  if (ids.length < 3) continue;
  const [doc_type, vendor_tax_id, tag] = key.split('|');
  const patternText = `repeated_error_pattern:${tag}`;
  const dedupeKey = [doc_type, vendor_tax_id, patternText.slice(0, 30)].join('|');
  if (existingKeys.has(dedupeKey)) continue;
  newLessons.push(makeLesson(
    doc_type, vendor_tax_id, tag,
    patternText,
    `OCR มีปัญหา "${tag}" ซ้ำ ${ids.length} ครั้ง (30 วัน) สำหรับ ${doc_type} vendor: ${vendor_tax_id}`,
    'ตรวจสอบ few-shot examples และพิจารณาสร้าง runtime rule สำหรับ error pattern นี้',
    ids.length, ids
  ));
}

// --- PATTERN 2: High severity rate > 50% per doc_type in 7d ---
const p2ByType = {};
for (const c of recent7) {
  if (!p2ByType[c.doc_type]) p2ByType[c.doc_type] = { total: 0, high: 0, ids: [] };
  p2ByType[c.doc_type].total++;
  if (c.severity === 'high') { p2ByType[c.doc_type].high++; p2ByType[c.doc_type].ids.push(c.case_id); }
}
for (const [doc_type, stat] of Object.entries(p2ByType)) {
  if (stat.total < 3 || stat.high / stat.total <= 0.5) continue;
  const pct = Math.round((stat.high / stat.total) * 100);
  const patternText = `high_severity_rate:${pct}pct_7d`;
  const dedupeKey = [doc_type, '*', patternText.slice(0, 30)].join('|');
  if (existingKeys.has(dedupeKey)) continue;
  newLessons.push(makeLesson(
    doc_type, '*', '*',
    patternText,
    `เอกสาร ${doc_type} มีอัตราความผิดพลาด high severity ${pct}% ใน 7 วัน (${stat.total} cases)`,
    'ทบทวน few-shot examples และ Gemini prompt สำหรับ doc_type นี้โดยด่วน',
    stat.high, stat.ids
  ));
}

// --- PATTERN 3: Full OCR failure ≥2 per vendor/doc_type ---
const p3Groups = {};
for (const c of recent30) {
  if (c.root_cause_tag !== 'full_ocr_failure') continue;
  const key = [c.doc_type, c.vendor_tax_id || '*'].join('|');
  if (!p3Groups[key]) p3Groups[key] = [];
  p3Groups[key].push(c.case_id);
}
for (const [key, ids] of Object.entries(p3Groups)) {
  if (ids.length < 2) continue;
  const [doc_type, vendor_tax_id] = key.split('|');
  const patternText = `full_ocr_failure:${ids.length}x`;
  const dedupeKey = [doc_type, vendor_tax_id, patternText.slice(0, 30)].join('|');
  if (existingKeys.has(dedupeKey)) continue;
  newLessons.push(makeLesson(
    doc_type, vendor_tax_id, '*',
    patternText,
    `Gemini ไม่สามารถอ่านเอกสาร ${doc_type} vendor: ${vendor_tax_id} ได้ถึง ${ids.length} ครั้ง`,
    'ตรวจสอบคุณภาพภาพ/format เอกสาร และพิจารณาเพิ่ม vendor-specific few-shot example',
    ids.length, ids
  ));
}

return [{ json: { new_lessons: newLessons, analyzed_cases: cases.length, analyzed_at: nowISO } }];
```

---

### Code (Build Telegram)

```javascript
const src = $('Code (Analyze Patterns)').first().json;
const lessons = src.new_lessons || [];

// [SHARED] nowThai — copy from canonical block in existing Code nodes
const nowThai = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

let msg = `*[OCR KM] พบ ${lessons.length} lesson ใหม่ รอ Admin review* 📚\n`;
msg += `_${nowThai()}_\n\n`;
for (const l of lessons.slice(0, 5)) {
  const vendor = l.vendor_tax_id !== '*' ? ` | vendor: ${String(l.vendor_tax_id)}` : '';
  msg += `• *${String(l.doc_type)}*${vendor}\n`;
  msg += `  ${String(l.lesson_text)}\n`;
  msg += `  → ${String(l.suggested_action)}\n`;
  msg += `  evidence: ${l.evidence_count} cases\n\n`;
}
if (lessons.length > 5) msg += `_...และอีก ${lessons.length - 5} lessons_\n`;
msg += '\n[ดู Sheet OCR_KM_LESSONS เพื่อ approve/reject]';

return [{ json: { telegram_text: msg } }];
```

---

### Code (Prepare Lesson Rows)

Split the lessons array into individual items for Sheets append:

```javascript
const src = $('Code (Analyze Patterns)').first().json;
return (src.new_lessons || []).map(l => ({ json: l }));
```

---

### Sheet: OCR_KM_LESSONS Headers (row 1)
```
lesson_id | created_at | status | doc_type | vendor_tax_id | field_affected | pattern_observed | lesson_text | suggested_action | evidence_count | source_case_ids | approved_by | approved_at | rule_id_ref
```
(14 columns, A1:N1)

**Note:** OCR_RULE_CHANGELOG tab สร้างด้วยเพื่อ ready สำหรับ T029C แต่ T029B ไม่เขียนข้อมูลลงไป — headers only:
```
change_id | created_at | rule_id | change_type | changed_by | reason | lesson_id_ref | case_id_refs | before_value | after_value
```

---

## Security Considerations

> 3 คำถาม:
> 1. Webhook รับ input ใหม่ — x-api-key auth required
> 2. ไม่มี secret ใหม่ — ใช้ `OCR_SHARED_API_KEY` + `TELEGRAM_ADMIN_CHAT_ID`
> 3. Telegram message: แสดง vendor_tax_id + doc_type — acceptable (internal admin only), String() cast ทุก field

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| Webhook ไม่มี auth | x-api-key check (Code (Auth + Config) node) |
| Lessons จาก poisoned/test data | source=manual excluded by default + human approve gate |
| lesson_text injection | String() cast บน ทุก field ก่อน concat ใน Telegram |

**Required controls:**
- [x] Auth บน webhook
- [x] No runtime effect (status=suggestion)
- [x] `continueOnFail: true` บน Sheets + Telegram
- [x] Error ไม่ส่ง internal details

---

## Discussion

**Codex Discussion สรุป (2026-02-25):**
- ✅ Timezone fixed: `0 23 * * *` UTC
- ✅ Sheet creation: Sheets API direct (not temp workflow)
- ✅ source=manual: excluded by default
- ✅ P1 field_affected: ใช้ root_cause_tag value (not actual field) — acceptable ตาม scope TRAIN_CASES only
- ✅ FIELD_DIFFS: ไม่อ่านใน T029B (defer)
- ✅ RULE_CHANGELOG: headers only ใน T029B, data written ใน T029C
- ✅ Dedup: inside Analyze node, no separate Deduplicate node
- ✅ Timestamp: `new Date().getTime()` comparisons
- ✅ P1/P3 overlap: excluded `full_ocr_failure` จาก P1
- ✅ Error handling: `continueOnFail` → 200 graceful (ไม่ 500)

_No open concerns — proceeding to implement_

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Trigger on-demand webhook | curl POST /webhook/ocr-km-suggest + x-api-key | 200, `{"ok":true}` |
| T2 | Pattern 1 triggers (if TRAIN_CASES has ≥3 cases same vendor+tag) | trigger | ≥1 lesson row in OCR_KM_LESSONS |
| T3 | OCR_KM_LESSONS row structure correct | อ่าน Sheet หลัง trigger | lesson_id, status=suggestion, evidence_count filled |
| T4 | Telegram sent | Telegram bot | admin ได้ message summary |
| T5 | Dedup works | trigger 2 ครั้งติดกัน | ไม่มี duplicate lesson |
| T6 | No matching pattern → graceful | trigger with empty/no-pattern cases | 200, `{"ok":true,"new_lessons":0}` |
| T7 | Schedule trigger works | wait for 23:00 UTC OR manual test via webhook | workflow runs |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T8 | Wrong API key | 401 response |
| T9 | Telegram down | `continueOnFail` — lessons still written to sheet, 200 |
| T10 | Sheets write error | `continueOnFail` — workflow returns 200 with note, lesson may not persist |
| T11 | source=manual cases only | 0 lessons generated (filtered out) |
| T12 | include_manual=true flag | manual cases included in pattern analysis |

---

## Definition of Done

**Implemented:**
- [ ] `ocr-km-suggest` workflow active
- [ ] `Webhook (trigger)` มี webhookId UUID
- [ ] OCR_KM_LESSONS sheet tab สร้างแล้ว + headers row 1 ครบ 14 columns
- [ ] OCR_RULE_CHANGELOG sheet tab สร้างแล้ว + headers row 1 (empty data — T029C จะเขียน)
- [ ] Code (Analyze Patterns): P1 + P2 + P3 + dedup implemented
- [ ] source=manual filter implemented
- [ ] Telegram notify implemented with continueOnFail

**Verified from system (required):**
- [ ] GET /rest/workflows แสดง ocr-km-suggest, active=true
- [ ] Webhook 401 เมื่อ key ผิด
- [ ] Webhook 200 เมื่อ key ถูก
- [ ] OCR_KM_LESSONS tab exists in spreadsheet (check via Sheets API)

**E2E Passed:**
- [ ] Exec ID: `_______` — on-demand trigger → (lessons written if data qualifies OR new_lessons=0) → response OK

**Docs synced:**
- [ ] HANDOFF.md updated
- [ ] Review file created (CC จะทำ)

---

## Closing Template
*(Codex fill ก่อน push — บังคับ)*

```
Runtime patched:
Verified from:
Docs synced:
Remaining limits:
```
