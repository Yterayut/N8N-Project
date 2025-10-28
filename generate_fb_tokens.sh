#!/usr/bin/env bash
set -euo pipefail

# ====== ตั้งค่าเบื้องต้น (แก้ได้) ======
GRAPH_VERSION="${GRAPH_VERSION:-v24.0}"

# ต้องส่งเข้ามาอย่างน้อย 3 ตัวนี้ (ผ่าน env var หรือถามใน prompt)
APP_ID="${APP_ID:-}"
APP_SECRET="${APP_SECRET:-}"
USER_TOKEN="${USER_TOKEN:-}"

# ถ้ารู้ Page ID ชัดเจน ให้ตั้งไว้ที่นี่ (เช่น 889083480945134)
PAGE_ID="${PAGE_ID:-}"

# ====== ตัวช่วยแปลง JSON -> ค่า (ใช้ jq ถ้ามี ถ้าไม่มีก็ลองใช้ python) ======
json_get() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r "$key"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY' "$key"
import json,sys
key=sys.argv[1]
data=json.load(sys.stdin)
# รองรับ key รูปแบบ jq เล็กน้อย เช่น .access_token
def get(d, path):
    path = path.lstrip('.')
    for part in path.split('.'):
        if part == '':
            continue
        if isinstance(d, list):
            try:
                idx=int(part)
                d=d[idx]
            except:
                print('')
                sys.exit(0)
        else:
            d=d.get(part,'')
    return d if isinstance(d,str) else json.dumps(d, ensure_ascii=False)
print(get(data, key))
PY
  else
    echo "ต้องติดตั้ง 'jq' หรือ 'python3' เพื่ออ่าน JSON" >&2
    exit 1
  fi
}

compute_appsecret_proof() {
  local token="$1"
  if [[ -z "$token" ]]; then
    echo ""
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$APP_SECRET" "$token" <<'PY'
import hashlib, hmac, sys
secret = sys.argv[1]
token = sys.argv[2]
print(hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest())
PY
  elif command -v python >/dev/null 2>&1; then
    python - "$APP_SECRET" "$token" <<'PY'
import hashlib, hmac, sys
secret = sys.argv[1]
token = sys.argv[2]
print(hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest())
PY
  elif command -v openssl >/dev/null 2>&1; then
    printf '%s' "$token" | openssl dgst -sha256 -hmac "$APP_SECRET" | awk '{print $2}'
  else
    echo ""
  fi
}

# ====== รับค่า ถ้าไม่ได้ส่งมาเป็น env ======
if [[ -z "$APP_ID" ]]; then
  read -rp "APP_ID: " APP_ID
fi
if [[ -z "$APP_SECRET" ]]; then
  read -rsp "APP_SECRET: " APP_SECRET; echo
fi
if [[ -z "$USER_TOKEN" ]]; then
  read -rp "SHORT/USER TOKEN (จาก Graph API Explorer): " USER_TOKEN
fi

echo "🔄 แลก Long-lived USER token..."
USER_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token" \
  --get \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=${APP_ID}" \
  --data-urlencode "client_secret=${APP_SECRET}" \
  --data-urlencode "fb_exchange_token=${USER_TOKEN}")"

echo "$USER_JSON" | grep -q '"access_token"' || { echo "❌ แลก USER token ไม่สำเร็จ: $USER_JSON" >&2; exit 1; }

LONG_USER_TOKEN="$(echo "$USER_JSON" | json_get '.access_token')"
EXPIRES_IN="$(echo "$USER_JSON" | json_get '.expires_in')"

if [[ -z "$EXPIRES_IN" || "$EXPIRES_IN" == "null" ]]; then
  echo "✅ ได้ Long-lived USER token"
else
  echo "✅ ได้ Long-lived USER token (expires_in ~ ${EXPIRES_IN}s)"
fi

APP_SECRET_PROOF="$(compute_appsecret_proof "$LONG_USER_TOKEN")"
if [[ -z "$APP_SECRET_PROOF" ]]; then
  echo "⚠️  ไม่สามารถคำนวณ appsecret_proof ได้ (ต้องมี python หรือ openssl)"
fi

echo "📄 ดึงรายการเพจของคุณ..."
ACCOUNTS_FIELDS="id,name,access_token,can_post,tasks"
if [[ -n "$APP_SECRET_PROOF" ]]; then
  ME_ACCOUNTS_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/me/accounts" \
    --get \
    --data-urlencode "fields=${ACCOUNTS_FIELDS}" \
    --data-urlencode "access_token=${LONG_USER_TOKEN}" \
    --data-urlencode "appsecret_proof=${APP_SECRET_PROOF}")"
else
  ME_ACCOUNTS_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/me/accounts" \
    --get \
    --data-urlencode "fields=${ACCOUNTS_FIELDS}" \
    --data-urlencode "access_token=${LONG_USER_TOKEN}")"
fi

PAGE_OBJ=""
PAGE_CAN_POST=""
PAGE_TASKS=""
FROM_ACCOUNTS=1

if ! echo "$ME_ACCOUNTS_JSON" | grep -q '"error"'; then
  if [[ -n "$PAGE_ID" ]]; then
    if command -v jq >/dev/null 2>&1; then
      PAGE_OBJ="$(echo "$ME_ACCOUNTS_JSON" | jq -c ".data[] | select(.id==\"${PAGE_ID}\")")"
    fi
  else
    if command -v jq >/dev/null 2>&1; then
      PAGE_OBJ="$(echo "$ME_ACCOUNTS_JSON" | jq -c '.data[0]')"
    fi
  fi
fi

if [[ -z "$PAGE_OBJ" || "$PAGE_OBJ" == "null" ]]; then
  FROM_ACCOUNTS=0
  echo "ℹ️ ไม่พบเพจจาก /me/accounts หรือ token เป็น Page token โดยตรง — ลอง fallback /me ..."
  if [[ -n "$APP_SECRET_PROOF" ]]; then
    PAGE_SELF_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/me" \
      --get \
      --data-urlencode "fields=id,name,access_token,can_post,tasks" \
      --data-urlencode "access_token=${LONG_USER_TOKEN}" \
      --data-urlencode "appsecret_proof=${APP_SECRET_PROOF}")"
  else
    PAGE_SELF_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/me" \
      --get \
      --data-urlencode "fields=id,name,access_token,can_post,tasks" \
      --data-urlencode "access_token=${LONG_USER_TOKEN}")"
  fi

  if echo "$PAGE_SELF_JSON" | grep -q '"error"'; then
    echo "❌ ไม่สามารถอ่านข้อมูลเพจจาก token ที่ให้มา:"
    echo "$PAGE_SELF_JSON"
    exit 1
  fi

  PAGE_ID_FOUND="$(echo "$PAGE_SELF_JSON" | json_get '.id')"
  PAGE_NAME="$(echo "$PAGE_SELF_JSON" | json_get '.name')"
  PAGE_TOKEN="$(echo "$PAGE_SELF_JSON" | json_get '.access_token')"
  PAGE_CAN_POST="$(echo "$PAGE_SELF_JSON" | json_get '.can_post')"
  PAGE_TASKS="$(echo "$PAGE_SELF_JSON" | json_get '.tasks')"
else
  PAGE_ID_FOUND="$(echo "$PAGE_OBJ" | json_get '.id')"
  PAGE_NAME="$(echo "$PAGE_OBJ" | json_get '.name')"
  PAGE_TOKEN="$(echo "$PAGE_OBJ" | json_get '.access_token')"
  PAGE_CAN_POST="$(echo "$PAGE_OBJ" | json_get '.can_post')"
  PAGE_TASKS="$(echo "$PAGE_OBJ" | json_get '.tasks')"
fi

[[ -z "$PAGE_ID" ]] && PAGE_ID="$PAGE_ID_FOUND"

if [[ -z "$PAGE_ID" || "$PAGE_ID" == "null" ]]; then
  echo "❌ ยังไม่สามารถระบุ Page ID ได้จาก token ที่ให้มา"
  exit 1
fi

if [[ $FROM_ACCOUNTS -eq 1 ]]; then
  if [[ -n "$APP_SECRET_PROOF" ]]; then
    PAGE_TOKEN_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}" \
      --get \
      --data-urlencode "fields=access_token,can_post" \
      --data-urlencode "access_token=${LONG_USER_TOKEN}" \
      --data-urlencode "appsecret_proof=${APP_SECRET_PROOF}")"
  else
    PAGE_TOKEN_JSON="$(curl -sS "https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}" \
      --get \
      --data-urlencode "fields=access_token,can_post" \
      --data-urlencode "access_token=${LONG_USER_TOKEN}")"
  fi

  NEW_PAGE_TOKEN="$(echo "$PAGE_TOKEN_JSON" | json_get '.access_token')"
  NEW_CAN_POST="$(echo "$PAGE_TOKEN_JSON" | json_get '.can_post')"
  if [[ -n "$NEW_PAGE_TOKEN" && "$NEW_PAGE_TOKEN" != "null" ]]; then
    PAGE_TOKEN="$NEW_PAGE_TOKEN"
  fi
  if [[ -n "$NEW_CAN_POST" && "$NEW_CAN_POST" != "null" ]]; then
    PAGE_CAN_POST="$NEW_CAN_POST"
  fi
fi

if [[ -z "$PAGE_TOKEN" || "$PAGE_TOKEN" == "null" ]]; then
  echo "❌ ไม่สามารถดึง PAGE access token ได้"
  exit 1
fi

echo "✅ เลือกเพจ: ${PAGE_NAME} (${PAGE_ID})"
echo "✅ ได้ Long-lived PAGE token แล้ว"

# ====== เขียนไฟล์ .env ======
ENV_FILE=".env"

echo "✍️  เขียนค่าไปยัง ${ENV_FILE}"
TMP_FILE="$(mktemp)"
if [[ -f "$ENV_FILE" ]]; then
  cp "$ENV_FILE" "$TMP_FILE"
else
  : > "$TMP_FILE"
fi

update_entry() {
  local key="$1" value="$2"
  local temp="$(mktemp)"
  grep -v "^${key}=" "$TMP_FILE" > "$temp" || true
  printf '%s=%s\n' "$key" "$value" >> "$temp"
  mv "$temp" "$TMP_FILE"
}

update_entry GRAPH_API_VERSION "$GRAPH_VERSION"
update_entry FB_APP_ID "$APP_ID"
update_entry FB_APP_SECRET "$APP_SECRET"
update_entry FB_PAGE_ID "$PAGE_ID"
update_entry FB_PAGE_ACCESS_TOKEN "$PAGE_TOKEN"
update_entry FB_LONG_USER_ACCESS_TOKEN "$LONG_USER_TOKEN"
if [[ -n "$EXPIRES_IN" && "$EXPIRES_IN" != "null" ]]; then
  update_entry FB_LONG_USER_TOKEN_EXPIRES_IN "$EXPIRES_IN"
fi

mv "$TMP_FILE" "$ENV_FILE"

echo "📦 สำเร็จ! บันทึกค่าลง ${ENV_FILE}"
echo
echo "สรุป:"
echo "  Graph API: ${GRAPH_VERSION}"
echo "  App ID   : ${APP_ID}"
echo "  Page     : ${PAGE_NAME} (${PAGE_ID})"
if [[ -n "$PAGE_CAN_POST" && "$PAGE_CAN_POST" != "null" ]]; then
  echo "  Can Post : ${PAGE_CAN_POST}"
fi
if [[ -n "$PAGE_TASKS" && "$PAGE_TASKS" != "null" ]]; then
  echo "  Tasks    : ${PAGE_TASKS}"
fi
echo "  Long User Token: ${#LONG_USER_TOKEN} chars"
echo "  .env     : $(pwd)/${ENV_FILE}"
echo
echo "🧪 ทดสอบดึงข้อมูลเพจ:"
echo "curl \"https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}?fields=id,name,fan_count&access_token=${PAGE_TOKEN}\""
