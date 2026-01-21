# User Feedback Collection

## Цель

Собирать все сообщения пользователя для анализа CPO агентом.

---

## Что собираем

### 1. Явные сообщения
- Все user messages из conversations
- Голосовые (после транскрипции)
- Telegram сообщения

### 2. Implicit Feedback
- Что пользователь переделывал (retry)
- Где прерывал работу агента
- Какие результаты отвергал

### 3. Patterns
- Частые запросы (>2 раз в неделю)
- Время использования
- Какие agents/workflows используются

---

## Storage

### Daily Log
`/root/.claude/logs/daily/{YYYY-MM-DD}/`

```
{date}/
├── conversations.jsonl    # Все сообщения
├── commands.jsonl         # Команды и их результаты
├── errors.jsonl          # Ошибки
└── summary.json          # Дневной summary
```

### Conversations Format
```jsonl
{"ts": "2026-01-21T10:30:00Z", "role": "user", "content": "...", "context": "deep-research"}
{"ts": "2026-01-21T10:31:00Z", "role": "assistant", "content": "...", "tools_used": ["perplexity"]}
```

### Summary Format
```json
{
  "date": "2026-01-21",
  "messages_count": 45,
  "user_messages": 20,
  "agents_used": ["deep-research", "web-search"],
  "errors": 2,
  "key_topics": ["vertical AI", "notion integration"],
  "sentiment": "neutral",
  "explicit_feedback": [
    {"type": "complaint", "text": "notion не работает", "resolved": true},
    {"type": "request", "text": "добавь CPO агента", "resolved": false}
  ]
}
```

---

## Collection Points

### 1. Claude Code Sessions
Автоматически логируется в:
`/root/.claude/projects/-root/{session-id}.jsonl`

CPO читает эти файлы.

### 2. Telegram
Через `elio_database_messages_unprocessed`

### 3. Manual Annotations
Пользователь может явно пометить:
```
/feedback это было плохо потому что X
/idea хочу чтобы Y
```

---

## Privacy

- Логи только локальные
- Не отправляются никуда
- Пользователь может удалить: `rm -rf /root/.claude/logs/daily/{date}`

---

## CPO Access

CPO агент читает:
1. Последние 24 часа из `/root/.claude/logs/daily/`
2. Session transcripts из `/root/.claude/projects/`
3. Telegram messages через MCP

И формирует:
- `explicit_requests` — прямые запросы
- `complaints` — жалобы
- `patterns` — паттерны использования
- `implicit_needs` — невысказанные потребности
