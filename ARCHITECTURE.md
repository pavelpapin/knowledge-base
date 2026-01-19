# Elio OS - Architecture Design v3

## Design Principles

1. **Unix Philosophy** - каждый модуль делает одну вещь хорошо
2. **Context Engineering** - правильная организация контекста
3. **Self-Improvement** - система учится на коррекциях
4. **Composability** - skills и workflows комбинируются
5. **Human-in-the-loop** - критические действия требуют подтверждения

---

## Directory Structure

```
/root/.claude/
│
├── CLAUDE.md                    # Главные правила и identity
├── ARCHITECTURE.md              # Этот документ
│
├── context/                     # Весь контекст о пользователе
│   ├── profile.md               # Основной профиль (имя, контакты, языки)
│   ├── preferences.md           # Предпочтения (стиль, форматы, избегать)
│   ├── philosophy.md            # Цели, ценности, философия
│   ├── writing-style.md         # Примеры стиля письма
│   ├── companies/               # Информация о компаниях
│   │   └── {company}.md
│   ├── people/                  # Информация о людях
│   │   └── {person}.md
│   └── projects/                # Активные проекты
│       └── {project}.md
│
├── skills/                      # Атомарные навыки
│   ├── _template/               # Шаблон для новых skills
│   │   └── SKILL.md
│   ├── web-search/
│   │   ├── SKILL.md             # Описание и инструкции
│   │   └── ...
│   ├── deep-research/
│   ├── youtube-transcript/
│   ├── person-research/
│   ├── email-compose/
│   ├── telegram-reply/
│   └── ...
│
├── workflows/                   # Комплексные workflows
│   ├── _template/
│   │   └── WORKFLOW.md
│   ├── telegram-inbox/          # Обработка telegram
│   │   └── WORKFLOW.md
│   ├── email-inbox/             # Обработка email
│   ├── daily-review/            # Ежедневный обзор
│   ├── weekly-planning/         # Еженедельное планирование
│   ├── meeting-prep/            # Подготовка к встрече
│   ├── content-creation/        # Создание контента
│   └── cold-outreach/           # Cold outreach
│
├── integrations/                # MCP интеграции (built-in)
│   ├── gmail.ts
│   ├── calendar.ts
│   ├── notion.ts
│   ├── telegram.ts
│   └── ...
│
├── core/                        # Ядро системы
│   ├── gtd/                     # GTD система
│   ├── graph/                   # Context graph
│   ├── memory/                  # Долгосрочная память
│   ├── improvement/             # Self-improvement
│   └── scheduler/               # Планировщик задач
│
├── logs/                        # Логи выполнения
│   ├── daily/                   # По дням
│   ├── skills/                  # По skills
│   └── corrections/             # Логи коррекций
│
└── secrets/                     # API ключи и токены
    ├── google-credentials.json
    ├── notion-token.json
    └── ...
```

---

## SKILL Format

Каждый skill - атомарная операция с четким SKILL.md:

```markdown
# Skill: {name}

## Purpose
{Одно предложение - что делает этот skill}

## When to Use
{Когда запускать этот skill}

## Inputs
- `{param1}` (required): {description}
- `{param2}` (optional): {description}

## Outputs
{Что возвращает skill}

## Steps
1. {Step 1}
2. {Step 2}
...

## Examples
{Примеры использования}

## Integrations Used
- {integration1}
- {integration2}

## Notes
{Дополнительные заметки}
```

---

## WORKFLOW Format

Workflow - цепочка skills с логикой:

```markdown
# Workflow: {name}

## Purpose
{Что делает этот workflow}

## Trigger
{Когда запускается: manual, scheduled, event}

## Steps

### 1. {Step Name}
- **Skill**: {skill_name}
- **Input**: {откуда берем данные}
- **Output**: {куда сохраняем}

### 2. {Step Name}
- **Skill**: {skill_name}
- **Condition**: {условие выполнения}
...

### N. Human Review
- **Action**: Ask user for approval
- **On Approve**: Continue
- **On Reject**: {action}

## Error Handling
{Что делать при ошибках}

## Logging
{Что логировать}
```

---

## Context Loading Strategy

### Level 1: Always Loaded (CLAUDE.md)
- Identity
- Core rules
- Available skills list
- Available integrations list

### Level 2: Lazy Loaded (on demand)
- User profile
- Company context
- People context (when mentioned)

### Level 3: Task-Specific
- Skill instructions
- Workflow steps
- Relevant logs

---

## Self-Improvement Loop

```
1. User gives task
2. Elio executes
3. User corrects (if needed)
4. Correction logged to /logs/corrections/
5. Daily: analyze corrections
6. Auto-update CLAUDE.md or skill instructions
```

---

## Integration Pattern

Integrations expose:
1. **Functions** - atomic operations
2. **MCP Tools** - for Claude to call
3. **Webhooks** - for external triggers

---

## Execution Modes

1. **Interactive** - dialog with user
2. **Headless** - `claude -p "task"` for automation
3. **Scheduled** - cron-triggered tasks
4. **Event-driven** - webhook triggers

---

## Quality Assurance

1. **Pre-check**: validate inputs
2. **Execution**: run with logging
3. **Post-check**: verify output quality
4. **Human review**: for critical actions
