#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs/health"
LOCK_FILE="$LOG_DIR/.daily.lock"

mkdir -p "$LOG_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

DATE_TAG="$(date +%F)"
DAILY_LOG="$LOG_DIR/health-$DATE_TAG.log"
TMP_LOG="$LOG_DIR/.health-$DATE_TAG.tmp"

{
  echo "=== ngrok daily healthcheck (with auto-heal) ==="
  echo "timestamp: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "project: $PROJECT_ROOT"
  echo
  "$PROJECT_ROOT/scripts/ngrok_healthcheck.sh" --heal
  rc=$?
  echo
  echo "result_exit_code: $rc"
} > "$TMP_LOG" 2>&1 || true

# Overwrite daily file (one file per day, no growth in-file).
mv -f "$TMP_LOG" "$DAILY_LOG"

# Keep only 7 newest daily logs.
mapfile -t files < <(ls -1t "$LOG_DIR"/health-*.log 2>/dev/null || true)
if (( ${#files[@]} > 7 )); then
  for old in "${files[@]:7}"; do
    rm -f -- "$old"
  done
fi
