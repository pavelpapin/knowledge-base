# Workflow: cold-outreach

## Purpose
Создание и отправка персонализированных cold outreach сообщений.

## Trigger
- Manual: "сделай outreach для {target}"
- Batch: "обработай список лидов"

## Prerequisites
- LinkedIn Sales Navigator или Apollo
- Gmail или LinkedIn messaging
- context/companies/ для offering

## Steps

### 1. Получить таргет
- **Input options**:
  - Имя + компания
  - LinkedIn URL
  - Список из CSV/Sheets

### 2. Исследовать человека
- **Skill**: person-research
- **Focus on**:
  - Текущая роль и обязанности
  - Недавние посты/активность
  - Общие связи
  - Pain points по роли
- **Output**: prospect_profile

### 3. Исследовать компанию
- **Skill**: web-search, linkedin
- **Focus on**:
  - Размер, индустрия, стадия
  - Недавние новости
  - Технологии (если B2B tech)
  - Конкуренты
- **Output**: company_profile

### 4. Найти angle
- **Analyze**:
  - Что мы предлагаем vs их потребности
  - Общие связи для intro
  - Недавние события (funding, hire, launch)
  - Общие интересы
- **Output**: personalization_angle

### 5. Выбрать канал
- **Options**:
  - LinkedIn connection request + note
  - LinkedIn InMail
  - Cold email
  - Warm intro request
- **Decision based on**:
  - Наличие email
  - Общие связи
  - Активность на LinkedIn

### 6. Сгенерировать сообщение
- **Skill**: message-compose
- **Template по каналу**:

  **LinkedIn connection (300 chars)**:
  ```
  Hi {first_name}, noticed {personalization}.
  {one_line_value_prop}. Would love to connect.
  ```

  **Cold email**:
  ```
  Subject: {personalized_subject}

  Hi {first_name},

  {hook_based_on_research}

  {brief_value_prop}

  {soft_cta}

  Best,
  {your_name}
  ```

- **Style**: context/writing-style.md (Sales email)

### 7. Human Review
- **Display**:
  ```
  🎯 Outreach: {name} - {title} at {company}

  Research summary:
  - {key_finding_1}
  - {key_finding_2}

  Angle: {personalization_angle}
  Channel: {recommended_channel}

  Message:
  ---
  {draft_message}
  ---

  [Send] [Edit] [Skip] [Different angle]
  ```

### 8. Отправка
- **If LinkedIn**: linkedin.sendConnectionRequest
- **If Email**: gmail.sendEmail
- **Track**: сохранить в CRM/Sheets

### 9. Schedule Follow-up
- **Create task**: "Follow up with {name}" in 3-5 days
- **Condition**: if no response
- **Template**: follow-up message

### 10. Log & Learn
- **Log**:
  ```json
  {
    "prospect": "...",
    "company": "...",
    "channel": "linkedin",
    "angle": "...",
    "sent_at": "...",
    "status": "sent"
  }
  ```
- **Track responses**: для улучшения шаблонов

## Output
- Sent message
- Follow-up task created
- Updated CRM/tracking

## Logging
```
/logs/workflows/outreach.jsonl
/logs/daily/{date}/outreach.jsonl
```

## Error Handling
- Can't find email: suggest LinkedIn
- LinkedIn rate limit: queue for later
- Low quality research: flag for manual review

## Configuration
```json
{
  "default_channel": "linkedin",
  "follow_up_days": 4,
  "max_daily_linkedin": 25,
  "max_daily_email": 50,
  "require_approval": true,
  "track_in": "hubspot"
}
```

## Notes
- Никогда не отправлять без персонализации
- Следить за rate limits
- A/B тестировать angles
- Обновлять шаблоны по результатам
