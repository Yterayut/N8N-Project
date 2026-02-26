#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-.}"

echo "Scanning for potential secrets in: $TARGET"
rg -n --hidden -S \
  -g '!node_modules/**' \
  -g '!.git/**' \
  -g '!*.sqlite*' \
  -g '!*.tar.gz' \
  -e 'AIza[0-9A-Za-z\-_]{20,}' \
  -e 'ghp_[A-Za-z0-9]{20,}' \
  -e 'x-goog-api-key' \
  -e 'x-api-key' \
  -e 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY' \
  -e 'password\s*[:=]' \
  "$TARGET" || true
