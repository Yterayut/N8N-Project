#!/usr/bin/env bash
# scripts/restart-telegram-triggers.sh
# รัน background หลัง n8n start เพื่อ:
#   cycle Telegram Trigger workflows ให้ n8n load route + secret_token ใหม่
# แก้ปัญหา webhook ไม่ถูก register หลัง n8n restart
#
# IMPORTANT: ห้าม manual setWebhook โดยเด็ดขาด
# n8n generate secret_token อัตโนมัติตอน activate workflow
# ถ้า setWebhook เองโดยไม่มี secret → Telegram ส่งมาไม่มี header → n8n 403

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
LOG_FILE="$PROJECT_ROOT/logs/telegram-trigger-restart.log"
N8N_URL="http://localhost:5678"
MAX_WAIT=300   # รอ n8n สูงสุด 5 นาที
COOKIE_JAR="/tmp/n8n-tg-restart-cookie.txt"

# Telegram Trigger workflows ที่ต้อง cycle หลัง n8n restart
# format: "WORKFLOW_ID"  (ไม่ต้องใส่ webhook path — n8n จัดการ setWebhook+secret เอง)
TELEGRAM_TRIGGER_WFS=(
  "KW0QRXxRh9MjdPaY"  # ocr-training
  # "KFMLLs4w14W7taM3"  # BOT-Kiriyah — DISABLED: shares same bot, causes message conflict
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

mkdir -p "$(dirname "$LOG_FILE")"
log "=== Telegram Trigger Restart (n8n startup) ==="

# โหลด .env
if [ -f "$ENV_FILE" ]; then
  set -a
  source <(grep -E '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" || true)
  set +a
fi

# รอ n8n พร้อม
log "Waiting for n8n to be ready..."
elapsed=0
while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  if curl -sf "$N8N_URL/healthz" >/dev/null 2>&1; then
    log "n8n is ready (${elapsed}s)"
    break
  fi
  sleep 5
  elapsed=$((elapsed + 5))
done

if [ "$elapsed" -ge "$MAX_WAIT" ]; then
  log "ERROR: n8n did not start within ${MAX_WAIT}s — aborting"
  exit 1
fi

sleep 5  # extra buffer for full init

# Login
rm -f "$COOKIE_JAR"
LOGIN_RESP=$(curl -sf -c "$COOKIE_JAR" -X POST "$N8N_URL/rest/login" \
  -H "Content-Type: application/json" \
  -d "{\"emailOrLdapLoginId\":\"yterayut@gmail.com\",\"password\":\"${N8N_BASIC_AUTH_PASSWORD}\"}" 2>&1 || true)

if ! echo "$LOGIN_RESP" | grep -q '"data"'; then
  log "ERROR: Login failed — ${LOGIN_RESP:0:200}"
  exit 1
fi
log "Login OK"

# Cycle แต่ละ workflow — n8n จะเรียก setWebhook พร้อม secret_token อัตโนมัติ
for WF_ID in "${TELEGRAM_TRIGGER_WFS[@]}"; do
  WF_INFO=$(curl -sf -b "$COOKIE_JAR" "$N8N_URL/rest/workflows/$WF_ID" 2>/dev/null || true)
  WF_NAME=$(echo "$WF_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('name','?'))" 2>/dev/null || echo "?")
  IS_ACTIVE=$(echo "$WF_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('data',{}).get('active',False)).lower())" 2>/dev/null || echo "false")

  if [ "$IS_ACTIVE" != "true" ]; then
    log "SKIP: $WF_ID ($WF_NAME) — not active"
    continue
  fi

  # Cycle: deactivate → activate
  # n8n จะ deleteWebhook แล้ว setWebhook พร้อม secret_token ใหม่อัตโนมัติ
  curl -sf -b "$COOKIE_JAR" -X PATCH "$N8N_URL/rest/workflows/$WF_ID" \
    -H "Content-Type: application/json" -d '{"active":false}' >/dev/null 2>&1 || true
  log "Deactivated: $WF_ID ($WF_NAME)"
  sleep 3

  curl -sf -b "$COOKIE_JAR" -X PATCH "$N8N_URL/rest/workflows/$WF_ID" \
    -H "Content-Type: application/json" -d '{"active":true}' >/dev/null 2>&1 || true
  log "Reactivated:  $WF_ID ($WF_NAME)"
done

rm -f "$COOKIE_JAR"
log "=== Done ==="
