# Elio OS - Technical Overview for CTO

**Version:** 3.2.0
**Updated:** 2026-01-21

## What is it?

Elio OS — персональная AI Operating System с Claude (Opus 4.5) как "мозгом". Система оркестрирует skills, workflows и интеграции для автоматизации задач executive assistant. Включает AI Team (CTO, CPO, CEO) которая автономно работает ночью.

---

## Architecture Philosophy

### Core Principles

1. **Unix Philosophy** — каждый компонент делает одну вещь хорошо
2. **Context Engineering** — lazy loading, structured files для LLM
3. **Composability** — атомарные skills комбинируются в workflows
4. **Human-in-the-Loop** — критические действия требуют подтверждения
5. **Self-Improvement** — система учится на коррекциях пользователя
6. **Chain of Responsibility** — агенты читают output друг друга

### Tech Stack

| Layer | Technology |
|-------|------------|
| LLM | Claude Opus 4.5 (via Claude Code CLI) |
| Runtime | Bun / Node.js 22+ |
| Language | TypeScript (strict) |
| Protocol | MCP (Model Context Protocol) |
| Database | Supabase (PostgreSQL) |
| Queue | Redis + BullMQ |
| Hosting | Ubuntu 24.04 VPS |
| Interface | Telegram Bot, CLI, Cursor IDE |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Telegram │  │   CLI    │  │  Cursor  │  │  Cron    │        │
│  │   Bot    │  │ (claude) │  │   IDE    │  │  Jobs    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SYSTEM LOOP (Orchestration)                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Hourly: Check schedules → Spawn agents → Track state     │   │
│  │ Sources: team/config.json, config/schedules.json, DB     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
│   AI TEAM     │   │    SKILLS     │   │    WORKFLOWS      │
│               │   │               │   │                   │
│ ┌───────────┐ │   │ web-search    │   │ telegram-inbox    │
│ │    CTO    │ │   │ deep-research │   │ email-inbox       │
│ │  00:30    │ │   │ person-search │   │ meeting-prep      │
│ └───────────┘ │   │ code-review   │   │ day-review        │
│ ┌───────────┐ │   │ system-review │   │ consilium         │
│ │    CPO    │ │   │ youtube-trans │   │ cold-outreach     │
│ │  01:00    │ │   │               │   │                   │
│ └───────────┘ │   │ Each has:     │   │ Each has:         │
│ ┌───────────┐ │   │ - SKILL.md    │   │ - WORKFLOW.md     │
│ │    CEO    │ │   │ - Algorithm   │   │ - Step-by-step    │
│ │  01:30    │ │   │ - I/O spec    │   │ - Human review    │
│ └───────────┘ │   │               │   │   points          │
└───────────────┘   └───────────────┘   └───────────────────┘
        │                   │                    │
        └───────────────────┼────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP SERVER (Gateway)                          │
│                                                                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Gmail  │ │Calendar │ │ Notion  │ │LinkedIn │ │Perplexi │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │Telegram │ │  Slack  │ │ Sheets  │ │  Docs   │ │   n8n   │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ Backlog │ │Database │ │ Agents  │ │Webscrape│               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                  │
│  16 Adapters │ 50+ MCP Tools │ Repository Pattern               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Supabase   │  │    Redis    │  │  Local FS   │             │
│  │  (Postgres) │  │   (Queue)   │  │   (Logs)    │             │
│  │             │  │             │  │             │             │
│  │ - backlog   │  │ - BullMQ    │  │ /logs/      │             │
│  │ - tasks     │  │ - Cache     │  │ /state/     │             │
│  │ - messages  │  │ - Pub/Sub   │  │ /context/   │             │
│  │ - workflow  │  │             │  │             │             │
│  │ - people    │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Nightly Cycle (AI Team)

Каждую ночь система автоматически запускает цепочку агентов:

```
00:00  Day Review     ─┐
       (скрипт)        │ Собирает: errors, git, conversations, metrics
                       │ Output: /logs/daily/{date}/day-summary.json
                       ▼
00:30  CTO            ─┐
       (agent)         │ Читает: day-summary.json
                       │ Делает: health check, code review, security scan
                       │ Решает: нужен ли consilium (multi-model review)?
                       │ Auto-fix: lint, types, small issues
                       │ Output: /logs/team/cto/{date}.md + Notion
                       ▼
01:00  CPO            ─┐
       (agent)         │ Читает: day-summary.json + CTO report
                       │ Делает: quality analysis, feedback review
                       │ Output: /logs/team/cpo/{date}.md + Notion
                       ▼
01:30  CEO            ─┐
       (agent)         │ Читает: CTO + CPO reports
                       │ Делает: strategic decisions, task assignment
                       │ Режет: scope, zombie tasks
                       │ Output: /logs/team/ceo/{date}.md + Notion
                       ▼
08:00  Standup         │ Consolidated summary → Telegram
```

### Chain Reading

Каждый агент читает output предыдущих:
- **CTO** ← day-summary.json
- **CPO** ← day-summary.json + CTO report
- **CEO** ← CTO report + CPO report + backlogs

---

## MCP Integrations

### Adapters (16)

| Adapter | Tools | Purpose |
|---------|-------|---------|
| **gmail** | list, read, send, search | Email management |
| **calendar** | today, week, create | Schedule management |
| **notion** | search, query, create_page | Knowledge base |
| **telegram** | send, notify | Notifications |
| **slack** | send, channels, history | Team communication |
| **sheets** | read, write, append | Data storage |
| **docs** | get, create, append | Document management |
| **linkedin** | profile, search | Professional network |
| **perplexity** | search, research, factcheck | AI-powered search |
| **n8n** | workflows, trigger | Automation |
| **notebooklm** | create, analyze | Research notebooks |
| **database** | workflow, schedule, task, state | Supabase access |
| **backlog** | create, list, update, complete, stats | Task management |
| **agents** | start, status, stop | Agent orchestration |
| **webscraping** | jina_reader | Web content extraction |
| **sql** | query | Direct SQL access |

### Database Tables

| Table | Purpose |
|-------|---------|
| `backlog_items` | CTO/CPO task backlog with Notion sync |
| `workflow_runs` | Execution history |
| `scheduled_tasks` | Cron-style schedules |
| `messages` | Inbox from all sources |
| `tasks` | GTD task management |
| `people` | CRM contacts |
| `system_state` | Key-value store |
| `audit_log` | Security tracking |

---

## Skills

| Skill | Purpose | Implementation |
|-------|---------|----------------|
| `web-search` | Search via Perplexity/WebSearch | SKILL.md + MCP |
| `deep-research` | Multi-agent research pipeline | TypeScript, 7+ stages |
| `person-research` | OSINT on people | SKILL.md + LinkedIn/web |
| `code-review` | Architecture and quality audit | TypeScript + AST |
| `system-review` | System health check | SKILL.md |
| `youtube-transcript` | Video transcript extraction | yt-dlp based |
| `auto-test` | Generate tests for code | TypeScript |

---

## Workflows

| Workflow | Stages | Human Review |
|----------|--------|--------------|
| `telegram-inbox` | Get → Context → Draft → Approve → Send | Yes |
| `email-inbox` | Fetch → Triage → Draft → Approve → Send | Yes |
| `meeting-prep` | Event → Research → History → Prep doc | Optional |
| `day-review` | Collect errors, git, conversations, metrics | No |
| `consilium` | Multi-model code review + voting | Auto |
| `cold-outreach` | Research → Angle → Draft → Approve | Yes |

---

## Scripts

| Script | Purpose | Trigger |
|--------|---------|---------|
| `system-loop.ts` | Universal orchestration | Hourly cron |
| `day-review.ts` | Data collection | 00:00 daily |
| `consilium.ts` | Multi-model review | CTO decision |
| `extract-conversations.ts` | Session log extraction | Day review |

---

## File Structure

```
/root/.claude/
├── CLAUDE.md              # Core rules (always loaded)
├── OVERVIEW-FOR-CTO.md    # This file
├── ARCHITECTURE.md        # Detailed architecture
│
├── team/                  # AI Team Members
│   ├── config.json        # Schedule & permissions
│   ├── cto/ROLE.md        # CTO role definition
│   ├── cpo/ROLE.md        # CPO role definition
│   └── ceo/ROLE.md        # CEO role definition
│
├── scripts/               # Orchestration scripts
│   ├── system-loop.ts     # Main orchestrator
│   ├── day-review.ts      # Data collector
│   └── consilium.ts       # Multi-model review
│
├── mcp-server/            # MCP Gateway
│   ├── src/adapters/      # 16 integration adapters
│   ├── src/db/            # Repository pattern
│   └── migrations/        # SQL migrations
│
├── skills/                # Atomic operations (8)
├── workflows/             # Multi-step processes (9)
├── agents/                # Complex agents
│   └── deep-research/     # Research pipeline
│
├── context/               # User context (lazy loaded)
│   ├── profile.md
│   ├── preferences.md
│   ├── philosophy.md
│   └── writing-style.md
│
├── config/                # System configuration
│   └── schedules.json     # Workflow schedules
│
├── logs/                  # Execution logs
│   ├── daily/             # Day summaries
│   ├── team/              # Team reports
│   └── errors/            # Error logs
│
├── state/                 # Runtime state
│   └── system-loop-state.json
│
└── secrets/               # Credentials (gitignored)
```

---

## Security Model

| Aspect | Implementation |
|--------|----------------|
| Credentials | `/secrets/` directory (gitignored) |
| API Access | OAuth2 (Google), Bot tokens, API keys |
| Human Review | Required for outgoing communications |
| Audit Log | All actions logged to database |
| Permissions | Role-based (CTO can code, CPO can docs) |

---

## Deployment

```bash
# Server
OS: Ubuntu 24.04 VPS
Services: Redis, PostgreSQL (Supabase)

# Cron (hourly orchestration)
0 * * * * /root/.claude/scripts/system-loop.sh

# MCP Server
cd mcp-server && bun run build && bun run start

# Check status
redis-cli ping
curl $SUPABASE_URL/rest/v1/
```

---

## Key Metrics

| Metric | Value |
|--------|-------|
| TypeScript Files | 5,350+ |
| Lines of Code | 149,000+ (MCP server) |
| MCP Adapters | 16 |
| MCP Tools | 50+ |
| Skills | 8 |
| Workflows | 9 |
| AI Team Members | 3 (CTO, CPO, CEO) |
| Database Tables | 8 |

---

## What's New (v3.2.0)

### Added
- **AI Team** — CTO, CPO, CEO agents with nightly schedule
- **System Loop** — Universal hourly orchestration
- **Day Review** — Automated data collection (errors, git, conversations)
- **Chain Reading** — Agents read each other's output
- **Backlog System** — Database-backed with Notion sync
- **Consilium** — Multi-model code review (CTO-triggered)
- **Conversation Logger** — Extract user messages from sessions

### Architecture Changes
- Moved from standalone cron jobs to unified System Loop
- Added collectors concept (run before agents)
- Implemented chain of responsibility pattern
- Database-first backlog management

---

## Roadmap

### Short-term
- [ ] Voice interface (Whisper + TTS)
- [ ] Eval sets infrastructure
- [ ] Dashboard for metrics

### Medium-term
- [ ] Mobile app
- [ ] Multi-user support
- [ ] Workflow builder UI

### Long-term
- [ ] Autonomous mode
- [ ] Fine-tuning on interactions
- [ ] Integration marketplace

---

*Built with Claude Code + MCP Protocol*
*Architecture inspired by cybOS (Stepan Gershuni)*
