# T029B — OCR KM Suggestion: Knowledge Generation Phase

**Author:** Claude Code (CC)
**Date:** 2026-02-25
**Assignee:** Codex
**Priority:** Medium
**Risk:** ต่ำ-กลาง (generate suggestions only — no auto-activate, human review required)
**Depends on:** T029A verified (ocr-km-logger active, TRAIN_CASES has ≥7 rows confirmed)

---

## Overview

Scheduled workflow ที่อ่านข้อมูลสะสมจาก OCR_TRAIN_CASES + OCR_TRAIN_FIELD_DIFFS → วิเคราะห์ pattern → เขียน suggestion rows ลง OCR_KM_LESSONS + OCR_RULE_CHANGELOG

**ไม่มีผลต่อ runtime** — ทุก suggestion มี `status=suggestion` รอ human approve ก่อนเสมอ

เป้าหมาย: เมื่อมีข้อมูลสะสมพอ ระบบจะ auto-detect ว่า vendor/field ไหนมีปัญหาซ้ำ แล้วสร้าง lesson สำหรับ human admin พิจารณา

---

## Scope

**In scope:**
- สร้าง workflow ใหม่ `ocr-km-suggest` (scheduled + on-demand webhook)
- สร้าง Sheet tab `OCR_KM_LESSONS` ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0`
- สร้าง Sheet tab `OCR_RULE_CHANGELOG` ใน Spreadsheet เดียวกัน
- Pattern 1: Repeated field error (same field + vendor ≥3 cases ใน window)
- Pattern 2: High severity rate (>50% ใน 7 วัน)
- Pattern 3: Full OCR failure (root_cause_tag = 'full_ocr_failure' ≥2 ครั้งต่อ vendor/doc_type)
- Dedup: ห้ามสร้าง lesson ซ้ำ (เช็ค existing lessons ก่อน)
- Telegram notify admin เมื่อมี new suggestions

**Out of scope (explicit):**
- ห้าม auto-approve lesson ใดๆ — human approve เท่านั้น
- ห้ามแตะ OCR_KM_RUNTIME_RULES (T029C)
- ห้ามแตะ main OCR workflow
- ไม่ต้อง fetch ข้อมูลจาก OCR_RAW4 sheet (ใช้ TRAIN_CASES เท่านั้น)

---

## Technical Spec

### Workflow: `ocr-km-suggest`

**Nodes (เรียงตามลำดับ):**

```
Schedule Trigger (daily 06:00) ──┐
                                  ├──► Code (Load + Analyze) → Code (Pattern 1) → IF (P1 found?)
Webhook (on-demand) ─────────────┘       ↓                          ↓ yes
                                   Code (Pattern 2)          Code (Write P1 Lessons)
                                         ↓                          ↓
                                   Code (Pattern 3)          Google Sheets (Append KM_LESSONS - P1)
                                         ↓                          ↓
                                   Code (Collect Results) ←─────────┘
                                         ↓
                                   IF (any lessons?)
                                         ↓ yes
                                   Google Sheets (Append KM_LESSONS - all)
                                         ↓
                                   Code (Build Telegram Notify)
                                         ↓
                                   Telegram (Admin Notify)
                                         ↓
                                   Respond / Done
```

**Simplified node list (12-15 nodes):**

1. `Schedule Trigger` — Cron: `0 6 * * *` (daily 06:00 Bangkok = UTC+7 = `-1 23 * * *` ถ้า n8n ใช้ UTC)
   - Note: ตรวจสอบ n8n timezone — ถ้า `GENERIC_TIMEZONE=Asia/Bangkok` แล้ว ใช้ `0 6 * * *`
2. `Webhook (trigger)` — path: `ocr-km-suggest`, method POST, responseMode: responseNode
   - ต้องมี `webhookId` UUID (PATTERN-008)
   - Auth: x-api-key vs `$env.OCR_SHARED_API_KEY`
3. `Code (Load TRAIN_CASES)` — อ่านจาก Sheets → pass ข้อมูลไปวิเคราะห์
4. `Code (Analyze Patterns)` — รัน Pattern 1, 2, 3 พร้อมกัน → return array ของ lessons ที่จะสร้าง
5. `Google Sheets (Read TRAIN_CASES)` — อ่าน Sheet OCR_TRAIN_CASES (`getAll`, ไม่ต้อง filter)
6. `Google Sheets (Read KM_LESSONS existing)` — อ่าน OCR_KM_LESSONS เพื่อ dedup
7. `Code (Deduplicate Lessons)` — กรอง lesson ที่มีอยู่แล้วออก (same doc_type + vendor + field + pattern type)
8. `IF (any new lessons?)` — `$json.new_lessons.length > 0`
9. `Google Sheets (Append KM_LESSONS)` — append ทุก lesson ใหม่ (autoMapInputData)
10. `Google Sheets (Append RULE_CHANGELOG)` — 1 row ต่อ lesson: change_type=`suggestion_created`
11. `Code (Build Telegram Notify)` — สรุป N lessons ใหม่ที่ต้อง review
12. `Telegram (Admin KM Notify)` — ส่ง Telegram ไปหา `$env.TELEGRAM_ADMIN_CHAT_ID`
13. `Respond to Webhook (success)` — `{"ok":true,"new_lessons":N}`
14. `Respond to Webhook (no new lessons)` — `{"ok":true,"new_lessons":0,"message":"no new patterns found"}`

---

### Code (Analyze Patterns) — Logic Detail

```javascript
// Input: items = 1 item with { train_cases: [...], existing_lessons: [...] }
const cases = $('Google Sheets (Read TRAIN_CASES)').all().map(i => i.json);
const existing = $('Google Sheets (Read KM_LESSONS existing)').all().map(i => i.json);

const now = new Date().toISOString();
const rand6 = () => Math.random().toString(36).slice(2,8);

// Helper: create lesson object
function makeLesson(type, doc_type, vendor_tax_id, field, pattern_text, lesson_text, action, evidence_count, case_ids) {
  return {
    lesson_id: `ls_${Date.now()}_${rand6()}`,
    created_at: now,
    status: 'suggestion',
    doc_type: doc_type || '*',
    vendor_tax_id: vendor_tax_id || '*',
    field_affected: field || '*',
    pattern_observed: pattern_text,
    lesson_text,
    suggested_action: action,
    evidence_count,
    source_case_ids: case_ids.join(','),
    approved_by: '',
    approved_at: '',
    rule_id_ref: '',
  };
}

// Filter to last 30 days
const cutoff30 = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
const recent = cases.filter(c => c.created_at >= cutoff30);
const recent7d = cases.filter(c => c.created_at >= new Date(Date.now() - 7 * 86400 * 1000).toISOString());

const newLessons = [];

// --- PATTERN 1: Repeated field error (same root_cause_tag + vendor ≥3 cases) ---
// Group by (doc_type, vendor_tax_id, root_cause_tag)
const p1Groups = {};
for (const c of recent) {
  if (c.root_cause_tag === 'no_diff') continue;
  const key = [c.doc_type, c.vendor_tax_id, c.root_cause_tag].join('|');
  if (!p1Groups[key]) p1Groups[key] = [];
  p1Groups[key].push(c);
}
for (const [key, group] of Object.entries(p1Groups)) {
  if (group.length < 3) continue;
  const [doc_type, vendor_tax_id, tag] = key.split('|');
  const caseIds = group.map(c => c.case_id);
  // Dedup check: same doc_type + vendor + tag already exists in status=suggestion/approved
  const dupe = existing.find(l =>
    l.doc_type === doc_type &&
    (l.vendor_tax_id === vendor_tax_id || l.vendor_tax_id === '*') &&
    l.pattern_observed.includes(tag) &&
    ['suggestion', 'approved'].includes(l.status)
  );
  if (dupe) continue;
  newLessons.push(makeLesson(
    'p1', doc_type, vendor_tax_id, tag,
    `พบ error pattern "${tag}" ซ้ำ ${group.length} ครั้ง (30 วัน) สำหรับ vendor ${vendor_tax_id} / ${doc_type}`,
    `OCR มีปัญหา "${tag}" ซ้ำในเอกสาร ${doc_type} ของ vendor ${vendor_tax_id}`,
    'ตรวจสอบ few-shot examples และพิจารณาสร้าง runtime rule สำหรับ field นี้',
    group.length, caseIds
  ));
}

// --- PATTERN 2: High severity rate > 50% ใน 7 วัน ---
// Group by doc_type
const p2ByType = {};
for (const c of recent7d) {
  if (!p2ByType[c.doc_type]) p2ByType[c.doc_type] = { total: 0, high: 0, cases: [] };
  p2ByType[c.doc_type].total++;
  if (c.severity === 'high') { p2ByType[c.doc_type].high++; p2ByType[c.doc_type].cases.push(c); }
}
for (const [doc_type, stat] of Object.entries(p2ByType)) {
  if (stat.total < 3) continue; // ต้องมี data พอ
  const rate = stat.high / stat.total;
  if (rate <= 0.5) continue;
  const dupe = existing.find(l =>
    l.doc_type === doc_type &&
    l.pattern_observed.includes('severity rate') &&
    ['suggestion', 'approved'].includes(l.status)
  );
  if (dupe) continue;
  newLessons.push(makeLesson(
    'p2', doc_type, '*', '*',
    `High severity rate ${Math.round(rate*100)}% ใน ${doc_type} (7 วัน, ${stat.total} cases)`,
    `เอกสาร ${doc_type} มีอัตราความผิดพลาดระดับ high สูงผิดปกติ (${Math.round(rate*100)}%)`,
    'ทบทวน few-shot examples และ Gemini prompt สำหรับ doc_type นี้โดยด่วน',
    stat.high, stat.cases.map(c => c.case_id)
  ));
}

// --- PATTERN 3: Full OCR failure ≥2 ครั้งต่อ vendor/doc_type ---
const p3Groups = {};
for (const c of recent) {
  if (c.root_cause_tag !== 'full_ocr_failure') continue;
  const key = [c.doc_type, c.vendor_tax_id].join('|');
  if (!p3Groups[key]) p3Groups[key] = [];
  p3Groups[key].push(c);
}
for (const [key, group] of Object.entries(p3Groups)) {
  if (group.length < 2) continue;
  const [doc_type, vendor_tax_id] = key.split('|');
  const dupe = existing.find(l =>
    l.doc_type === doc_type &&
    l.vendor_tax_id === vendor_tax_id &&
    l.pattern_observed.includes('full_ocr_failure') &&
    ['suggestion', 'approved'].includes(l.status)
  );
  if (dupe) continue;
  newLessons.push(makeLesson(
    'p3', doc_type, vendor_tax_id, '*',
    `Full OCR failure ${group.length} ครั้ง สำหรับ vendor ${vendor_tax_id} / ${doc_type}`,
    `Gemini ไม่สามารถอ่านเอกสาร ${doc_type} ของ vendor ${vendor_tax_id} ได้ถึง ${group.length} ครั้ง`,
    'ตรวจสอบคุณภาพภาพ/format เอกสาร และพิจารณาเพิ่ม vendor-specific template',
    group.length, group.map(c => c.case_id)
  ));
}

return [{ json: { new_lessons: newLessons, analyzed_at: now, total_cases: cases.length } }];
```

---

### Code (Build Telegram Notify)

```javascript
const src = $('Code (Analyze Patterns) Deduplicated').first().json;
const lessons = src.new_lessons || [];
const nowThai = () => { /* [SHARED] nowThai block */ };

let msg = `*[OCR KM] พบ ${lessons.length} lesson ใหม่ รอ Admin review* 📚\n`;
msg += `_${nowThai()}_\n\n`;
for (const l of lessons.slice(0, 5)) { // max 5 ใน notify
  msg += `• *${l.doc_type}* ${l.vendor_tax_id !== '*' ? `| vendor: ${l.vendor_tax_id}` : ''}\n`;
  msg += `  ${l.lesson_text}\n`;
  msg += `  → ${l.suggested_action}\n`;
  msg += `  evidence: ${l.evidence_count} cases\n\n`;
}
if (lessons.length > 5) msg += `_...และอีก ${lessons.length - 5} lessons_\n`;
msg += `\n[ดู Sheet OCR_KM_LESSONS เพื่อ approve/reject]`;

return [{ json: { telegram_text: msg } }];
```

**Telegram node:** ใช้ `$json.telegram_text`, chatId: `{{ $env.TELEGRAM_ADMIN_CHAT_ID }}`, `continueOnFail: true`

---

### Sheet Headers ที่ต้องสร้าง

**OCR_KM_LESSONS** (row 1 = headers):
```
lesson_id | created_at | status | doc_type | vendor_tax_id | field_affected | pattern_observed | lesson_text | suggested_action | evidence_count | source_case_ids | approved_by | approved_at | rule_id_ref
```

**OCR_RULE_CHANGELOG** (row 1 = headers):
```
change_id | created_at | rule_id | change_type | changed_by | reason | lesson_id_ref | case_id_refs | before_value | after_value
```

สร้าง tab ใน Spreadsheet `12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0` ผ่าน Google Sheets API (Codex ใช้ n8n REST API — สร้าง 1-node temp workflow หรือ patch existing workflow ได้)

**หรือ:** ใช้ `tmp-workflow` สร้าง headers แล้ว deactivate

---

### Patch ที่จำเป็น

**ไม่มี** patch ใน existing workflows สำหรับ T029B — เป็น standalone workflow ใหม่ทั้งหมด

---

## Security Considerations (required)

> 3 คำถาม:
> 1. มีจุดรับ input ใหม่: `Webhook (trigger)` — on-demand trigger
> 2. ไม่มี secret ใหม่ — ใช้ `OCR_SHARED_API_KEY` + `TELEGRAM_ADMIN_CHAT_ID` ที่มีอยู่แล้ว
> 3. Telegram message: แสดง vendor_tax_id + doc_type — acceptable (internal admin only)

| จุดเสี่ยง | Mitigation |
|----------|-----------|
| Webhook ไม่มี auth | ใช้ x-api-key check เช่นเดียวกับ T029A |
| Lessons จาก poisoned training data | Dedup + human approve gate ก่อน use ใน T029C |
| lesson_text injection ใน Telegram | ใช้ String(val) cast ทุก field ก่อน concat |

**Required security controls:**
- [x] Auth บน webhook (x-api-key vs `$env.OCR_SHARED_API_KEY`)
- [x] No runtime effect (status=suggestion เท่านั้น)
- [x] `continueOnFail: true` บน Telegram + Sheets side calls
- [x] Error response ไม่ส่ง internal details

---

## Discussion

_Codex: เพิ่ม concerns / ข้อสงสัย / alternative approach ที่นี่ **ก่อน implement**_

Key questions to consider before implementing:
1. n8n timezone: ตรวจสอบว่า `GENERIC_TIMEZONE` เป็น `Asia/Bangkok` ไหม — ถ้าไม่ใช่ cron `0 6 * * *` จะ fire เวลาผิด
2. Sheet tab creation: ถ้า tab ยังไม่มี → Sheets Append จะ error — ต้องสร้าง tab + headers ก่อน
3. TRAIN_CASES อาจมี test data จาก T029A development (source=manual) — consider filter ออกหรือไม่?

---

## Test Plan

### Happy Path
| # | Test | Method | Expected |
|---|------|--------|----------|
| T1 | Trigger on-demand webhook ด้วย valid key | curl POST /webhook/ocr-km-suggest + x-api-key | 200, `{"ok":true}` |
| T2 | Pattern 1 triggers | ต้องมี ≥3 cases same vendor+doc_type+tag ใน TRAIN_CASES | 1+ lessons ใน OCR_KM_LESSONS |
| T3 | OCR_KM_LESSONS row written correctly | อ่าน Sheet หลัง trigger | row มี lesson_id, status=suggestion, evidence_count≥3 |
| T4 | OCR_RULE_CHANGELOG row written | อ่าน Sheet | row มี change_type=suggestion_created |
| T5 | Telegram sent | Telegram bot | admin chat ได้ message summary |
| T6 | Dedup works | trigger 2 ครั้งติดกัน | ไม่มี duplicate lesson ใน sheet |
| T7 | No data → graceful | trigger เมื่อ TRAIN_CASES ว่าง | 200, `{"ok":true,"new_lessons":0}` |

### Failure / Security / Edge Cases
| # | Test | Expected |
|---|------|----------|
| T8 | Wrong API key | 401 |
| T9 | Telegram down | `continueOnFail` — lessons still written to sheet |
| T10 | Sheets API error | log error, 500 response but no crash |
| T11 | All cases have root_cause_tag=no_diff | 0 lessons generated |

---

## Definition of Done

**Implemented:**
- [ ] `ocr-km-suggest` workflow active
- [ ] `Webhook (trigger)` node มี webhookId UUID
- [ ] OCR_KM_LESSONS sheet tab สร้างแล้ว พร้อม headers ครบ
- [ ] OCR_RULE_CHANGELOG sheet tab สร้างแล้ว พร้อม headers ครบ
- [ ] Pattern 1, 2, 3 implemented ใน Code node
- [ ] Dedup check implemented
- [ ] Telegram notify implemented

**Verified from system (required):**
- [ ] GET /rest/workflows แสดง ocr-km-suggest, active=true
- [ ] Webhook ตอบ 401 เมื่อไม่มี key
- [ ] อย่างน้อย 1 lesson row ใน OCR_KM_LESSONS (ถ้า TRAIN_CASES มี data พอ)

**E2E Passed:**
- [ ] Exec ID: `_______` — trigger on-demand → lessons written → Telegram sent

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
