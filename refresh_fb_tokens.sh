#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌ ไม่พบไฟล์ .env ที่ ${ENV_FILE}" >&2
  exit 1
fi

python3 - "$ENV_FILE" <<'PY'
import json
import hmac
import hashlib
import os
import re
import ssl
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple
from urllib import parse, request, error

ENV_PATH = Path(sys.argv[1]).resolve()

def load_env(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value.strip().strip('"').strip("'")
    return env

env = load_env(ENV_PATH)

required_keys = ["FB_APP_ID", "FB_APP_SECRET", "FB_LONG_USER_ACCESS_TOKEN"]
missing = [key for key in required_keys if not env.get(key)]
if missing:
    print(f"❌ กำหนดค่าต่อไปนี้ใน .env ก่อน: {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)

app_id = env["FB_APP_ID"]
app_secret = env["FB_APP_SECRET"]
long_user_token = env["FB_LONG_USER_ACCESS_TOKEN"]
graph_version = env.get("GRAPH_API_VERSION", "v24.0")
base_page_id = env.get("FB_PAGE_ID", "").strip()

ssl_context = ssl._create_unverified_context()

def http_get(url: str) -> Dict:
    req = request.Request(url)
    try:
        with request.urlopen(req, context=ssl_context, timeout=15) as resp:
            data = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {payload}") from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise RuntimeError(str(exc)) from exc
    try:
        return json.loads(data)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"ไม่สามารถอ่าน JSON: {data}") from exc

page_ids: List[str] = []
for key in env:
    if key.startswith("FB_PAGE_ACCESS_TOKEN_"):
        page_ids.append(key.split("_")[-1])

if not page_ids:
    print("⚠️ ไม่พบตัวแปร FB_PAGE_ACCESS_TOKEN_* ใน .env", file=sys.stderr)
    sys.exit(1)

page_ids = sorted(set(page_ids))

appsecret_proof = hmac.new(
    app_secret.encode("utf-8"),
    long_user_token.encode("utf-8"),
    hashlib.sha256,
).hexdigest()

def fetch_page_token(page_id: str) -> Tuple[str, str]:
    params = parse.urlencode(
        {
            "fields": "access_token,name",
            "access_token": long_user_token,
            "appsecret_proof": appsecret_proof,
        }
    )
    url = f"https://graph.facebook.com/{graph_version}/{page_id}?{params}"
    data = http_get(url)
    token = data.get("access_token")
    if not token:
        raise RuntimeError(f"ไม่พบ access_token ในผลลัพธ์สำหรับเพจ {page_id}: {data}")
    name = data.get("name") or page_id
    return token, name

def debug_token(token: str) -> Dict:
    params = parse.urlencode(
        {
            "access_token": f"{app_id}|{app_secret}",
            "input_token": token,
        }
    )
    url = f"https://graph.facebook.com/debug_token?{params}"
    data = http_get(url)
    if "data" not in data:
        raise RuntimeError(f"ผลลัพธ์ debug token ผิดรูปแบบ: {data}")
    return data["data"]

new_tokens: Dict[str, Dict[str, object]] = {}
line_items: List[str] = []

print("🔁 กำลังต่ออายุ Page token อัตโนมัติ...")
for page_id in page_ids:
    try:
        token, page_name = fetch_page_token(page_id)
        debug_info = debug_token(token)
        new_tokens[page_id] = {
            "token": token,
            "name": page_name,
            "debug": debug_info,
        }
        print(f"  ✅ {page_name} ({page_id})")
    except Exception as exc:  # pylint: disable=broad-except
        print(f"  ❌ {page_id}: {exc}", file=sys.stderr)
        new_tokens[page_id] = {"error": str(exc)}

if not new_tokens:
    print("❌ ไม่สามารถต่ออายุ token ได้", file=sys.stderr)
    sys.exit(1)

lines = ENV_PATH.read_text().splitlines()

def set_env_line(key: str, value: str) -> None:
    pattern = f"{key}="
    quoted = f'{key}="{value}"'
    for idx, line in enumerate(lines):
        if line.startswith(pattern):
            lines[idx] = quoted
            return
    lines.append(quoted)

for page_id, payload in new_tokens.items():
    token = payload.get("token")
    if not token:
        continue
    set_env_line(f"FB_PAGE_ACCESS_TOKEN_{page_id}", token)
    if base_page_id and page_id == base_page_id:
        set_env_line("FB_PAGE_ACCESS_TOKEN", token)

ENV_PATH.write_text("\n".join(lines) + "\n")

def format_expiry(debug_info: Dict) -> str:
    expires_at = debug_info.get("expires_at")
    data_access = debug_info.get("data_access_expires_at")
    pieces = []
    if expires_at:
        dt = datetime.fromtimestamp(expires_at, tz=timezone.utc)
        pieces.append(f"token: {dt.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    if data_access:
        dt2 = datetime.fromtimestamp(data_access, tz=timezone.utc)
        pieces.append(f"data_access: {dt2.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    if not pieces:
        return "ไม่ระบุ (expires_at = 0)"
    return ", ".join(pieces)

timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
summary_lines = [f"🔁 ต่ออายุ Facebook Page token สำเร็จ ({timestamp})"]
for page_id, payload in new_tokens.items():
    if "error" in payload:
        summary_lines.append(f"• {page_id}: ❌ {payload['error']}")
        continue
    name = payload.get("name", page_id)
    debug_info = payload.get("debug", {})
    expiry_text = format_expiry(debug_info)
    summary_lines.append(f"• {name} ({page_id}) → {expiry_text}")

summary_message = "\n".join(summary_lines)
print(summary_message)

line_token = env.get("LINE_CHANNEL_ACCESS_TOKEN", "").strip()
line_targets_raw = env.get("LINE_ALERT_USER_IDS", "")
line_targets = [token.strip() for token in re.split(r"[,\n]", line_targets_raw) if token.strip()]

def send_line_notification(message: str) -> None:
    if not line_token or not line_targets:
        return
    endpoint = "https://api.line.me/v2/bot/message/push"
    payload: Dict[str, object]
    if len(line_targets) == 1:
        payload = {
            "to": line_targets[0],
            "messages": [{"type": "text", "text": message}],
            "notificationDisabled": False,
        }
    else:
        endpoint = "https://api.line.me/v2/bot/message/multicast"
        payload = {
            "to": line_targets,
            "messages": [{"type": "text", "text": message}],
            "notificationDisabled": False,
        }
    req = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {line_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with request.urlopen(req, context=ssl_context, timeout=10):
            pass
        print("📨 ส่งแจ้งเตือน LINE แล้ว")
    except Exception as exc:  # pylint: disable=broad-except
        print(f"⚠️ ส่ง LINE ไม่สำเร็จ: {exc}", file=sys.stderr)

send_line_notification(summary_message)
print("✅ บันทึก token และส่งแจ้งเตือนเรียบร้อย")
PY
