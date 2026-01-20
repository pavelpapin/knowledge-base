#!/bin/bash
# Night Refactoring Job - runs at 02:00 Tbilisi time (22:00 UTC)

export PATH=/usr/local/bin:/usr/bin:/bin
export HOME=/root

LOG_FILE="/root/.claude/logs/daily/night-refactoring-$(date +%Y-%m-%d).log"
mkdir -p /root/.claude/logs/daily

echo "=== Night Refactoring Started: $(date) ===" >> "$LOG_FILE"

# Run headless Claude with the refactoring task
cd /root/.claude/headless

PROMPT="Выполни задачи из /root/.claude/jobs/night-refactoring.json:

1. Исправь SSL в postgres.ts - поставь rejectUnauthorized: true
2. Добавь валидацию skillName в skills.ts против path traversal
3. Добавь TTL для сессий в session.ts (24 часа)
4. Добавь лимит очереди в taskQueue.ts (max 50)
5. Добавь structured logging в elio-bot

После каждого изменения пересобери проект и проверь что работает.
Обнови статус задач в JSON файле.
Отправь уведомление в Telegram когда закончишь."

node dist/cli.js --prompt "$PROMPT" >> "$LOG_FILE" 2>&1

echo "=== Night Refactoring Completed: $(date) ===" >> "$LOG_FILE"
