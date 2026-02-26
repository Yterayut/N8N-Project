#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

HEAL_MODE="false"
if [[ "${1:-}" == "--heal" ]]; then
  HEAL_MODE="true"
fi

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $*"
}

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

N8N_LOCAL_URL="${N8N_LOCAL_URL:-http://127.0.0.1:5678}"
NGROK_DOMAIN="${NGROK_DOMAIN:-rapturously-streamlined-king.ngrok-free.dev}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://$NGROK_DOMAIN}"
NGROK_BIN="${NGROK_BIN:-$HOME/bin/ngrok}"
NGROK_PORT="${NGROK_PORT:-5678}"
NGROK_INSPECT="${NGROK_INSPECT:-false}"
NGROK_HEALTH_TIMEOUT="${NGROK_HEALTH_TIMEOUT:-15}"
MAX_RETRY="${MAX_RETRY:-3}"

if [[ ! -x "$NGROK_BIN" ]]; then
  NGROK_BIN="$(command -v ngrok || true)"
fi

if [[ -z "$NGROK_BIN" ]]; then
  log "ERROR: ngrok binary not found"
  exit 2
fi

if [[ -f "$HOME/.ngrok2/ngrok.yml" ]] && rg -q "connect_url:" "$HOME/.ngrok2/ngrok.yml"; then
  log "WARN: ~/.ngrok2/ngrok.yml has connect_url override; this can reduce stability."
fi

http_code() {
  local url="$1"
  curl -m "$NGROK_HEALTH_TIMEOUT" -s -o /dev/null -w '%{http_code}' "$url" || true
}

check_with_retry() {
  local url="$1"
  local want="${2:-200}"
  local i code
  for i in $(seq 1 "$MAX_RETRY"); do
    code="$(http_code "$url")"
    if [[ "$code" == "$want" ]]; then
      echo "$code"
      return 0
    fi
    sleep 1
  done
  echo "${code:-000}"
  return 1
}

restart_ngrok() {
  log "HEAL: restarting ngrok tunnel..."
  pkill -f '^.*/ngrok http' || true
  sleep 1

  local log_file="$LOG_DIR/ngrok-heal-$(date +%Y%m%d-%H%M%S).log"
  local args=(http "--domain=$NGROK_DOMAIN")
  if [[ "$NGROK_INSPECT" == "false" ]]; then
    args+=("--inspect=false")
  fi
  args+=("$NGROK_PORT")

  nohup "$NGROK_BIN" "${args[@]}" > "$log_file" 2>&1 &
  sleep 3
  log "HEAL: ngrok restarted (log: $log_file)"
}

log "CHECK: n8n local endpoint"
local_code="$(check_with_retry "$N8N_LOCAL_URL/" "200" || true)"
if [[ "$local_code" != "200" ]]; then
  log "ERROR: local n8n is unhealthy ($N8N_LOCAL_URL => $local_code)"
  exit 3
fi
log "OK: local n8n $local_code"

log "CHECK: ngrok tunnel api"
api_json="$(curl -m "$NGROK_HEALTH_TIMEOUT" -sS http://127.0.0.1:4040/api/tunnels || true)"
public_url="$(printf '%s' "$api_json" | rg -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [[ -z "$public_url" ]]; then
  log "WARN: ngrok API has no public_url"
  if [[ "$HEAL_MODE" == "true" ]]; then
    restart_ngrok
    api_json="$(curl -m "$NGROK_HEALTH_TIMEOUT" -sS http://127.0.0.1:4040/api/tunnels || true)"
    public_url="$(printf '%s' "$api_json" | rg -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  fi
fi

if [[ "$public_url" != "$PUBLIC_BASE_URL" ]]; then
  log "WARN: tunnel URL mismatch (expected: $PUBLIC_BASE_URL, actual: ${public_url:-none})"
fi

log "CHECK: public signin"
signin_code="$(check_with_retry "$PUBLIC_BASE_URL/signin" "200" || true)"
if [[ "$signin_code" != "200" ]]; then
  log "WARN: public signin unhealthy ($signin_code)"
  if [[ "$HEAL_MODE" == "true" ]]; then
    restart_ngrok
    signin_code="$(check_with_retry "$PUBLIC_BASE_URL/signin" "200" || true)"
  fi
fi

if [[ "$signin_code" != "200" ]]; then
  log "ERROR: public signin failed after retry/heal ($signin_code)"
  exit 4
fi
log "OK: public signin $signin_code"

log "CHECK: core assets from /signin HTML"
signin_html="$(curl -m "$NGROK_HEALTH_TIMEOUT" -sS "$PUBLIC_BASE_URL/signin" || true)"
main_js_path="$(printf '%s' "$signin_html" | rg -o '/assets/index-[^"]+\.js' | head -1 || true)"
core_css_paths="$(printf '%s' "$signin_html" | rg -o '/assets/[^"]+\.css' | head -5 || true)"

if [[ -z "$main_js_path" ]]; then
  log "ERROR: cannot discover main JS asset from signin page"
  exit 5
fi

asset_fail=0
js_code="$(check_with_retry "$PUBLIC_BASE_URL$main_js_path" "200" || true)"
if [[ "$js_code" != "200" ]]; then
  log "WARN: main JS failed ($main_js_path => $js_code)"
  asset_fail=1
fi

while IFS= read -r css_path; do
  [[ -z "$css_path" ]] && continue
  css_code="$(check_with_retry "$PUBLIC_BASE_URL$css_path" "200" || true)"
  if [[ "$css_code" != "200" ]]; then
    log "WARN: css failed ($css_path => $css_code)"
    asset_fail=1
  fi
done <<< "$core_css_paths"

if [[ "$asset_fail" -eq 1 && "$HEAL_MODE" == "true" ]]; then
  restart_ngrok
  asset_fail=0

  js_code="$(check_with_retry "$PUBLIC_BASE_URL$main_js_path" "200" || true)"
  [[ "$js_code" == "200" ]] || asset_fail=1

  while IFS= read -r css_path; do
    [[ -z "$css_path" ]] && continue
    css_code="$(check_with_retry "$PUBLIC_BASE_URL$css_path" "200" || true)"
    [[ "$css_code" == "200" ]] || asset_fail=1
  done <<< "$core_css_paths"
fi

if [[ "$asset_fail" -eq 1 ]]; then
  log "ERROR: asset check failed"
  exit 6
fi

log "OK: all health checks passed"
exit 0
