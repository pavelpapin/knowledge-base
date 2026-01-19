# Workflow: email-inbox

## Purpose
Обработка входящих email: триаж, приоритезация, драфты ответов.

## Trigger
- Manual: команда "обработай почту"
- Scheduled: каждые 4 часа
- Event: новый email с высоким приоритетом

## Prerequisites
- Настроен Gmail API
- Заполнен context/people/ и context/companies/
- Настроены фильтры (VIP, ignored)

## Steps

### 1. Получить новые письма
- **Action**: Загрузить непрочитанные
- **Skill**: gmail (listMessages)
- **Filter**: is:unread, last 24h
- **Output**: emails[]

### 2. Быстрый триаж
- **Action**: Классификация без глубокого анализа
- **Categories**:
  - `vip` - от VIP контактов
  - `actionable` - требует действия
  - `fyi` - информация
  - `newsletter` - рассылки
  - `spam` - спам/нерелевантное
- **Auto-actions**:
  - newsletter → archive, label:newsletters
  - spam → delete или spam folder

### 3. Обогащение контекстом
- **For each actionable email**:
  - Lookup sender in context/people/
  - Lookup company in context/companies/
  - Find related threads
  - Find calendar events with sender
- **Output**: enriched_email

### 4. Приоритезация
- **Factors**:
  - VIP статус отправителя
  - Упоминание deadline
  - Длина цепочки (follow-up важнее)
  - Тема (sales, support, etc.)
- **Output**: priority (1-5)

### 5. Генерация ответов
- **For priority 1-3 emails**:
  - Сгенерировать драфт
  - Стиль из context/writing-style.md (Email Style)
  - Учесть историю переписки
- **Output**: draft_responses[]

### 6. Human Review
- **Display summary**:
  ```
  📧 Inbox Summary:
  - VIP: 2 (1 требует ответа)
  - Actionable: 5 (3 драфта готовы)
  - FYI: 8 (архивировано)
  - Newsletters: 12 (архивировано)

  Требуют внимания:
  1. [VIP] John Smith - Re: Partnership proposal
     Драфт: [Просмотр]
  2. [High] Client X - Urgent: contract question
     Драфт: [Просмотр]
  ```
- **Actions per email**: Send | Edit | Snooze | Skip

### 7. Отправка и follow-up
- **Action**: Отправить одобренные ответы
- **Create tasks**: Для писем с action items
- **Set reminders**: Для snoozed emails

### 8. Обновление контекста
- **Update**: last_interaction для контактов
- **Extract**: новые контакты, компании
- **Log**: conversation summaries

## Output
- Inbox zero status
- Sent responses count
- Created tasks
- Pending items

## Logging
```
/logs/daily/{date}/email.jsonl
/logs/workflows/email-inbox.log
```

## Error Handling
- Gmail API quota: wait and retry
- Draft generation failed: skip, mark for manual
- Send failed: save to drafts

## Configuration
```json
{
  "process_interval": "4h",
  "vip_list": ["ceo@company.com", ...],
  "ignore_senders": ["noreply@...", ...],
  "auto_archive_labels": ["newsletters", "notifications"],
  "require_approval": true,
  "auto_send_categories": []
}
```
