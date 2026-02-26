#!/bin/bash
# GG Ground Truth Batch Runner
# Usage: ./scripts/gg/gg-groundtruth-batch.sh [dir]
# Default dir: file/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

FILE_DIR="${1:-$PROJECT_DIR/file}"
DONE=0
FAIL=0
TOTAL=$(ls "$FILE_DIR"/*.pdf 2>/dev/null | wc -l)

log "=== GG Batch Ground Truth: $TOTAL files in $FILE_DIR ==="

for f in "$FILE_DIR"/*.pdf; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$(date '+%H:%M:%S')] Processing ($((DONE+FAIL+1))/$TOTAL): $(basename "$f")"
  if "$SCRIPT_DIR/gg-groundtruth.sh" "$f"; then
    DONE=$((DONE+1))
  else
    FAIL=$((FAIL+1))
    echo "❌ Failed — continuing"
  fi
  sleep 3  # Gemini rate limit
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏁 Batch complete: $DONE success / $FAIL failed"
echo "Results: docs/gg/proposals/"

# Notify CC เมื่อ batch เสร็จทั้งหมด (ครั้งเดียว)
notify "E" "✅ Ground truth batch เสร็จ: $DONE/$TOTAL files — CC ต้อง spot-check ก่อนใช้ใน T029D — CC review อัตโนมัติ ยุทไม่ต้องทำอะไร" "$PROJECT_DIR/docs/gg/proposals/"
log "=== GG Batch complete: $DONE/$TOTAL ==="
