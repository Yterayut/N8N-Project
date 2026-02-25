#!/bin/bash
# GG Common — shared config + helpers for all GG scripts

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROPOSALS_DIR="$PROJECT_DIR/docs/gg/proposals"
REPORTS_DIR="$PROJECT_DIR/docs/gg/reports"
LOGS_DIR="$PROJECT_DIR/logs"
ENV_FILE="$PROJECT_DIR/.env"

mkdir -p "$PROPOSALS_DIR" "$REPORTS_DIR" "$LOGS_DIR"

# ── Load .env ──────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ── Config ─────────────────────────────────────────────────────────────
N8N_BASE="${N8N_BASE_URL:-http://localhost:5678}"
TELEGRAM_CHAT_ID="${TELEGRAM_OCR_CHAT_ID:-}"
GG_DATA_WEBHOOK="$N8N_BASE/webhook/gg-data"
GG_NOTIFY_WEBHOOK="$N8N_BASE/webhook/gg-notify"
GEMINI_MODEL="${GG_MODEL:-gemini-2.5-pro}"
DATE_TAG="$(date +%Y-%m-%d)"
TIMESTAMP="$(date +%Y-%m-%dT%H:%M:%S)"

# ── Logging ─────────────────────────────────────────────────────────────
log() {
  echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOGS_DIR/gg-${GG_ROLE:-unknown}.log"
}

log_error() {
  echo "[ERROR][$(date +%H:%M:%S)] $*" | tee -a "$LOGS_DIR/gg-error.log" >&2
}

# ── Gemini CLI wrapper ───────────────────────────────────────────────────
# Usage: gg_run "prompt" [optional_stdin_data]
gg_run() {
  local prompt="$1"
  local stdin_data="${2:-}"
  if [ -n "$stdin_data" ]; then
    echo "$stdin_data" | gemini -p "$prompt" --output-format text 2>>"$LOGS_DIR/gg-error.log"
  else
    gemini -p "$prompt" --output-format text 2>>"$LOGS_DIR/gg-error.log"
  fi
}

# ── Fetch Sheets data via n8n webhook ────────────────────────────────────
# Usage: fetch_sheet "TRAIN_CASES"
fetch_sheet() {
  local sheet_name="$1"
  local result
  result=$(curl -sf "$GG_DATA_WEBHOOK?sheet=$sheet_name" \
    -H "x-api-key: ${OCR_SHARED_API_KEY:-}" 2>/dev/null) || {
    log_error "Cannot fetch sheet: $sheet_name — n8n gg-data webhook not ready yet"
    echo "[]"
    return 0
  }
  echo "$result"
}

# ── Telegram notification via n8n webhook ────────────────────────────────
notify() {
  local role="$1"
  local message="$2"
  local output_file="${3:-}"
  local payload
  payload=$(printf '{"role":"%s","message":"%s","output_file":"%s"}' \
    "$role" \
    "$(echo "$message" | sed 's/"/\\"/g')" \
    "$output_file")
  curl -sf -X POST "$GG_NOTIFY_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null 2>&1 || {
    # Fallback: log locally if webhook not ready
    log "📢 [$role] $message"
    return 0
  }
  log "Notification sent: $message"
}

# ── Save proposal ────────────────────────────────────────────────────────
save_proposal() {
  local filename="$1"
  local content="$2"
  local filepath="$PROPOSALS_DIR/$filename"
  echo "$content" > "$filepath"
  log "Proposal saved: $filepath"
  echo "$filepath"
}

# ── Save report ──────────────────────────────────────────────────────────
save_report() {
  local filename="$1"
  local content="$2"
  local filepath="$REPORTS_DIR/$filename"
  echo "$content" > "$filepath"
  log "Report saved: $filepath"
  echo "$filepath"
}
