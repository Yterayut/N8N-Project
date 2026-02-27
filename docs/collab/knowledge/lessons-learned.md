# Lessons Learned — Shared Knowledge Base

> บันทึกสิ่งที่ผิดพลาด ตัดสินใจผิด หรือเรียนรู้จากประสบการณ์จริง
> ทั้ง CC และ Codex เพิ่มได้ — ใส่ชื่อ contributor + task ref + date

---

## LESSON-001: อย่า assume permissions/capabilities ของ agent อื่น

**Contributor:** CC | **Session:** 2026-02-24 | **Ref:** Role redesign

### เกิดอะไรขึ้น
CC อ่าน CODEX.md เดิมที่บอก "DO NOT deploy or test against live n8n" แล้ว assume ว่า Codex ทำไม่ได้จริง → ออกแบบ workflow ให้ CC ทำทุกอย่าง

### ความเป็นจริง
User ยืนยันว่า Codex CAN: patch n8n REST API, read/write SQLite, run bash scripts
CODEX.md เดิมล้าสมัย — ไม่ได้ update ตาม actual capabilities

### Lesson
> ถ้าไม่แน่ใจเรื่อง capabilities ของ agent อื่น → **อ่าน doc ที่ update ล่าสุด หรือถาม user** อย่าเดาจาก doc เก่า

---

## LESSON-002: Spec ที่เขียนโดย Planner มี bug ได้ — Reviewer ต้องจับ

**Contributor:** CC | **Session:** 2026-02-24 | **Ref:** T024

### เกิดอะไรขึ้น
CC เขียน spec ใส่ `$now.format('YYYY-MM')` → Codex execute ตาม spec → ไฟล์ได้ชื่อ `YYYY-02_...`
CC ต้องมา fix ทีหลัง

### Lesson
> **Codex ควร review spec ก่อน execute** — ถ้าเห็น potential issue (เช่น token format) ให้ comment ใน Discussion section ก่อน ไม่ใช่ execute ตาม spec ที่ผิด

> **CC ควร test expression ใน n8n sandbox ก่อนเขียนลง spec** สำหรับ n8n-specific syntax

---

## LESSON-003: Claude Code ห้าม execute งานที่ assign ให้ Codex แล้ว

**Contributor:** CC | **Session:** 2026-02-24

### เกิดอะไรขึ้น
CC patch filename bug (`YYYY-MM` → `yyyy-MM`) เองโดยตรง ทั้งที่ควรเขียน spec แล้วให้ Codex ทำ

### Flow ที่ถูกต้อง
```
CC พบ bug → เขียน task/spec → assign Codex → Codex fix → CC review
```

### Exception
CC execute เองได้ เฉพาะเมื่อ **user สั่งโดยตรง** เท่านั้น

---

## LESSON-004: curl `--data-binary @file` แทน `-d` สำหรับ large payload

**Contributor:** CC | **Session:** 2026-02-24 | **Ref:** T023

### เกิดอะไรขึ้น
`subprocess.run(['curl', '-d', json_string, ...])` → `OSError: Argument list too long`
workflow 109 nodes → JSON ~500KB → เกิน shell arg limit

### Fix
```python
with open('/tmp/patch.json', 'w') as f:
    json.dump(payload, f)
subprocess.run(['curl', '--data-binary', '@/tmp/patch.json', ...])
```

---

## LESSON-005: n8n workflow_entity.nodes อาจว่างเปล่า

**Contributor:** CC | **Session:** ก่อนหน้า

### เกิดอะไรขึ้น
Query `SELECT nodes FROM workflow_entity WHERE id=?` → ได้ `[]` ทั้งที่ workflow มี 109 nodes

### ความเป็นจริง
n8n version ใหม่เก็บ nodes ใน `workflow_history` ไม่ใช่ `workflow_entity`

### Correct Query
```sql
SELECT nodes FROM workflow_history
WHERE workflowId = ? ORDER BY createdAt DESC LIMIT 1
```

---

## LESSON-006: Code inspection ไม่พอสำหรับ n8n node behavior ที่ขึ้นกับ runtime/version

**Contributor:** Codex | **Session:** 2026-02-25 | **Ref:** T028 review response

### เกิดอะไรขึ้น
T028 รอบแรก verify โดยเน้น code inspection + API simulation และ re-fetch workflow จาก n8n API ทำให้ logic หลักดูถูกต้อง แต่พลาด runtime bugs ที่เกิดตอน Telegram E2E จริง:
- IF node `typeVersion` กับ `conditions` format ไม่ match (silent routing/error)
- Code node ทำ binary หล่น แต่ inspection มองไม่เห็น data lineage จริงตอน run
- fan-out connection ยิง Telegram ก่อน `telegram_text` พร้อม

### Lesson
> งาน n8n ที่มี Trigger + Binary + IF/Switch routing ต้องมี **runtime/E2E smoke test อย่างน้อย 1 รอบ** ก่อนสรุปว่า "verified"

> API simulation ช่วยยืนยัน business payload ได้ แต่ **ทดแทน execution graph behavior จริงไม่ได้** (node version schema, connection timing, binary propagation)

---

## LESSON-007: Seed data สำหรับ Google Sheets ต้อง idempotent

**Contributor:** Codex | **Session:** 2026-02-25 | **Ref:** T027 review

### เกิดอะไรขึ้น
Review พบ `OCR_EXAMPLES` มี seed row `ex_seed_001` ซ้ำ 2 แถว ซึ่งชี้ว่า seed logic ถูกรันซ้ำได้โดยไม่มี guard

### Lesson
> งาน seed/init ที่รันซ้ำได้ (Sheets/DB) ต้องออกแบบให้ **idempotent** ตั้งแต่แรก

แนวทาง:
- ใช้ stable key (`example_id`) แล้วเช็คก่อน insert
- หรือใช้ upsert pattern (ถ้า backend รองรับ)
- log ว่า `seed inserted` vs `seed already exists` เพื่อ debug ได้ง่าย

---

## LESSON-008: Helper/Tmp Workflows ต้อง cleanup ใน task เดียวกัน

**Contributor:** Codex | **Session:** 2026-02-25 | **Ref:** T026 review response

### เกิดอะไรขึ้น
ระหว่างทำ T026 ใช้ tmp workflows เพื่อ create/seed Google Sheet และ verify step-wise ได้เร็ว แต่ปิดงานแล้วลืมลบออกจาก n8n (inactive แต่ยังค้าง)

### Impact
- ไม่กระทบ production flow โดยตรง
- เพิ่ม operational clutter และทำให้ review มี low-severity follow-up ที่ไม่จำเป็น

### Lesson
> งานที่สร้าง helper resources ชั่วคราว (tmp workflow / temp webhook / seed node) ต้องมี **cleanup checklist** และทำก่อนส่ง review

---

## LESSON-009: Logging Workflow Verification ต้องแยก "Node Ran" กับ "Row Content Correct"

**Contributor:** Codex | **Session:** 2026-02-25 | **Ref:** T029A review response

### เกิดอะไรขึ้น
T029A verify ผ่านระดับ runtime execution:
- webhook auth ผ่าน/ไม่ผ่านถูกต้อง
- nodes รันครบ
- Sheets append nodes success

แต่ review ชี้ช่องว่างว่า ยังไม่ได้ verify ระดับ semantic output:
- `root_cause_tag` ถูกคำนวณถูกต้องจริงหรือไม่
- `ocr-training` path (`IF (KM Log?)`) ยิง km-log call จริงใน flow จริงหรือไม่

### Lesson
> สำหรับงาน logging/telemetry ใน n8n ให้แยก verification เป็น 2 ชั้น:
> 1) **Execution verification** (node รัน, HTTP 200, append success)
> 2) **Data verification** (spot-check คอลัมน์สำคัญใน Sheets/DB)

> สรุปว่า "verified" ได้เร็วในชั้นที่ 1 แต่ก่อนปิด task ควรมีอย่างน้อย 1 sample check ในชั้นที่ 2 ถ้างานมี derived fields / routing guards

### เพิ่มเติม (Design note)
- Webhook auth แบบ `$env` shared key ที่ **env ว่างแล้ว reject-all** เป็น behavior ที่ถูกต้อง (fail-closed) และควรระบุไว้ชัดใน review/spec เพื่อลด re-check ซ้ำ

---

---

## LESSON-010: Agent Output — Don't Trust, Verify Only (GG และ Codex)

**Contributor:** CC | **Session:** 2026-02-26 | **Ref:** GG Curation Report 2026-02-25

### เกิดอะไรขึ้น
GG curation report ระบุว่า Tax ID `107561000013` เป็นของ "Internet Thailand Public Co., Ltd. (INET)"
CC review ผ่านโดยไม่ verify — user แก้ว่าข้อมูลผิด: Tax ID ของ INET จริงๆ คือ `0107544000094`

### ความเป็นจริง
LLM agents (GG และ Codex) สามารถ hallucinate หรือ implement ผิดได้โดยไม่มี warning
CC รับ output มาโดยไม่ตรวจสอบ → ข้อมูลผิดถูก propagate ออกไป

### Policy (บังคับ 2026-02-26)
> **GG และ Codex output ทุกชิ้น = "Don't Trust, Verify Only"**
> CC ต้อง verify ก่อน accept / merge / execute เสมอ — ไม่มีข้อยกเว้น

#### GG Output
| ประเภท | ระดับ trust | วิธี verify |
|--------|-------------|-------------|
| Entity data (Tax ID, ชื่อบริษัท, เลขทะเบียน) | Zero | ถาม user หรือ verify จากแหล่งจริง |
| Curation recommendations (KEEP/REMOVE) | Low | verify factual claims ก่อน execute |
| Spec draft (code, architecture) | Low | CC review ทุกบรรทัด |
| Pattern analysis / structural review | Medium | spot-check raw data ประกอบ |

#### Codex Output
| ประเภท | ระดับ trust | วิธี verify |
|--------|-------------|-------------|
| n8n workflow patches | Low | re-fetch จาก n8n API + smoke test |
| SQLite / data writes | Low | query ยืนยันหลัง write เสมอ |
| Bash scripts | Low | อ่าน code ก่อน merge ทุกบรรทัด |
| Test results ที่ Codex report | Low | ดู exec ID + ตรวจ n8n execution log จริง |

### ตัวอย่างที่ถูก
Tax ID `107561000013` → GG claim ว่าเป็น INET → **CC ไม่ accept** → user confirm ว่าผิด

---

## LESSON-011: ถ้าต้อง query "recent errors" ภายหลัง ต้องใส่ date ใน log line ตั้งแต่แรก

**Contributor:** Codex | **Session:** 2026-02-26 | **Ref:** T034 review response

### เกิดอะไรขึ้น
`gg-health.sh` ต้องรายงาน error log ในช่วง 24 ชั่วโมงล่าสุด แต่ shared log format ใน `scripts/gg/common.sh` มีแค่เวลา (เช่น `HH:MM:SS`) ไม่มีวันที่

ผลคือ health check ทำได้แค่ใช้ file `mtime` เป็น gate แล้วนับทั้งไฟล์ ซึ่งเป็น **approximation** และอาจ over-report ได้ถ้ามี error เก่าเยอะแต่ไฟล์เพิ่งถูก append

### Lesson
> ถ้ามีโอกาสต้องทำ monitoring/health metrics แบบ rolling window (`last 1h`, `last 24h`) ให้ log line format มี **full datetime** (`YYYY-MM-DD HH:MM:SS`) ตั้งแต่วันแรก

แนวทาง:
- ใช้ timestamp ที่ parse/grep ได้ง่ายและ timezone ชัดเจน
- ออกแบบ log format โดยคิด use case downstream (health check, alerting, analytics) ล่วงหน้า
- ถ้ายังแก้ format ไม่ได้ ให้ label metric ว่าเป็น `approximate` ชัดเจนเพื่อกันตีความผิด

---

## LESSON-012: Side-system nodes ต้องมี `continueOnFail=True` ตั้งแต่วันแรก

**Contributor:** CC | **Session:** 2026-02-26 | **Ref:** S2 hotfix, tech-debt-plan

### เกิดอะไรขึ้น
OCR audit พบว่า 8 nodes ที่เป็น side-system (Telegram notify, Sheets logging, HTTP GET rules) ไม่มี `continueOnFail=True`
ถ้า Telegram rate limit หรือ Google Sheets quota เกิน → OCR ทั้งหมดพัง ทั้งที่เป็นแค่ logging

### ความเสี่ยงที่เกิดขึ้นได้จริง
- **Google Sheets quota exceeded** (ช่วง batch หรือ concurrent requests) → OCR ทุก request fail ทันที
- **Telegram rate limit** (100 msg/min) → test หนักๆ → OCR พัง
- **ocr-rules-reader timeout** → OCR พังแม้ flag=false (เกิดได้ทุกวัน)

### Lesson
> **Side-system nodes ต้องมี `continueOnFail=True` ตั้งแต่วันที่สร้าง** ไม่ใช่แก้ทีหลัง

หลักการแบ่ง:
| ประเภท node | continueOnFail | เหตุผล |
|------------|----------------|--------|
| Gemini API (GenerateContent) | **False** | ถ้า Gemini พัง → OCR ทำไม่ได้จริง → ควร stop |
| Prompt template (Get row Prompt) | **False** | ไม่มี prompt → OCR ทำไม่ได้ |
| Google Sheets logging (OCR_RAW*) | **True** | logging ไม่ควรฆ่า main flow |
| Telegram notify | **True** | Telegram down ≠ OCR fail |
| HTTP GET side rules/flags | **True** | ถ้า load fail → proceed gracefully |

---

## LESSON-013: Python script ที่รับ stdin ห้ามใช้ heredoc ภายใน pipe

**Contributor:** CC | **Session:** 2026-02-26 | **Ref:** S1+S2+S3 patch

### เกิดอะไรขึ้น
```bash
# ❌ ทำงานไม่ได้ — heredoc กิน stdin ก่อน pipe
curl ... | python3 << 'PYEOF'
import json, sys
d = json.load(sys.stdin)  # ← ได้ empty เพราะ heredoc ใช้ stdin แล้ว
PYEOF
```

### Fix
```bash
# ✅ เซฟ script เป็น file ก่อน แล้วใช้ pipe ปกติ
cat > /tmp/myscript.py << 'PYEOF'
import json, sys
d = json.load(sys.stdin)
...
PYEOF

curl ... | python3 /tmp/myscript.py > /tmp/output.json
```

### Lesson
> **ถ้า Python script ต้องรับ stdin ผ่าน pipe → ต้องเซฟเป็นไฟล์ก่อนเสมอ** — heredoc ภายใน pipe จะ overwrite stdin

---

## LESSON-014: Benchmark metrics ต้องแยก "transport/runtime failure" ออกจาก "OCR accuracy"

**Contributor:** Codex | **Session:** 2026-02-26 | **Ref:** T029D review response

### เกิดอะไรขึ้น
OCR benchmark runner v1 ให้ score=0 และ `fail` เหมือนกันทั้งกรณี:
- OCR quality ต่ำจริง (field compare ไม่ match)
- request ไป OCR webhook ไม่สำเร็จ (`http_0`, timeout, path/file issue)

ผลคือค่าเฉลี่ย accuracy ถูกกดลงด้วย infrastructure/transport errors และทำให้ตีความคุณภาพ OCR ผิดได้

### Lesson
> งาน benchmark/QA runner ต้องแยกสถานะอย่างน้อย 2 ชั้น: **execution status** (transport/parse/runtime) และ **model score** (accuracy เฉพาะ rows ที่ score ได้จริง)

แนวทาง:
- เก็บ `http_code` / `curl_exit_code` / `parse_error` แยกคอลัมน์
- คิด `avg_accuracy` จาก rows ที่ `ocr_scored` เท่านั้น
- report `transport_fail_count` แยกจาก `fail_count` (accuracy fail)
- ถ้ามี unsupported fixture (เช่น non-PDF ใน OCR benchmark) ให้ mark `skip` แทน `fail`

---

## LESSON-015: n8n Executions API filter ต้อง verify จาก payload จริง ไม่ใช่ trust query string อย่างเดียว

**Contributor:** Codex | **Session:** 2026-02-26 | **Ref:** T036 review response

### เกิดอะไรขึ้น
ระหว่าง verify งาน health report ใช้ `GET /rest/executions?workflowId=<id>&limit=3` เพื่อตรวจ executions ล่าสุดของแต่ละ workflow แต่ผลที่ได้คืน execution IDs ชุดเดียวกันทุก workflow (เหมือนไม่ filter ตาม `workflowId`)

### ความเสี่ยง
- สรุปผล monitoring/verification ผิด workflow โดยไม่รู้ตัว
- reviewer/maintainer อาจ trust endpoint filter แล้วตัดสินใจจากข้อมูลผิด

### Lesson
> เวลาใช้ n8n REST API สำหรับ executions list ให้ถือว่า query filter เป็น **hint** และต้อง verify จาก field ใน response (`workflowId`, `finished`, `status`, `startedAt`) ก่อนใช้สรุปผล

แนวทาง:
- spot-check `workflowId` ทุก record ที่นำมาอ้างอิง
- ถ้าผลดูแปลก (IDs ซ้ำข้าม workflow) ให้ query รายละเอียด execution ราย ID เพิ่มเติมเพื่อยืนยัน
- ใน docs/review ระบุข้อจำกัดนี้ไว้ชัดเจน เพื่อลดการตีความผิดซ้ำ

---

## LESSON-016: Fallback Chain ต้องมี fail-fail test evidence ก่อนปิด task

**Contributor:** Codex | **Session:** 2026-02-27 | **Ref:** T041C review response

### เกิดอะไรขึ้น
งาน fallback direct path (Gemini → Typhoon) ทดสอบครบกรณีหลัก:
- Gemini fail + Typhoon success
- Gemini success (normal path)

แต่ไม่ได้เก็บหลักฐานทดสอบกรณี edge สุดท้ายที่ทั้งสองชั้นล้มพร้อมกัน (Gemini fail + Typhoon fail) ในรอบเดียวกัน

### Lesson
> งานที่เป็น multi-layer fallback ต้องมี test matrix อย่างน้อย 3 กรณีเสมอ: main success, fallback success, และ fallback fail

แนวทาง:
- วาง test matrix ตั้งแต่เริ่ม implement ไม่ใช่เพิ่มท้ายงาน
- เก็บหลักฐานทั้งระดับ node output และ final webhook response
- ถ้า fallback-fail ยังไม่ test ต้องระบุเป็น open risk ใน task/review ให้ชัด

---

*อัปเดตล่าสุด: 2026-02-27 by CC + Codex*
