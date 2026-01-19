# Workflow: telegram-inbox

## Purpose
Обработка входящих сообщений в Telegram: читать, находить контекст, писать ответы, отправлять после подтверждения.

## Trigger
- Manual: команда "обработай телеграм"
- Scheduled: каждые 2 часа (опционально)
- Event: новое сообщение (webhook)

## Prerequisites
- Настроен Telegram Bot
- Есть доступ к нужным чатам
- Заполнен context/people/ для известных контактов

## Steps

### 1. Получить новые сообщения
- **Action**: Загрузить непрочитанные сообщения
- **Skill**: telegram (getUpdates)
- **Input**: last_processed_id из logs/
- **Output**: messages[]

### 2. Для каждого сообщения: Определить контекст
- **Action**: Найти информацию об отправителе
- **Skill**: context-lookup
- **Input**: sender_id, sender_name
- **Output**: person_context или null
- **If not found**:
  - Запустить person-research (quick)
  - Сохранить в context/people/

### 3. Найти релевантный контекст
- **Action**: Поиск упомянутых встреч, записей, задач
- **Skill**: context-search
- **Input**: message_text
- **Search in**:
  - Google Calendar (недавние встречи)
  - Notion (заметки, задачи)
  - Gmail (переписка)
- **Output**: related_context[]

### 4. Классифицировать сообщение
- **Action**: Определить тип и приоритет
- **Categories**:
  - `action_required` - нужен ответ/действие
  - `fyi` - информация, не требует ответа
  - `question` - вопрос, нужен ответ
  - `request` - просьба что-то сделать
  - `social` - неформальное общение
- **Output**: category, priority (high/medium/low)

### 5. Сгенерировать драфт ответа
- **Action**: Написать ответ на основе контекста
- **Skill**: message-compose
- **Input**:
  - message
  - person_context
  - related_context
  - writing_style (from context/writing-style.md)
- **Output**: draft_response
- **Style**:
  - Telegram style (короткий, без лишних приветствий)
  - Язык как в оригинале

### 6. Human Review
- **Action**: Показать драфт пользователю
- **Display**:
  ```
  От: {sender_name}
  Сообщение: {message_text}
  Контекст: {related_context_summary}

  Драфт ответа:
  {draft_response}

  [Отправить] [Редактировать] [Пропустить]
  ```
- **On Approve**: Перейти к шагу 7
- **On Edit**: Принять изменения, перейти к шагу 7
- **On Skip**: Пометить как skipped, перейти к следующему

### 7. Отправить ответ
- **Action**: Отправить сообщение
- **Skill**: telegram (sendMessage)
- **Input**: chat_id, response_text
- **Output**: sent_message_id

### 8. Обновить индексы
- **Action**: Сохранить в context graph
- **Updates**:
  - Обновить last_interaction для person
  - Добавить в conversation history
  - Обновить topics discussed
- **Skill**: context-graph (addInteraction)

### 9. Логирование
- **Action**: Записать в лог
- **Path**: /logs/daily/{date}/telegram.jsonl
- **Data**:
  ```json
  {
    "timestamp": "...",
    "sender": "...",
    "message_preview": "...",
    "category": "...",
    "action": "replied|skipped|deferred",
    "response_preview": "..."
  }
  ```

## Output
- Количество обработанных сообщений
- Количество отправленных ответов
- Количество пропущенных
- Список требующих внимания (deferred)

## Logging
```
/logs/daily/{date}/telegram.jsonl     - все обработки
/logs/workflows/telegram-inbox.log    - системные логи
```

## Error Handling
- Telegram API unavailable: retry 3 раза с экспоненциальным backoff
- Context not found: продолжить без контекста
- Send failed: сохранить в queue для повторной отправки
- User cancelled: остановить workflow, сохранить прогресс

## Configuration
```json
{
  "auto_process_interval": "2h",
  "skip_older_than": "24h",
  "require_approval": true,
  "auto_approve_categories": ["social"],
  "priority_chats": ["..."],
  "ignore_chats": ["..."]
}
```

## Notes
- Всегда показывать контекст перед ответом
- Не отвечать автоматически без подтверждения
- Группировать сообщения от одного человека
- Учитывать часовой пояс отправителя
