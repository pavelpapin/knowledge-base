#!/bin/bash
# Nightly Consilium Trigger Script
# Runs at 02:00 Tbilisi (22:00 UTC)
#
# This script triggers the nightly code review workflow via:
# 1. BullMQ worker (if running) - preferred
# 2. Direct Claude CLI (fallback)

set -e

cd /root/.claude

# Load environment
if [ -f "/root/.claude/secrets/.env" ]; then
  export $(grep -v '^#' /root/.claude/secrets/.env | xargs)
fi

RUN_ID="consilium_$(date +%Y%m%d_%H%M%S)"
LOG_FILE="/root/.claude/logs/nightly/${RUN_ID}.log"
REPORT_FILE="/root/.claude/logs/consilium/${RUN_ID}.json"

mkdir -p /root/.claude/logs/nightly /root/.claude/logs/consilium

echo "[$RUN_ID] Starting Nightly Consilium at $(date)" | tee -a "$LOG_FILE"

# Function to send Telegram notification
notify_telegram() {
  local message="$1"
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${message}" \
      -d "parse_mode=HTML" >> "$LOG_FILE" 2>&1 || true
  fi
}

notify_telegram "🌙 Starting Nightly Consilium... (${RUN_ID})"

# Consilium prompt
CONSILIUM_PROMPT="Run the Nightly Consilium code review workflow.

## Task
Analyze the Elio OS codebase and apply improvements.

## Scope
Focus on these directories:
- /root/.claude/packages/ (workflow, agent-runner, shared)
- /root/.claude/apps/worker/
- /root/.claude/mcp-server/src/

## Checklist
1. **Large Files** (>200 lines) - identify and note for splitting
2. **Type Safety** - find 'any' types
3. **Error Handling** - missing try/catch
4. **Console.log** - should use logger
5. **TODO/FIXME** - list them
6. **Security** - hardcoded secrets, SQL injection risks
7. **Performance** - N+1 queries, missing caching

## Actions
1. Run: cd /root/.claude && pnpm build
2. Check for type errors
3. Run: pnpm test (if available)
4. Fix any obvious issues (type errors, missing imports)
5. Create report at: ${REPORT_FILE}

## Report Format
Save JSON report with:
- timestamp
- files_analyzed
- issues_found (by category)
- auto_fixes_applied
- manual_review_needed
- overall_score

## Notification
After completion, send summary to Telegram with key findings.

Run ID: ${RUN_ID}"

# Check if Redis is running (for BullMQ worker)
if redis-cli ping > /dev/null 2>&1; then
  echo "[$RUN_ID] Redis is running, checking for worker..." | tee -a "$LOG_FILE"

  # Check if worker queue has consumers
  CONSUMERS=$(redis-cli XINFO GROUPS bullmq:agent-execution 2>/dev/null | grep -c consumers || echo "0")

  if [ "$CONSUMERS" -gt "0" ]; then
    echo "[$RUN_ID] Worker detected, starting via BullMQ..." | tee -a "$LOG_FILE"

    # Start workflow via MCP tool (using node to call the client)
    cd /root/.claude/packages/workflow
    node -e "
      import { BullMQWorkflowClient } from './dist/bullmq/client.js';
      const client = new BullMQWorkflowClient();
      const handle = await client.start('${RUN_ID}', {
        prompt: \`${CONSILIUM_PROMPT}\`,
        cwd: '/root/.claude'
      });
      console.log('Started workflow:', handle.workflowId);
      process.exit(0);
    " >> "$LOG_FILE" 2>&1 && {
      echo "[$RUN_ID] Workflow started via BullMQ" | tee -a "$LOG_FILE"
      notify_telegram "⏳ Consilium workflow started via worker (${RUN_ID})"
      exit 0
    } || {
      echo "[$RUN_ID] BullMQ start failed, falling back to CLI" | tee -a "$LOG_FILE"
    }
  fi
fi

# Fallback: Direct Claude CLI execution
echo "[$RUN_ID] Running via Claude CLI..." | tee -a "$LOG_FILE"

claude --print "$CONSILIUM_PROMPT" >> "$LOG_FILE" 2>&1 || {
  echo "[$RUN_ID] Claude CLI failed with exit code $?" | tee -a "$LOG_FILE"
  notify_telegram "❌ Nightly Consilium failed! Check: $LOG_FILE"
  exit 1
}

echo "[$RUN_ID] Consilium finished at $(date)" | tee -a "$LOG_FILE"

# Check if report was created
if [ -f "$REPORT_FILE" ]; then
  ISSUES=$(jq -r '.issues_found | length' "$REPORT_FILE" 2>/dev/null || echo "?")
  SCORE=$(jq -r '.overall_score' "$REPORT_FILE" 2>/dev/null || echo "?")
  notify_telegram "✅ Nightly Consilium completed!

📊 Score: ${SCORE}/100
🔍 Issues found: ${ISSUES}
📁 Report: ${REPORT_FILE}"
else
  notify_telegram "✅ Nightly Consilium completed. Check logs: ${LOG_FILE}"
fi
