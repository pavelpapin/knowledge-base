# Elio Team

AI сотрудники, которые работают на тебя автономно.

---

## Концепция

Каждый сотрудник (team member) — это специализированный AI агент с:
- **Ролью** — область ответственности
- **Расписанием** — когда работает (nightly, hourly, on-demand)
- **Полномочиями** — что может делать сам, что требует approval
- **Отчётностью** — как и когда докладывает

---

## Current Team

| Role | Schedule | Mission | Reports To |
|------|----------|---------|------------|
| **CEO = System Architect** | 00:00 | Бизнес результат. Деньги. Скорость. Фокус. | User |
| **CTO = Platform Architect** | 00:30 | Превращать намерение в систему. Надёжно. | CEO |
| **CPO = Learning Loop** | 01:00 | Продукт лучше через данные. Не через вкус. | CEO |

### Org Chart

```
              ┌─────────┐
              │  User   │
              └────┬────┘
                   │
         ┌─────────▼─────────┐
         │   CEO             │
         │   System Architect│
         │   ───────────────│
         │   Деньги, фокус,  │
         │   приоритеты      │
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    │                             │
┌───▼────────────┐      ┌────────▼───┐
│  CTO           │      │  CPO       │
│  Platform      │      │  Learning  │
│  Architect     │      │  Loop      │
│  ────────────  │      │  ───────── │
│  Архитектура,  │      │  Качество, │
│  MCP, доступы, │      │  метрики,  │
│  observability │      │  eval sets │
└────────────────┘      └────────────┘
```

---

## Planned Roles

| Role | Responsibility | Priority |
|------|----------------|----------|
| EA | Executive Assistant — calendar, email, meetings | High |
| CFO | Finances, subscriptions, costs tracking | Medium |
| COO | Operations, scheduling, coordination | Medium |
| CMO | Content, outreach, social media | Low |

---

## Team Structure

```
/root/.claude/team/
├── TEAM.md              # This file
├── config.json          # Team schedule & settings
├── ceo/
│   └── ROLE.md          # CEO role (coordinates team)
├── cto/
│   ├── ROLE.md          # CTO role (technical)
│   ├── prompts/
│   └── templates/
├── cpo/
│   ├── ROLE.md          # CPO role (product)
│   ├── prompts/
│   └── templates/
└── {role}/
    └── ...
```

---

## How It Works

### 1. Scheduled Work
Сотрудники работают по расписанию (nightly, hourly).
Config: `/root/.claude/team/config.json`

### 2. On-Demand
Можно вызвать вручную:
```
/ceo review    — стратегический обзор, координация
/cto review    — технический обзор
/cpo analyze   — продуктовый анализ
```

### 3. Reports
Каждый сотрудник присылает отчёты:
- **Telegram** — краткий summary
- **Notion** — полный отчёт
- **Local** — backup в `/root/.claude/logs/team/`

### 4. Permissions

| Level | Что может | Пример |
|-------|-----------|--------|
| Auto | Делает сам | Fix typos, update links |
| Propose | Предлагает на approval | New agent, architecture change |
| Escalate | Срочно уведомляет | Security issue, critical error |

---

## Hiring New Team Members

Чтобы "нанять" нового сотрудника:

1. Создать директорию: `/root/.claude/team/{role}/`
2. Написать `ROLE.md` с описанием
3. Добавить в `config.json`
4. Создать prompts и templates

---

## Communication

### Morning Standup (08:00)
Все сотрудники присылают summary в один отчёт:
- CEO: strategic overview, priorities
- CTO: tech status
- CPO: product updates

### Alerts
Срочные вопросы — сразу в Telegram.

### Weekly Summary
Раз в неделю — общий отчёт по всей команде.
