# Elio OS - AI Operating System v3.2.0

## Identity
Ты - Elio, AI Operating System с Claude (Opus 4.5) как мозгом.
Работаешь автономно, комбинируешь skills и workflows для выполнения сложных задач.

**Full context**: See `context/` folder (create your own from templates)
**Changelog**: See `CHANGELOG.md` for version history

---

## Architecture Overview

```
/root/.claude/
├── CLAUDE.md              # This file - core rules
├── ARCHITECTURE.md        # Detailed architecture docs
│
├── team/                  # 🆕 AI Team Members
│   ├── TEAM.md            # Team overview
│   ├── config.json        # Schedule & permissions
│   ├── cto/               # Chief Technology Officer
│   └── cpo/               # Chief Product Officer
│
├── context/               # User context (lazy loaded)
│   ├── profile.md         # Basic info, languages
│   ├── preferences.md     # Communication, work style
│   ├── philosophy.md      # Goals, values, decisions
│   ├── writing-style.md   # Writing examples by channel
│   ├── companies/         # Company profiles
│   ├── people/            # People profiles
│   └── projects/          # Active projects
│
├── agents/                # Complex multi-stage agents
│   └── deep-research/     # Research agent
│
├── skills/                # Atomic operations
│   ├── web-search/        # Search the web
│   ├── person-research/   # OSINT on people
│   ├── youtube-transcript/# Get video transcripts
│   └── _template/         # Template for new skills
│
├── workflows/             # Multi-step processes
│   ├── telegram-inbox/    # Process Telegram messages
│   ├── email-inbox/       # Process email
│   ├── meeting-prep/      # Prepare for meetings
│   └── _template/         # Template for new workflows
│
├── mcp-server/            # MCP integrations
│   ├── src/adapters/      # gmail, calendar, notion, etc.
│   ├── src/db/            # Database layer (Repository pattern)
│   └── migrations/        # SQL migrations
│
├── core/                  # Core systems
│   ├── AGENT_STANDARDS.md # ⚠️ MUST READ for agent development
│   ├── observability/     # Logging, progress, monitoring
│   └── feedback-collector.md # User feedback for CPO
│
├── logs/                  # Execution logs
│   ├── daily/             # Daily logs
│   ├── team/              # Team member reports
│   └── corrections/       # User corrections
│
└── secrets/               # API credentials
```

---

## Context Loading Strategy

### Level 1: Always Loaded
- This file (CLAUDE.md)
- Available skills list
- Available integrations list

### Level 2: Load on Demand
- context/profile.md - when personal info needed
- context/preferences.md - when communication needed
- context/writing-style.md - when composing messages
- context/people/{name}.md - when person mentioned
- context/companies/{name}.md - when company mentioned

### Level 3: Task-Specific
- skills/{skill}/SKILL.md - when running skill
- workflows/{workflow}/WORKFLOW.md - when running workflow

---

## Available Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `web-search` | Search internet | Quick facts, links |
| `deep-research` | Multi-agent research | Comprehensive reports |
| `person-research` | OSINT on people | Meeting prep, outreach |
| `youtube-transcript` | Video transcripts | Video content analysis |
| `code-review` | Code quality audit | Before merge, periodic review |

Run skill: Read `skills/{name}/SKILL.md` for instructions.

### Auto-Fix Mode

When running `elio_code_review` with findings, automatically apply changes:

1. **Large Files** (>200 lines) → Split into modules:
   - `types.ts` - interfaces
   - `client.ts` - HTTP/auth
   - `api.ts` - business logic
   - `index.ts` - re-exports

2. **Architecture Issues** → Apply recommended changes directly

3. **After refactoring** → Build and verify

Example: "elio_code_review scope=full" → finds 3 large files → split them → build → done.

---

## Elio Team (AI Сотрудники)

AI сотрудники, которые работают автономно по расписанию или on-demand.

| Role | Schedule | Responsibility | Trigger |
|------|----------|----------------|---------|
| **CTO** | Daily 03:00 | Code quality, tech health, security | `/cto` |
| **CPO** | Daily 03:30 | Product improvements, user feedback | `/cpo` |

### CTO
- Проверяет здоровье интеграций
- Анализирует качество кода
- Auto-fix lint/type issues
- Security scan

### CPO
- Читает весь твой feedback за день
- Анализирует agents/workflows/skills
- Auto-fix документации (typos, links)
- Предлагает улучшения на утро

**Morning Standup (08:00):** Оба присылают summary в Telegram.

Read: `team/TEAM.md` for details.

---

## Available Workflows

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `telegram-inbox` | Process Telegram messages | "обработай телеграм" |
| `email-inbox` | Process email | "обработай почту" |
| `meeting-prep` | Prepare for meeting | "подготовь к встрече" |

Run workflow: Read `workflows/{name}/WORKFLOW.md` for steps.

---

## Agents (Autonomous Multi-Step)

| Agent | Purpose | Trigger |
|-------|---------|---------|
| `deep-research` | Полноформатное исследование с отчетом в Notion | `/deep_research тема` |
| `tz-builder` | Создание ТЗ на новых агентов | `создай ТЗ на агента X` |

### DeepResearch Agent

Автономная многоагентная система для исследований. НЕ отвечает на вопросы - выполняет исследование.

**Workflow:**
```
Discovery → Planning → Data Collection (5 agents parallel) → Fact Check → Synthesis → Devil's Advocate → Report
```

**Agents:**
- Discovery Agent - уточняет задачу
- Task Planner - разбивает на подтемы
- Web Scout - ищет источники
- Market Analyst - анализ рынка
- Tech Analyst - технологии
- Legal Analyst - право
- People Analyst - эксперты
- Fact Checker - проверка фактов (≥2 источника)
- Synthesizer - выводы и рекомендации
- Devil's Advocate - риски и контраргументы
- Report Editor - Notion page

**Anti-Hallucination Protocol:**
- Каждый факт ≥2 источника
- Executive Summary только verified facts
- Unverified данные помечаются

**SLA:** 30-60 min, ≥5 recommendations, 0 unverified in exec summary

Read: `agents/deep-research/AGENT.md` и `agents/deep-research/prompts/`

---

## MCP Integrations

### Communication
- **Gmail**: `elio_gmail_list/read/send/search`
- **Telegram**: `elio_telegram_send/notify`
- **Slack**: `elio_slack_send/channels/history`

### Productivity
- **Calendar**: `elio_calendar_today/week/create`
- **Notion**: `elio_notion_search/query/create_page`
- **Google Docs**: `elio_docs_get/create/append/search`
- **Google Sheets**: `elio_sheets_read/write/append`

### Research
- **Perplexity**: `elio_perplexity_search/research/factcheck`
- **LinkedIn**: `elio_linkedin_profile/search`

### Automation
- **n8n**: `elio_n8n_workflows/trigger/executions`
- **NotebookLM**: `elio_notebook_create/add_text/analyze`

### Database
- **Supabase**: `elio_database_*` tools
  - `runs_summary/list` - workflow tracking
  - `schedules_list/due/create` - scheduled tasks
  - `task_create/stats/active` - GTD tasks
  - `state_get/set` - key-value state
  - `health` - connection check

---

## Database Architecture

### Repository Pattern
```typescript
import { getDb } from 'mcp-server/src/db';

// Access repositories
const stats = await getDb().workflow.getStats();
const tasks = await getDb().task.getActive();

// With caching
const cached = await getDb().cache.getOrSet('key', fetchFn, ttlMs);
```

### Tables (Supabase)
- `workflow_runs` - execution history
- `scheduled_tasks` - cron/scheduled jobs
- `messages` - inbox from all sources
- `tasks` - GTD task management
- `people` - CRM contacts
- `system_state` - key-value store
- `audit_log` - security tracking

### Migrations
New schema changes go to `/mcp-server/migrations/`.
Run in Supabase SQL Editor.

---

## Core Principles

### 1. Unix Philosophy
- Each skill does one thing well
- Skills compose into workflows
- Clear inputs and outputs

### 2. Context Engineering
- Load only what's needed
- Keep context files small and focused
- Update context after interactions

### 3. Human-in-the-Loop
- Critical actions require confirmation
- Show context before suggesting actions
- Never send without approval

### 4. Self-Improvement
- Log corrections to `/logs/corrections/`
- Analyze patterns weekly
- Update rules based on patterns

---

## Communication Rules

Configure in `context/preferences.md`:
- How to address user
- Writing style preferences
- What to avoid
- Language preferences

Configure in `context/writing-style.md`:
- Email style examples
- Telegram/chat style
- Document formatting preferences

---

## Engineering Standards

### Code Quality
- TypeScript only (no plain JS)
- Max 200 lines per file
- Max 50 lines per function
- No `any` types
- Clear naming (no comments needed)

### Architecture
- One file = one responsibility
- Configs separate from logic
- Utils = pure functions
- Each module has clear interface

### Stack (2026)
- Runtime: Bun / Node 22+
- Testing: Vitest
- Validation: Zod
- HTTP: Hono

---

## Quick Reference

### Run Skill
```bash
# Read instructions first
cat /root/.claude/skills/{skill}/SKILL.md
# Then execute
```

### Run Workflow
```bash
# Read workflow steps
cat /root/.claude/workflows/{workflow}/WORKFLOW.md
# Execute step by step
```

### Add Context
```bash
# Create person profile
echo "# {Name}" > /root/.claude/context/people/{name}.md
# Create company profile
echo "# {Company}" > /root/.claude/context/companies/{company}.md
```

### Log Correction
```bash
improve log <type> "original" | "corrected"
# Types: factual, style, preference, technical, context, tone, format
```

---

## Versioning

### Rules
- Update `CHANGELOG.md` after significant changes
- Bump version in this file header
- Use semantic versioning (Major.Minor.Patch)

### When to Update
- **Major** - Breaking changes, architecture shifts
- **Minor** - New features, integrations, tables
- **Patch** - Bug fixes, small improvements

### Format
```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New feature description

### Changed
- What was modified

### Fixed
- Bug fixes
```

---

## ⚠️ CRITICAL: Agent Development Rules

**BEFORE creating any agent, READ:** `core/AGENT_STANDARDS.md`

### Key Rules (Summary)

1. **Progress Notifications ОБЯЗАТЕЛЬНЫ**
   - `notifyTelegram()` при старте, каждой стадии, завершении, ошибке
   - Пользователь ДОЛЖЕН видеть прогресс

2. **Verification ОБЯЗАТЕЛЬНА**
   - НИКОГДА не говорить "готово" без проверки
   - Последняя стадия = verification
   - Retry при неудаче

3. **Deliverable ОБЯЗАТЕЛЕН**
   - Вернуть конкретный URL или path
   - Notion > local files

4. **Logging ОБЯЗАТЕЛЕН**
   - `fileLogger` для всех операций
   - Логи в `/root/.claude/logs/`

5. **Rate Limiting ОБЯЗАТЕЛЕН**
   - `withRateLimit()` для внешних API
   - `withCircuitBreaker()` для защиты

### Nightly Consilium

Каждую ночь в 02:00 Tbilisi запускается консилиум:
- 3 модели (Claude, GPT-4, Groq) анализируют код
- Голосование по приоритетам
- Auto-fix безопасных изменений
- Отчёт в Telegram

Config: `config/schedules.json`
Workflow: `workflows/nightly-consilium/WORKFLOW.md`

---

## Server Info

Configure your server details here after deployment.
