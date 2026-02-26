# OCR Technical Debt & Optimization Plan

**Author:** Claude Code (CC)
**Date:** 2026-02-26
**Scope:** Main OCR workflow (`up1n75qEhbsXswii`) + 5 supporting workflows
**Audit basis:** 53 Code nodes + 36 side-system nodes (Sheets/Drive/Telegram/HTTP)

---

## Executive Summary

| ลำดับ | หัวข้อ | Severity | Effort | Timeline |
|-------|--------|----------|--------|----------|
| [S1] | Timing-safe API key (Validate Feedback Payload) | 🔴 HIGH | 5 min | วันนี้ |
| [S2] | continueOnFail บน side-system nodes (logging, Telegram) | 🟡 MEDIUM | 30 min | วันนี้ |
| [S3] | Document $json exception ใน Validate Feedback Payload | 🔵 LOW | 2 min | วันนี้ |
| [M1] | Extract duplicate code paths (JS9/JS24, Split Bills) | 🟡 MEDIUM | 2–3 h | Sprint ถัดไป |
| [M2] | Error detail ใน Code (Normalize + Validate) | 🟡 MEDIUM | 1 h | Sprint ถัดไป |
| [L1] | แยก God Function → per-doc_type nodes | 🔵 LOW | 3–5 h | T037 |
| [L2] | Unit test framework สำหรับ Code nodes | 🔵 LOW | 1–2 d | T038 |

---

## ระยะสั้น (วันนี้)

---

### [S1] Timing-Safe API Key — Code (Validate Feedback Payload)

#### ปัญหา

```javascript
// ❌ บรรทัด 23 — ปัจจุบัน
if (givenKey !== expectedKey) {
  return [{ json: { response_code: 401, ... } }];
}
```

การใช้ `!==` เปรียบเทียบ string เสี่ยง **timing attack** — JavaScript engine อาจ short-circuit ทำให้ response time ต่างกันตาม prefix ที่ match ผู้โจมตี measure latency → ไล่ brute-force API key ทีละ character ได้

#### ความเสี่ยง

| ความเสี่ยง | ระดับ | เงื่อนไข |
|-----------|-------|---------|
| API key leak | สูง | ถ้า attacker มี network access โดยตรงถึง ngrok endpoint |
| Feedback poisoning | สูง | ถ้า unlock feedback endpoint → inject fake training data |
| Production impact | ต่ำ | ต้องใช้เวลา + หลาย requests มาก → ไม่ใช่ immediate breach |

#### แก้ไข

```javascript
// ✅ เพิ่มก่อน if block
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// แทนที่ if (givenKey !== expectedKey)
if (!timingSafeEqual(givenKey, expectedKey)) {
  return [{ json: { validation_ok: false, auth_ok: false, response_code: 401, ... } }];
}
```

#### Acceptance Criteria

- [ ] wrong-key → 401 (timing consistent)
- [ ] correct-key → pass validation ✅
- [ ] ไม่กระทบ logic อื่นใน node (payload validation ยังเดิม)

---

### [S2] continueOnFail บน Side-System Nodes

#### ปัญหาเต็ม

จาก audit พบ 20+ nodes ที่ `continueOnFail=False` แต่ควรเป็น `true` เพราะเป็น side-system (logging, notification)

**หลักการแบ่ง:**

| ประเภท | continueOnFail | เหตุผล |
|--------|----------------|--------|
| Gemini API (GenerateContent) | ❌ False = ถูก | ถ้า Gemini พัง → OCR ทำไม่ได้ → stop ถูก |
| Prompt template (Get row Prompt) | ❌ False = ถูก | ไม่มี prompt → OCR ทำไม่ได้ |
| Google Sheets logging (OCR_RAW) | ✅ **True** = ต้องแก้ | logging ไม่ควรฆ่า OCR |
| Google Sheets (row_key check) | ✅ **True** = ต้องแก้ | ถ้า check ล้มเหลว → skip dedup (graceful) |
| Telegram notify | ✅ **True** = ต้องแก้ | Telegram down ไม่ควรทำให้ OCR fail |
| Google Drive download | ✅ **True** = ต้องแก้ | download อาจ optional |
| HTTP GET ocr-rules-reader | ✅ **True** = ต้องแก้ | rules load fail → OCR proceed without rules |

**Nodes ที่ต้องแก้ (ลำดับความสำคัญ):**

```
Priority A — OCR จะพังถ้าสิ่งเหล่านี้ down (แก้ก่อน):
  ❌ Telegram (OCR Notify)              → True   (Telegram down ≠ OCR fail)
  ❌ Append row in OCR_RAW3             → True   (logging ไม่ blocking)
  ❌ Append row in OCR_RAW4             → True   (logging ไม่ blocking)
  ❌ Append row in OCR_RAW9             → True   (logging ไม่ blocking)
  ❌ Append row in OCR_RAW10            → True   (logging ไม่ blocking)
  ❌ Append row in shee OCR             → True   (logging ไม่ blocking)
  ❌ Append row in shee OCR3            → True   (logging ไม่ blocking)
  ❌ HTTP GET ocr-rules-reader          → True   (rules optional — OCR_RUNTIME_RULES_ENABLED gate)

Priority B — Flow อาจสะดุดแต่ impact น้อย:
  ❌ Google Sheets (Get All row_key)    → True   (dedup fail → allow duplicate → acceptable)
  ❌ Google Sheets (Get All row_key)3   → True   (same)
  ❌ Download file (Google Drive)       → True   (queue path — file might not exist)

Priority C — ต้องตรวจสอบก่อน (อาจเป็น critical path):
  ❌ HTTP Request1                      → ตรวจก่อนว่าใช้ทำอะไร
  ❌ HTTP Upload File5                  → ถ้า re-upload optional → True
  ❌ HTTP Upload File9                  → ถ้า re-upload optional → True
  ❌ Get row(s) in sheet1               → ตรวจ
  ❌ Get row(s) in sheet2               → ตรวจ
```

#### ความเสี่ยงถ้าไม่แก้

- **Google Sheets quota exceeded** (ซึ่งเกิดได้ช่วง batch) → OCR ทุก request fail ทันที
- **Telegram rate limit** (100 msg/min) → ถ้ายิง test หนักๆ → Telegram reject → OCR พัง
- **ocr-rules-reader timeout** → OCR พังแม้ flag=false (**เกิดได้ทุกวัน**)

#### แก้ไขผ่าน n8n REST API

```bash
# ตัวอย่างสำหรับ Telegram (OCR Notify)
# 1. GET workflow → ดู node parameters
# 2. ตั้ง continueOnFail: true ใน PATCH

curl -X PATCH http://localhost:5678/rest/workflows/up1n75qEhbsXswii \
  -b cookie.txt \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [...nodes with continueOnFail updated...]
  }'
```

> ⚠️ ห้าม set `continueOnFail=True` บน Gemini API nodes (GenerateContent, Upload) — ถ้า Gemini fail ต้องให้ error propagate ตาม retry logic

#### Acceptance Criteria

- [ ] ทดสอบ: Telegram token ผิด → OCR ยังตอบ 200
- [ ] ทดสอบ: Google Sheets quota error → OCR ยังตอบ 200 (log fail gracefully)
- [ ] Gemini nodes ยัง continueOnFail=False

---

### [S3] Document $json Exception — Code (Validate Feedback Payload)

#### ปัญหา

```javascript
// บรรทัด 0-1 ปัจจุบัน — ไม่มี comment อธิบาย
const payload = ($json && typeof $json.body === 'object' ...) ? $json.body : ($json || {});
```

หลังจาก refactor ใดๆ ที่เพิ่ม upstream node → `$json` จะ point ไปที่ node ล่าสุดแทน webhook → silent bug

#### แก้ไข

```javascript
// [PATTERN-001 EXCEPTION] Node นี้มี upstream 1 ตัว (Webhook_OCR_Feedback) เท่านั้น
// ถ้าเพิ่ม upstream node ในอนาคต → เปลี่ยนเป็น:
//   const src = $('Webhook_OCR_Feedback').first().json;
const payload = ($json && typeof $json.body === 'object' ...) ? $json.body : ($json || {});
```

---

## ระยะกลาง (Sprint ถัดไป)

---

### [M1] Extract Duplicate Code Paths

#### สภาพปัจจุบัน

Main workflow มี **2 entry paths** แบบ parallel:

```
Path A (ocr-dev):   Webhook_OCR_Test5 → JS5 → JS9 → ... → Split Bills  → Check Duplicates
Path B (ocr-dev2):  Webhook_OCR_Test9 → JS25 → JS24 → ... → Split Bills3 → Check Duplicates3
```

Code ที่ **copy-paste กัน 100%** ยกเว้น webhook source name:

| Node A | Node B | ต่างกันแค่ |
|--------|--------|-----------|
| Code in JavaScript9 | Code in JavaScript24 | `Webhook_OCR_Test5` vs `Webhook_OCR_Test9` |
| Code (Split Bills) | Code (Split Bills)3 | `$('Code (Finalize Decision)')` vs `$('Code in JavaScript24')` |
| Code (Check Duplicates) | Code (Check Duplicates)3 | source ref เท่านั้น |
| Append row in OCR_RAW3 | Append row in OCR_RAW9 | ค่าเหมือนกัน |

**ปัญหา:** แก้ bug ที่ Path A → ต้องแก้ Path B เองด้วยทุกครั้ง (human error)

#### แนวทาง Refactor

**Option A — n8n Sub-workflow (แนะนำ)**

```
Webhook_OCR_Test5 ──┐
                    ├─→ Code (Normalize Entry) → Execute Workflow: ocr-core-processor
Webhook_OCR_Test9 ──┘
```

`ocr-core-processor` รับ: `{ file_binary, api_key, source_webhook }` → return OCR result

**Option B — Shared Execute Workflow Node**

Merge 2 paths เป็น 1 ด้วย Execute Workflow ตรงกลาง (ง่ายกว่า refactor ทั้ง workflow)

**ความเสี่ยง:**

| ความเสี่ยง | ระดับ | Mitigation |
|-----------|-------|-----------|
| Break binary carry-through | สูง | ทดสอบ binary ผ่าน sub-workflow ก่อน merge |
| n8n sub-workflow overhead | กลาง | แต่ละ call +50–100ms — ยอมรับได้ |
| Rollback complexity | กลาง | ต้องทำ A/B test ก่อน decommission Path A/B |

---

### [M2] Error Detail ใน Code (Normalize + Validate)

#### ปัญหาปัจจุบัน

```javascript
// ปัจจุบัน — รู้แค่ว่ามีกี่ error ไม่รู้ว่า rule ไหน fail
critical_error_count: 3,
warnings: [],
errors: []
// ไม่มี field บอกว่า error มาจาก rule อะไร
```

ถ้า OCR fail → debug ยากมากเพราะไม่รู้ว่า validation rule ไหนที่ block

#### แก้ไข

เพิ่ม `validation_trace` array ใน output:

```javascript
// ✅ เพิ่ม
validation_trace: [
  { rule: 'vendor_tax_id_format', field: 'vendor_tax_id', value: '123', result: 'fail', msg: 'must be 13 digits' },
  { rule: 'total_positive', field: 'total', value: -5, result: 'fail', msg: 'total must be > 0' },
  { rule: 'invoice_date_th_format', field: 'invoice_date_th', value: '01/13/2568', result: 'warn', msg: 'month > 12' },
]
```

**ความเสี่ยง:** น้อย — เพิ่ม field ใหม่ ไม่เปลี่ยน field เดิม ไม่กระทบ downstream

---

## ระยะยาว (Future Sprint)

---

### [L1] แยก God Function → Per-Doc-Type Validation Nodes

#### สภาพปัจจุบัน

`Code (Normalize + Validate)` — **19,909 chars / ~400 lines** มี logic สำหรับทุก doc_type ในที่เดียว

```javascript
// ปัจจุบัน — ทุกอย่างใน node เดียว
if (doc_type === 'electricity') {
  // 50 lines of electricity validation
} else if (doc_type === 'fuel') {
  // 80 lines of fuel validation
} else if (doc_type === 'fleet_card') {
  // 60 lines of fleet validation
}
```

#### แนวทาง Refactor

```
Code (Normalize + Validate)  [ลด → schema check เท่านั้น]
  → IF: doc_type
    → electricity → Code (Validate Electricity)   [~80 lines]
    → fuel        → Code (Validate Fuel)           [~80 lines]
    → fleet_card  → Code (Validate Fleet Card)     [~60 lines]
    → parking     → Code (Validate Parking)        [~40 lines]
    → other       → Code (Validate Generic)        [~30 lines]
  → Code (Merge Validation Results)
```

**ประโยชน์:**
- เพิ่ม doc_type ใหม่ → สร้าง node เดียวโดยไม่แตะ node อื่น
- debug เฉพาะ doc_type ได้
- ทดสอบแยกได้

**ความเสี่ยง:**

| ความเสี่ยง | ระดับ | Mitigation |
|-----------|-------|-----------|
| Regression ใน validation logic | สูง | ต้องรัน benchmark T029D ก่อน/หลัง refactor |
| nowThai() sync เพิ่มขึ้น | กลาง | ต้องอัปเดต canonical block ทุก node ใหม่ |
| workflow node count เพิ่ม | ต่ำ | ปัจจุบัน 114 nodes → +5 nodes ยังรับได้ |

> ⚠️ **ต้องผ่าน T029D benchmark pass ≥ 80% ก่อนเริ่ม** — เป็น safety net

---

### [L2] Unit Test Framework สำหรับ Code Nodes

#### ปัญหาปัจจุบัน

ไม่มี unit test — ทดสอบได้แค่ E2E ผ่าน `/webhook/ocr-dev` เท่านั้น ถ้า validation logic มี bug → ค้นพบเมื่อ OCR fail จริงๆ

#### แนวทาง

**Phase 1 — Test Fixtures (ง่ายที่สุด)**

สร้าง script ที่รัน Code node logic ใน Node.js โดยตรง:

```javascript
// scripts/tests/test_normalize_validate.js
const { normalizeAndValidate } = require('./normalize_validate_extracted');

test('fuel bill — valid', () => {
  const result = normalizeAndValidate({
    vendor_tax_id: '1234567890123',
    total: 1000,
    doc_type: 'fuel'
  });
  expect(result.critical_error_count).toBe(0);
});
```

**Phase 2 — n8n Test Workflow**

สร้าง `ocr-unit-tests` workflow ที่รัน test cases และ report ใน Telegram

**ความเสี่ยง:**
- Code node ใน n8n ไม่สามารถ import/export ได้โดยตรง → ต้อง extract logic ออกมาเป็น plain JS ก่อน
- Maintenance burden เพิ่ม: ต้อง sync logic ระหว่าง n8n node กับ test file

---

## Risk Matrix สรุป

```
         Impact
          HIGH  │ [S2] continueOnFail   [S1] Timing-safe
                │  (Sheets/Telegram)     (API key)
        MEDIUM  │ [M2] Error detail     [M1] Dedup paths
                │                        extraction
           LOW  │ [S3] $json comment    [L1] God function
                │                       [L2] Unit tests
                └──────────────────────────────────────
                    LOW         MEDIUM        HIGH
                              Effort
```

---

## แผนการ Implement

### วันนี้ (CC + Codex)

```bash
# ลำดับที่แนะนำ:
1. [S1] CC patch Code (Validate Feedback Payload) → timingSafeEqual  # 5 min
2. [S2] CC patch Priority A nodes → continueOnFail=True              # 20 min
3. [S3] CC patch comment ใน Validate Feedback Payload               # 2 min
```

**ประมาณ 30 นาที รวม test + commit**

### Sprint ถัดไป (T037 — assign Codex)

```
T037-normalize-error-trace:
  - เพิ่ม validation_trace ใน Code (Normalize + Validate) [M2]

T037-dedup-paths: (หลัง T037 error trace ผ่าน)
  - Extract duplicate code paths [M1]
  - ต้อง run benchmark T029D ก่อนและหลัง
```

### Future (T038)

```
T038-god-function:    แยก validation per doc_type [L1]
                      Depends on: T029D benchmark pass ≥80%
T038-unit-tests:      Unit test framework [L2]
                      Depends on: T037 dedup paths เสร็จ
```

---

## DoD ของทั้ง Plan

**ระยะสั้น เสร็จเมื่อ:**
- [ ] `timingSafeEqual` ใน Validate Feedback Payload — wrong-key 401 ยัง pass, ไม่มี regression
- [ ] Priority A nodes ทั้ง 8 ตัว `continueOnFail=True` — ทดสอบ Sheets error / Telegram down
- [ ] $json comment เพิ่มแล้ว
- [ ] `./scripts/verify_nowThai_sync.sh` pass ✅

**ระยะกลาง เสร็จเมื่อ:**
- [ ] T029D benchmark ก่อน refactor = baseline
- [ ] validation_trace field ปรากฏใน OCR response เมื่อมี error
- [ ] duplicate code paths ลดลง

**ระยะยาว เสร็จเมื่อ:**
- [ ] T029D benchmark หลัง refactor ≥ baseline accuracy
- [ ] God function แยกเป็น ≥4 nodes
- [ ] Unit tests รัน pass ≥90%
