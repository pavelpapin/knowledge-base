# Workflow: meeting-prep

## Purpose
Подготовка к встрече: собрать контекст, сформировать agenda, talking points.

## Trigger
- Manual: "подготовь к встрече с X"
- Scheduled: за 30 минут до встречи
- Event: новое приглашение в календарь

## Prerequisites
- Google Calendar API
- Заполнены context/people/, context/companies/
- Gmail для истории переписки

## Steps

### 1. Получить детали встречи
- **Action**: Загрузить event из календаря
- **Skill**: calendar (getEvent)
- **Extract**:
  - Название, время, длительность
  - Участники
  - Описание/agenda если есть
  - Ссылка на звонок

### 2. Исследовать участников
- **For each participant**:
  - Check context/people/{name}.md
  - If not found: run person-research (quick)
- **Output**: participants_profiles[]

### 3. Собрать историю взаимодействий
- **Search**:
  - Gmail: переписка с участниками
  - Calendar: прошлые встречи
  - Notion: заметки о встречах
- **Output**: interaction_history

### 4. Определить контекст компании
- **If company meeting**:
  - Check context/companies/{company}.md
  - Recent news about company
  - Open deals/projects
- **Output**: company_context

### 5. Сформировать prep document
- **Generate**:
  ```markdown
  # Meeting Prep: {title}

  ## Basics
  - When: {datetime}
  - Duration: {duration}
  - Location/Link: {location}

  ## Participants
  - {name} - {role} at {company}
    - Key: {key_facts}
    - Last interaction: {date}

  ## History
  - {previous_meetings_summary}
  - {email_threads_summary}

  ## Suggested Agenda
  1. {topic_1}
  2. {topic_2}

  ## Talking Points
  - {point_1}
  - {point_2}

  ## Questions to Ask
  - {question_1}
  - {question_2}

  ## Goals
  - {desired_outcome}

  ## Notes
  {space_for_notes}
  ```

### 6. Human Review
- **Display**: prep document
- **Actions**:
  - Approve as is
  - Request more research
  - Edit talking points
  - Add notes

### 7. Save & Remind
- **Save to**: Notion или локально
- **Set reminder**: 15 min before meeting
- **Attach to**: calendar event (optional)

## Output
- Prep document
- Updated context/people/ files
- Reminder set

## Logging
```
/logs/workflows/meeting-prep.log
/logs/daily/{date}/meetings.jsonl
```

## Error Handling
- Participant not found: create minimal profile
- No history: note "First interaction"
- Calendar API fail: prompt for manual details

## Configuration
```json
{
  "auto_prep_before": "30m",
  "research_depth": "quick",
  "save_to": "notion",
  "vip_meetings": ["board", "investor", "customer"]
}
```
