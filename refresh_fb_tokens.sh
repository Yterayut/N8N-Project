#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
GENERATE_SCRIPT="${SCRIPT_DIR}/generate_fb_tokens.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ ไม่พบไฟล์ .env ที่ ${ENV_FILE} - รัน generate_fb_tokens.sh ด้วยตนเองก่อน" >&2
  exit 1
fi

if [[ ! -x "$GENERATE_SCRIPT" ]]; then
  echo "❌ ไม่พบสคริปต์ generate_fb_tokens.sh ที่รันได้" >&2
  exit 1
fi

# โหลดค่าจาก .env
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${FB_APP_ID:?ต้องระบุ FB_APP_ID ใน .env}"
: "${FB_APP_SECRET:?ต้องระบุ FB_APP_SECRET ใน .env}"
: "${FB_LONG_USER_ACCESS_TOKEN:?ต้องระบุ FB_LONG_USER_ACCESS_TOKEN ใน .env}"

GRAPH_VERSION="${GRAPH_API_VERSION:-v24.0}"

export APP_ID="$FB_APP_ID"
export APP_SECRET="$FB_APP_SECRET"
export USER_TOKEN="$FB_LONG_USER_ACCESS_TOKEN"
export GRAPH_VERSION

echo "🔁 ต่ออายุ Facebook tokens โดยอัตโนมัติ"
"$GENERATE_SCRIPT"

echo "✅ ต่ออายุ token สำเร็จ ณ $(date '+%Y-%m-%d %H:%M:%S')"
