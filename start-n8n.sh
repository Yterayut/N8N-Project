#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting n8n with ngrok tunnel..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
ENV_FILE="$PROJECT_ROOT/.env"

# Ensure user-level binaries (e.g. ngrok) are visible
export PATH="$HOME/bin:$PATH"

# Load environment variables from the project .env if present
if [ -f "$ENV_FILE" ]; then
  set -a
  # Load only valid shell identifiers from .env so accidental keys like
  # `FOO-BAR=...` do not break startup.
  # shellcheck disable=SC1090
  source <(
    grep -E '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" || true
  )
  set +a
fi

# Ensure config override file (e.g. to mark owner setup) is loaded when present
CONFIG_OVERRIDE_FILE="$PROJECT_ROOT/config.override.json"
if [ -f "$CONFIG_OVERRIDE_FILE" ]; then
  export N8N_CONFIG_FILES="${N8N_CONFIG_FILES:+$N8N_CONFIG_FILES,}$CONFIG_OVERRIDE_FILE"
fi

# Load nvm (if available) so that `node`/`n8n` installed via nvm are on PATH
if [ -z "${NVM_DIR:-}" ] && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
fi

# Allow overriding via env; default to repository directory to keep configs together
export N8N_USER_FOLDER="${N8N_USER_FOLDER:-$PROJECT_ROOT/.n8n-dev}"

cleanup() {
  if [ -n "${NGROK_PID:-}" ] && kill -0 "$NGROK_PID" 2>/dev/null; then
    echo "🛑 Stopping ngrok..."
    kill "$NGROK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

NGROK_BIN="${NGROK_BIN:-$(command -v ngrok || true)}"
if [ -n "$NGROK_BIN" ]; then
  NGROK_PORT="${NGROK_PORT:-5678}"
  NGROK_DOMAIN="${NGROK_DOMAIN:-}"
  NGROK_REGION="${NGROK_REGION:-}"
  NGROK_INSPECT="${NGROK_INSPECT:-true}"
  NGROK_LOG_DIR="${NGROK_LOG_DIR:-$PROJECT_ROOT/logs}"
  mkdir -p "$NGROK_LOG_DIR"
  NGROK_LOG_FILE="$NGROK_LOG_DIR/ngrok-$(date +%Y%m%d-%H%M%S).log"
  NGROK_LATEST_LINK="$NGROK_LOG_DIR/ngrok-latest.log"
  ln -sf "$(basename "$NGROK_LOG_FILE")" "$NGROK_LATEST_LINK"

  NGROK_ARGS=(http)
  if [ -n "$NGROK_DOMAIN" ]; then
    NGROK_ARGS+=(--domain "$NGROK_DOMAIN")
  fi
  if [ -n "$NGROK_REGION" ]; then
    NGROK_ARGS+=(--region "$NGROK_REGION")
  fi
  if [ "$NGROK_INSPECT" = "false" ]; then
    NGROK_ARGS+=(--inspect=false)
  fi
  NGROK_ARGS+=("$NGROK_PORT")

  if [ -n "${NGROK_AUTHTOKEN:-}" ]; then
    export NGROK_AUTHTOKEN
  fi

  echo "📡 Starting ngrok tunnel on port $NGROK_PORT..."
  "$NGROK_BIN" "${NGROK_ARGS[@]}" >> "$NGROK_LOG_FILE" 2>&1 &
  NGROK_PID=$!
  sleep 3

  if kill -0 "$NGROK_PID" 2>/dev/null; then
    if command -v curl >/dev/null 2>&1; then
      NGROK_API_JSON=$(curl -sf http://localhost:4040/api/tunnels || true)
      NGROK_URL=$(printf '%s' "${NGROK_API_JSON:-}" | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "${NGROK_URL:-}" ]; then
        echo "✅ ngrok tunnel: $NGROK_URL"
      else
        echo "⚠️  Warning: Could not get ngrok URL"
      fi
    else
      echo "⚠️  curl not found; skipping ngrok URL lookup"
    fi
  else
    echo "⚠️  ngrok exited early (check authtoken and connectivity); continuing without tunnel"
    echo "ℹ️  See $NGROK_LOG_FILE for details."
    NGROK_PID=""
  fi
else
  echo "⚠️  ngrok not found on PATH; skipping tunnel setup"
fi

N8N_BIN="${N8N_BIN:-$(command -v n8n || true)}"
if [ -n "$N8N_BIN" ]; then
  echo "🟢 Starting n8n..."
  "$N8N_BIN" start
elif command -v npx >/dev/null 2>&1; then
  echo "ℹ️  n8n executable not found; falling back to npx"
  npx --yes n8n start
else
  echo "❌ n8n is not installed. Install with 'npm install -g n8n' or provide N8N_BIN."
  exit 1
fi
