#!/bin/bash
# System Loop - Universal Orchestration Agent
# Wrapper script for cron execution
#
# Manages:
# - Team members (CEO, CTO, CPO)
# - Scheduled workflows
# - Standup and weekly summaries
#
# Run hourly: 0 * * * * /root/.claude/scripts/system-loop.sh

set -uo pipefail

cd /root/.claude

# Load environment
[ -f "secrets/.env" ] && export $(grep -v '^#' secrets/.env | xargs 2>/dev/null) || true

LOG_DIR="/root/.claude/logs/system-loop"
mkdir -p "$LOG_DIR"

LOG_FILE="${LOG_DIR}/$(date +%Y-%m-%d).log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== System Loop Shell Wrapper Started ==="

# Check if npx/tsx available
if ! command -v npx &> /dev/null; then
  log "ERROR: npx not found, trying node directly"

  # Fallback: try node with ts-node/esm
  if command -v node &> /dev/null; then
    cd /root/.claude/scripts
    node --loader ts-node/esm system-loop.ts >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
  else
    log "ERROR: Neither npx nor node found!"
    exit 1
  fi
else
  # Run with npx tsx
  npx tsx /root/.claude/scripts/system-loop.ts >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?
fi

if [ $EXIT_CODE -eq 0 ]; then
  log "=== System Loop Completed Successfully ==="
else
  log "=== System Loop Failed with exit code $EXIT_CODE ==="

  # Send failure notification
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=❌ System Loop failed with exit code ${EXIT_CODE}" \
      -d "parse_mode=HTML" > /dev/null 2>&1 || true
  fi
fi

exit $EXIT_CODE
