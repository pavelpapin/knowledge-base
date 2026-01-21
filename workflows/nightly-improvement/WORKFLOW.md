# Nightly Improvement Workflow

## Overview
Автономный ночной агент, который:
1. Анализирует все issues за день
2. Тестирует проблемные источники данных
3. Применяет автоматические фиксы
4. Генерирует отчет и задачи на утро

## Schedule
- **Когда**: Каждую ночь в 03:00 (Tbilisi time)
- **Длительность**: ~30-60 минут
- **Триггер**: cron или ручной запуск

## Workflow Stages

### Stage 1: Collect Issues
```
1. Загрузить все issues за последние 24 часа
2. Загрузить pending improvement tasks
3. Группировать по типу и источнику
```

### Stage 2: Health Check
```
Для каждого проблемного источника:
1. Проверить connectivity (ping API)
2. Сделать тестовый запрос
3. Записать результат (работает/не работает/частично)
```

Источники для проверки:
- Perplexity API
- Jina Reader
- DuckDuckGo
- Google News
- YouTube Transcripts
- LinkedIn (cookie validation)
- Scrape.do

### Stage 3: Auto-Fix
```
Для каждого auto-fixable issue:
1. Определить тип фикса
2. Применить фикс
3. Протестировать
4. Если успешно - пометить как fixed
```

Auto-fixable issues:
- **Expired tokens**: Refresh если есть refresh_token
- **Wrong file paths**: Исправить пути в конфигах
- **Outdated URLs**: Обновить endpoints
- **Cache issues**: Очистить кэш проблемного источника
- **Rate limit reset**: Сбросить счетчики rate limit

### Stage 4: Code Analysis (optional)
```
Если есть повторяющиеся паттерны ошибок:
1. Найти связанный код
2. Сгенерировать patch
3. Сохранить как PR draft (не применять автоматически)
```

### Stage 5: Generate Report
```
Создать отчет:
- Summary: сколько issues, сколько fixed
- Health status каждого источника
- Pending tasks на утро
- Recommendations
```

### Stage 6: Notify
```
Отправить в Telegram:
- Краткий summary
- Critical issues (если есть)
- Ссылка на полный отчет
```

---

## Output Files

### `/root/.claude/logs/nightly/YYYY-MM-DD.json`
```json
{
  "date": "2026-01-21",
  "startedAt": "03:00:00",
  "completedAt": "03:45:00",
  "issuesProcessed": 15,
  "issuesFixed": 8,
  "healthChecks": {
    "perplexity": "ok",
    "jina": "ok",
    "linkedin": "partial"
  },
  "autoFixes": [
    {
      "issue": "linkedin token expired",
      "action": "refresh attempted",
      "result": "failed - no refresh token"
    }
  ],
  "pendingForMorning": [
    "LinkedIn cookie needs manual refresh",
    "Review new blocking pattern from G2"
  ],
  "codePatches": []
}
```

### Telegram Notification
```
🌙 Nightly Improvement Report (21 Jan)

Issues: 15 processed, 8 auto-fixed
Health: 5/7 sources OK

⚠️ Needs attention:
- LinkedIn cookie expired
- G2 new captcha pattern

Full report: /logs/nightly/2026-01-21.json
```

---

## Configuration

### `/root/.claude/config/nightly.json`
```json
{
  "enabled": true,
  "schedule": "0 3 * * *",
  "timezone": "Asia/Tbilisi",
  "autoFix": {
    "enabled": true,
    "maxFixes": 10,
    "dryRun": false
  },
  "healthCheck": {
    "enabled": true,
    "sources": ["perplexity", "jina", "ddg", "google_news", "youtube", "linkedin"]
  },
  "codeAnalysis": {
    "enabled": false,
    "createPRs": false
  },
  "notifications": {
    "telegram": true,
    "onlyOnIssues": false
  }
}
```

---

## Manual Trigger

```bash
# Run nightly improvement manually
elio_agents_elio_agent_start prompt="Run nightly improvement workflow"

# Or via MCP tool
elio_n8n_trigger webhook="nightly-improvement"
```

---

## Integration Points

### Input
- `/root/.claude/logs/issues/*.jsonl` - daily issues
- `/root/.claude/logs/improvements/pending-tasks.json` - pending tasks
- `/root/.claude/logs/agents/*.json` - run summaries

### Output
- `/root/.claude/logs/nightly/YYYY-MM-DD.json` - nightly report
- `/root/.claude/logs/improvements/pending-tasks.json` - updated tasks
- Telegram notification

### Code References
- `core/observability/agent-logger.ts` - issue logging
- `core/observability/post-run-analyzer.ts` - analysis
- `core/observability/nightly-agent.ts` - this workflow

---

## Error Handling

1. **Health check fails**: Log and continue, don't block workflow
2. **Auto-fix fails**: Revert, log, add to morning tasks
3. **Telegram fails**: Save report locally, retry in morning
4. **Timeout**: Complete partial report, notify about timeout

---

## Metrics Tracked

- Time to complete nightly run
- Fix success rate
- Source health over time
- Issue trend (increasing/decreasing)
- Mean time to fix (from issue to resolution)
