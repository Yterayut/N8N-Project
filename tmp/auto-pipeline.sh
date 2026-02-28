#!/bin/bash
# Auto Pipeline: T038 → T036-respond → T037
# รันใน background — จัดการ task chain อัตโนมัติหลัง CC review

set -e
cd /home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE

EXEC_SCRIPT="./scripts/collab/codex-exec.sh"
LOG="/tmp/auto-pipeline.log"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

wait_codex_commit() {
  local keyword="$1"
  local timeout="${2:-3600}"  # 1 hour default
  local elapsed=0
  log "Waiting for Codex commit matching: $keyword"
  while true; do
    local latest
    latest=$(git -C agents/codex log --oneline -1 2>/dev/null || echo "")
    if echo "$latest" | grep -qi "$keyword"; then
      log "Found: $latest"
      return 0
    fi
    sleep 20
    elapsed=$((elapsed + 20))
    if [ $elapsed -ge $timeout ]; then
      log "TIMEOUT waiting for: $keyword"
      return 1
    fi
  done
}

notify() {
  local msg="$1"
  source .env 2>/dev/null || true
  curl -s -X POST "http://localhost:5678/webhook/gg-notify" \
    -H "x-api-key: $OCR_SHARED_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"🤖 Auto Pipeline\\n$msg\"}" > /dev/null 2>&1 || true
}

# ── STEP 1: รอ T038 เสร็จ ──────────────────────────────────────
log "=== AUTO PIPELINE START ==="
log "Step 1: Waiting for T038..."

wait_codex_commit "T038"
log "T038 done! Merging..."

git fetch origin agents/codex 2>/dev/null || true
git merge agents/codex --no-edit 2>/dev/null || git merge agents/codex --strategy-option=theirs --no-edit
./scripts/collab/sync.sh all

notify "T038 merged ✅ — CC กรุณา review แล้ว confirm ใน terminal\nรอ CC review แล้วจะ assign T036-respond อัตโนมัติ"
log "T038 merged. Waiting 5 min for CC to review before assigning T036-respond..."
sleep 300  # รอ CC review 5 นาที

# ── STEP 2: T036 respond ───────────────────────────────────────
log "Step 2: Assigning T036-respond to Codex..."
tmux send-keys -t codex "$EXEC_SCRIPT respond T036" Enter
sleep 5

notify "T036-respond assigned to Codex 🔄"

wait_codex_commit "T036.*respond\|respond.*T036\|T036"
log "T036-respond done! Merging..."

git merge agents/codex --no-edit 2>/dev/null || git merge agents/codex --strategy-option=theirs --no-edit
./scripts/collab/sync.sh all
notify "T036-respond merged ✅"
log "T036-respond merged."

sleep 30

# ── STEP 3: T037 ───────────────────────────────────────────────
log "Step 3: Assigning T037 to Codex..."
tmux send-keys -t codex "$EXEC_SCRIPT implement T037" Enter
sleep 5

notify "T037 assigned to Codex 🔄 — Validation Trace"

wait_codex_commit "T037"
log "T037 done! Merging..."

git merge agents/codex --no-edit 2>/dev/null || git merge agents/codex --strategy-option=theirs --no-edit
./scripts/collab/sync.sh all
notify "T037 merged ✅ — Pipeline complete! 🎉"
log "=== AUTO PIPELINE COMPLETE ==="
