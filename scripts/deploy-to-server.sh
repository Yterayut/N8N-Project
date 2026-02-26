#!/usr/bin/env bash
# Deploy local n8n workspace to remote Ubuntu server.
# Usage: ./scripts/deploy-to-server.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-oneclimate-uat@10.100.1.11}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE}"
REMOTE_N8N_DIR="${REMOTE_N8N_DIR:-/home/oneclimate-uat/.n8n}"
SSH_PASS="${SSH_PASS:-y5?@7Aa#03}"

RSYNC_FLAGS=(-avzh --delete \
  --exclude ".git/" \
  --exclude ".env" \
  --exclude ".env.facebook_tokens" \
  --exclude "backups/" \
  --exclude "logs/" \
  --exclude ".cache/" \
  --exclude ".n8n/" \
  --exclude "*.log" \
)

confirm() {
  read -r -p "$1 [y/N] " response
  case "$response" in
    [yY][eE][sS]|[yY]) return 0 ;;
    *) return 1 ;;
  esac
}

if ! command -v sshpass >/dev/null 2>&1; then
  echo "❌ sshpass is required. Install with 'brew install hudochenkov/sshpass/sshpass' on macOS."
  exit 1
fi

echo "🚫 Stopping remote n8n/ngrok (if running)..."
sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" '
  pkill -f ngrok >/dev/null 2>&1 || true
  pkill -f n8n >/dev/null 2>&1 || true
' || true

echo "📤 Syncing project files to $REMOTE_HOST:$REMOTE_PROJECT_DIR ..."
sshpass -p "$SSH_PASS" rsync "${RSYNC_FLAGS[@]}" \
  "$PROJECT_ROOT/" \
  "$REMOTE_HOST:$REMOTE_PROJECT_DIR/"

if confirm "Sync local ~/.n8n (executions, credentials, workflows)?"; then
  echo "📤 Syncing ~/.n8n to $REMOTE_HOST:$REMOTE_N8N_DIR ..."
  sshpass -p "$SSH_PASS" rsync -avzh --delete \
    "$HOME/.n8n/" \
    "$REMOTE_HOST:$REMOTE_N8N_DIR/"
else
  echo "ℹ️  Skipping ~/.n8n sync."
fi

echo "🚀 Starting n8n on remote server..."
sshpass -p "$SSH_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" "
  cd '$REMOTE_PROJECT_DIR' && \
  export NVM_DIR=\"\$HOME/.nvm\" && \
  [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\" && \
  setsid ./start-n8n.sh > logs/server-start-\$(date +%Y%m%d-%H%M%S).log 2>&1 < /dev/null &
"

echo "✅ Deployment complete. Check remote logs directory for latest start log."
