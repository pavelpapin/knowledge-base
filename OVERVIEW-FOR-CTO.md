# Elio OS - Technical Overview for CTO

## What is it?

Elio OS - персональная AI Operating System с Claude (Opus 4.5) как "мозгом". Система оркестрирует skills, workflows и интеграции для автоматизации рутинных задач executive assistant.

---

## Architecture Philosophy

### Core Principles

1. **Unix Philosophy** - каждый компонент делает одну вещь хорошо
2. **Context Engineering** - правильная организация контекста для LLM (lazy loading, structured files)
3. **Composability** - атомарные skills комбинируются в workflows
4. **Human-in-the-Loop** - критические действия требуют подтверждения
5. **Self-Improvement** - система учится на коррекциях пользователя

### Tech Stack

| Layer | Technology |
|-------|------------|
| LLM | Claude Opus 4.5 (via Claude Code CLI) |
| Runtime | Node.js 22+ / Bun |
| Language | TypeScript (strict) |
| Protocol | MCP (Model Context Protocol) |
| Hosting | Ubuntu 24.04 VPS |
| Interface | Telegram Bot, CLI, Cursor IDE |

---

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Telegram │  │   CLI    │  │  Cursor  │                   │
│  │   Bot    │  │ (claude) │  │   IDE    │                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
└───────┼─────────────┼─────────────┼─────────────────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLAUDE (Opus 4.5)                        │
│                     ┌───────────────┐                        │
│                     │   CLAUDE.md   │  ◄── System prompt     │
│                     │   (core rules)│      + context         │
│                     └───────────────┘                        │
└─────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
│    CONTEXT    │   │    SKILLS     │   │    WORKFLOWS      │
│               │   │               │   │                   │
│ profile.md    │   │ web-search    │   │ telegram-inbox    │
│ preferences   │   │ deep-research │   │ email-inbox       │
│ philosophy    │   │ person-search │   │ meeting-prep      │
│ writing-style │   │ youtube-trans │   │ daily-review      │
│ people/       │   │               │   │ cold-outreach     │
│ companies/    │   │ Each has:     │   │                   │
│ projects/     │   │ - SKILL.md    │   │ Each has:         │
│               │   │ - Algorithm   │   │ - WORKFLOW.md     │
│               │   │ - I/O spec    │   │ - Step-by-step    │
└───────────────┘   └───────────────┘   └───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP INTEGRATIONS                          │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  Gmail  │ │Calendar │ │ Notion  │ │LinkedIn │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Telegram │ │  Slack  │ │ Sheets  │ │   n8n   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐                      │
│  │ G.Docs  │ │Perplexi │ │NotebookLM│                      │
│  └─────────┘ └─────────┘ └──────────┘                      │
│                                                              │
│  Total: 35+ MCP tools                                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     CORE SYSTEMS                             │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │     GTD     │  │   Context   │  │    Self-    │         │
│  │   System    │  │    Graph    │  │ Improvement │         │
│  │             │  │             │  │             │         │
│  │ - Inbox     │  │ - People    │  │ - Log corr. │         │
│  │ - Next      │  │ - Companies │  │ - Patterns  │         │
│  │ - Projects  │  │ - Relations │  │ - Suggest   │         │
│  │ - Waiting   │  │ - Notes     │  │   rules     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## What's Already Working

### MCP Integrations (35+ tools)

| Integration | Capabilities | Status |
|-------------|--------------|--------|
| **Gmail** | List, read, send, search emails | Ready |
| **Google Calendar** | View today/week, create events | Ready |
| **Google Docs** | Create, read, edit, search docs | Ready |
| **Google Sheets** | Read, write, append, batch ops | Ready |
| **Notion** | Search, query DBs, create pages | Ready |
| **LinkedIn** | Profile lookup, people search | Ready (via Proxycurl) |
| **Perplexity** | AI search, research, fact-check | Ready |
| **Telegram** | Send messages, notifications | Ready |
| **Slack** | Messages, channels, search | Ready |
| **n8n** | List workflows, trigger webhooks | Ready |
| **NotebookLM** | Local notebook management | Ready |

### Skills (Atomic Operations)

| Skill | What it does | Implementation |
|-------|--------------|----------------|
| `web-search` | Search via Perplexity/WebSearch | SKILL.md + integration |
| `deep-research` | Multi-agent research with planning, retrieval, analysis, synthesis | TypeScript, 5 agents |
| `person-research` | OSINT - gather public info about a person | SKILL.md + integrations |
| `youtube-transcript` | Download and process video transcripts | yt-dlp based |

### Workflows (Multi-step Processes)

| Workflow | Steps | Human Review |
|----------|-------|--------------|
| `telegram-inbox` | Get messages → Find context → Draft reply → Approve → Send → Log | Yes, before send |
| `email-inbox` | Fetch → Triage → Prioritize → Draft responses → Approve → Send | Yes, before send |
| `meeting-prep` | Get event → Research participants → Gather history → Generate prep doc | Optional |
| `daily-review` | Calendar + Tasks + Inbox status + Focus suggestion | Display only |
| `cold-outreach` | Research person → Research company → Find angle → Draft → Approve → Send | Yes, before send |

### Core Systems

| System | Purpose | Storage |
|--------|---------|---------|
| **GTD** | Task management (inbox, next, waiting, projects) | TypeScript CLI, JSON |
| **Context Graph** | Knowledge graph of people/companies/relations | TypeScript, JSON |
| **Self-Improvement** | Log corrections, detect patterns, suggest rules | TypeScript, JSONL |
| **Headless Mode** | Autonomous task execution, scheduling | TypeScript |

### Context Management

| File | Purpose |
|------|---------|
| `context/profile.md` | Basic info, languages, location |
| `context/preferences.md` | Communication style, work preferences |
| `context/philosophy.md` | Goals, values, decision framework |
| `context/writing-style.md` | Examples by channel (email, telegram, docs) |
| `context/people/{name}.md` | Individual profiles |
| `context/companies/{name}.md` | Company profiles |

---

## Data Flow Example: Telegram Inbox

```
1. User: "обработай телеграм"

2. Claude reads: workflows/telegram-inbox/WORKFLOW.md

3. Step 1: Get messages
   └── MCP: elio_telegram_getUpdates
   └── Returns: [{from: "John", text: "..."}]

4. Step 2: Find context
   └── Check: context/people/john.md (if exists)
   └── If not: Run person-research skill
   └── Search: Calendar (recent meetings), Gmail (threads)

5. Step 3: Draft reply
   └── Load: context/writing-style.md (Telegram style)
   └── Generate personalized response

6. Step 4: Human review
   └── Display: message + context + draft
   └── Options: [Send] [Edit] [Skip]

7. Step 5: Send (if approved)
   └── MCP: elio_telegram_send

8. Step 6: Update context
   └── Log interaction
   └── Update context/people/john.md (last_interaction)
```

---

## Security Model

| Aspect | Implementation |
|--------|----------------|
| Credentials | Stored in `/root/.claude/secrets/` (gitignored) |
| API Access | OAuth2 for Google, Bot tokens for Telegram/Slack |
| Human Review | Required for all outgoing communications |
| Audit Log | All actions logged to `/logs/` |

---

## Deployment

```bash
# Server
IP: 167.99.210.229
OS: Ubuntu 24.04

# Services
systemctl status elio-bot    # Telegram bot
journalctl -u elio-bot -f    # Logs

# MCP Server
cd /root/.claude/mcp-server && npm run build && node dist/index.js
```

---

## What's Next (Roadmap)

### Short-term
- [ ] Connect real Telegram bot to workflows
- [ ] Implement scheduled triggers (cron)
- [ ] Add more context/people/ profiles
- [ ] Create context/companies/nebius-academy.md

### Medium-term
- [ ] Voice interface (Whisper + TTS)
- [ ] Mobile app (React Native)
- [ ] Multi-user support
- [ ] Workflow builder UI

### Long-term
- [ ] Autonomous mode (minimal human review for trusted actions)
- [ ] Learning from interactions (fine-tuning prompts)
- [ ] Integration marketplace

---

## Key Metrics

| Metric | Value |
|--------|-------|
| MCP Tools | 35+ |
| Skills | 4 |
| Workflows | 5 |
| Context Files | 4 core + extensible |
| Lines of Code | ~5000 TypeScript |

---

## Why This Architecture?

1. **Modular** - Add new skills/workflows without touching core
2. **Transparent** - Every step is documented in .md files
3. **Debuggable** - Clear data flow, comprehensive logging
4. **Scalable** - Lazy loading prevents context bloat
5. **Human-centric** - AI assists, human decides

---

*Built with Claude Code + MCP Protocol*
*Architecture inspired by cybOS (Stepan Gershuni)*
