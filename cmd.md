# CMD Notes: Create OCR Training Sheets in Google Spreadsheet

บันทึกวิธีสร้าง Google Sheet tabs สำหรับงานเทรน OCR (ใช้ credential จาก n8n runtime เดิม)

## เป้าหมาย

สร้าง sheet ใหม่ในไฟล์ Google Sheet เดิม พร้อม header row สำหรับงานเรียนรู้ OCR:

- `OCR_TRAIN_CASES`
- `OCR_TRAIN_FIELD_DIFFS`
- `OCR_FUEL_TEMPLATES`
- `OCR_RULE_CHANGELOG`
- `OCR_BENCHMARK_FUEL`
- `OCR_KM_LESSONS`
- `OCR_KM_RUNTIME_RULES`

## ข้อควรระวัง (สำคัญ)

- ห้ามเอาไฟล์ credential decrypted ขึ้น GitHub
- ไฟล์ชั่วคราวให้เก็บใน `/tmp/...`
- ถ้าใช้สคริปต์ทดสอบ ให้ลบไฟล์ credential หลังใช้งานเสร็จ

## ขั้นตอน (ใช้ได้จริงกับเครื่อง server ที่รัน n8n)

### 1) หา n8n runtime ที่ใช้งานจริง

ตรวจ process และ `N8N_USER_FOLDER` ของ n8n ที่รันอยู่:

```bash
ps -ef | rg '[n]8n|node .*n8n'
PID=$(pgrep -f 'node .*n8n start' | head -1)
tr '\0' '\n' < /proc/$PID/environ | rg '^N8N_USER_FOLDER='
```

ตัวอย่างที่เคยใช้จริง:

```bash
N8N_USER_FOLDER=/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev
```

### 2) Export credentials จาก n8n runtime (เฉพาะ local)

Export credential ทั้งหมด (เพื่อหา Google Sheets credential ID ที่ runtime ใช้อยู่):

```bash
mkdir -p /tmp/ocr-sheet-setup
N8N_USER_FOLDER=/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev \
  n8n export:credentials --all --output=/tmp/ocr-sheet-setup/runtime-creds.json
```

หา credential type `googleSheetsOAuth2Api`:

```bash
python3 - <<'PY'
import json
data=json.load(open('/tmp/ocr-sheet-setup/runtime-creds.json'))
for c in (data if isinstance(data,list) else [data]):
    if c.get('type')=='googleSheetsOAuth2Api':
        print(c.get('id'), '|', c.get('name'))
PY
```

จากนั้น export decrypted เฉพาะ credential ที่ต้องใช้ (ตัวอย่าง ID ที่เจอครั้งก่อน: `mbHVpStNSdk4RYCB`)

```bash
N8N_USER_FOLDER=/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev \
  n8n export:credentials --id=mbHVpStNSdk4RYCB --decrypted \
  --output=/tmp/ocr-sheet-setup/runtime-gs2-decrypted.json
```

### 3) สร้างสคริปต์ Node.js สำหรับ add sheets + write headers

สร้างไฟล์ `/tmp/ocr-sheet-setup/create_training_sheets.js`

```bash
cat > /tmp/ocr-sheet-setup/create_training_sheets.js <<'EOF'
const fs = require('fs');
const https = require('https');

const SHEET_ID = '12L5A0I36lNzyoKlrBl9hIbIvsfbUVFcmXDj_bE3sAr0';
const CRED_PATH = '/tmp/ocr-sheet-setup/runtime-gs2-decrypted.json';

const SHEETS = {
  OCR_TRAIN_CASES: [
    'case_id','created_at','trainer','source_file','request_id','document_id','page_no','bill_category','vendor_brand','template_name','template_fingerprint','ocr_status','issue_types','expected_bills_count','actual_bills_count','is_duplicate_issue','ocr_json_before','correct_json_expected','notes','action_taken','rule_version','retest_status','retest_request_id','learning_summary'
  ],
  OCR_TRAIN_FIELD_DIFFS: [
    'diff_id','case_id','bill_index','field_path','field_group','ocr_value','expected_value','diff_type','severity','root_cause_guess','fix_strategy','fixed_in_version','retest_result'
  ],
  OCR_FUEL_TEMPLATES: [
    'template_id','vendor_brand','template_name','doc_subtype','key_markers_text','invoice_no_pattern','date_pattern','tax_id_pattern','total_pattern_hint','line_item_pattern_hint','common_ocr_errors','dedupe_key_strategy','active_rule','sample_count','accuracy_note','last_updated'
  ],
  OCR_RULE_CHANGELOG: [
    'change_id','changed_at','owner','scope','problem_summary','change_detail','risk_impact','test_cases_covered','version_before','version_after','rollback_plan','result_after_deploy'
  ],
  OCR_BENCHMARK_FUEL: [
    'run_id','run_at','rule_version','vendor_brand','cases_total','exact_match_count','critical_fields_accuracy_pct','invoice_no_accuracy_pct','date_accuracy_pct','total_accuracy_pct','line_item_accuracy_pct','dedupe_pass_rate_pct','notes'
  ]
};

function readCred() {
  const raw = JSON.parse(fs.readFileSync(CRED_PATH, 'utf8'));
  const c = Array.isArray(raw) ? raw[0] : raw;
  return c.data;
}

function req(method, url, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { method, hostname: u.hostname, path: u.pathname + u.search, headers };
    const r = https.request(opts, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ status: res.statusCode, data: parsed });
        const e = new Error(`HTTP ${res.statusCode}`);
        e.status = res.statusCode;
        e.body = parsed;
        reject(e);
      });
    });
    r.on('error', reject);
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

async function refreshAccessToken(d) {
  const form = new URLSearchParams({
    client_id: d.clientId,
    client_secret: d.clientSecret,
    refresh_token: d.oauthTokenData.refresh_token,
    grant_type: 'refresh_token',
  }).toString();
  const { data } = await req('POST', 'https://oauth2.googleapis.com/token', {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(form),
  }, form);
  return data.access_token;
}

async function getSpreadsheet(accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`;
  const { data } = await req('GET', url, { Authorization: `Bearer ${accessToken}` });
  return data;
}

async function batchUpdate(accessToken, requests) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
  return req('POST', url, {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }, { requests });
}

function columnLabel(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function updateHeaders(accessToken, sheetName, headers) {
  const range = encodeURIComponent(`${sheetName}!A1:${columnLabel(headers.length)}1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW`;
  return req('PUT', url, {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }, { majorDimension: 'ROWS', values: [headers] });
}

(async () => {
  const cred = readCred();
  const token = await refreshAccessToken(cred);
  const ss = await getSpreadsheet(token);
  const existing = new Set((ss.sheets || []).map(s => s.properties?.title).filter(Boolean));

  const toCreate = Object.keys(SHEETS).filter(name => !existing.has(name));
  if (toCreate.length) {
    await batchUpdate(token, toCreate.map(title => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            rowCount: 1000,
            columnCount: Math.max(26, SHEETS[title].length + 5),
            frozenRowCount: 1
          }
        }
      }
    })));
  }

  const results = [];
  for (const [name, headers] of Object.entries(SHEETS)) {
    await updateHeaders(token, name, headers);
    results.push({
      sheet: name,
      status: toCreate.includes(name) ? 'created_header_written' : 'header_written',
      columns: headers.length
    });
  }

  console.log(JSON.stringify({ ok: true, spreadsheetId: SHEET_ID, results }, null, 2));
})();
EOF
```

### 4) รันสคริปต์สร้าง sheet

```bash
node /tmp/ocr-sheet-setup/create_training_sheets.js
```

ผลลัพธ์ที่คาดหวัง:
- สร้างแท็บที่ยังไม่มี
- เขียน header row ให้ทุกแท็บ
- ถ้ามีแท็บอยู่แล้วจะไม่สร้างซ้ำ แต่จะเขียน header ให้ใหม่

หมายเหตุ:
- เวอร์ชันสคริปต์ปัจจุบันรวมทั้ง training sheets + KM sheets แล้ว
- ใช้รันซ้ำได้อย่างปลอดภัยเพื่อ refresh header row

## หมายเหตุการใช้งานครั้งถัดไป

- ถ้าจะเพิ่มแท็บใหม่: แก้ object `SHEETS` ในสคริปต์ แล้วรันซ้ำ
- ถ้าจะเปลี่ยน header: แก้ array header ของแท็บนั้น แล้วรันซ้ำ (จะ overwrite เฉพาะแถว 1)

## หลังใช้งานเสร็จ (แนะนำ)

ลบไฟล์ decrypted credential:

```bash
rm -f /tmp/ocr-sheet-setup/runtime-gs2-decrypted.json
```
