# Elio OS

AI Operating System with Claude (Opus 4.5) as the brain.

## What is it?

Personal AI assistant that orchestrates skills, workflows, and integrations to automate executive assistant tasks.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE (Opus 4.5)                     │
│                      + CLAUDE.md                         │
└─────────────────────────────────────────────────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐        ┌──────────┐       ┌───────────┐
   │ CONTEXT │        │  SKILLS  │       │ WORKFLOWS │
   │         │        │          │       │           │
   │ profile │        │ web-srch │       │ tg-inbox  │
   │ prefs   │        │ research │       │ email     │
   │ style   │        │ person   │       │ meeting   │
   │ people/ │        │ youtube  │       │ outreach  │
   └─────────┘        └──────────┘       └───────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │    MCP INTEGRATIONS     │
              │                         │
              │ Gmail  Calendar  Notion │
              │ Telegram  Slack  Sheets │
              │ LinkedIn  Perplexity    │
              │ n8n  Docs  NotebookLM   │
              └─────────────────────────┘
```

## Key Features

- **Skills**: Atomic operations (web search, deep research, person OSINT, youtube transcripts)
- **Workflows**: Multi-step processes with human-in-the-loop (telegram inbox, email triage, meeting prep)
- **35+ MCP Tools**: Gmail, Calendar, Notion, LinkedIn, Perplexity, Telegram, Slack, Sheets, n8n, Docs
- **Context Management**: Lazy-loaded user profile, preferences, writing style, people/company profiles
- **Self-Improvement**: Logs corrections, detects patterns, suggests rule updates

## Quick Start

```bash
# Clone
git clone <your-repo-url>
cd elio-os

# Install dependencies
cd mcp-server && npm install && npm run build

# Configure secrets
cp secrets/example.json secrets/google-token.json
# Add your API keys

# Create context files from templates
cp context/_templates/* context/

# Run MCP server
node dist/index.js
```

## Structure

```
├── CLAUDE.md           # System prompt and rules
├── ARCHITECTURE.md     # Detailed architecture
├── OVERVIEW-FOR-CTO.md # Technical overview
│
├── context/            # User context files
├── skills/             # Atomic skills with SKILL.md
├── workflows/          # Multi-step workflows
├── mcp-server/         # MCP integrations
│
├── gtd/                # GTD task management
├── context-graph/      # Knowledge graph
├── self-improvement/   # Correction tracking
└── headless/           # Autonomous execution
```

## Metrics

| Metric | Value |
|--------|-------|
| Source Files | 103 |
| Lines of Code | 12,360 |
| MCP Tools | 35+ |
| Skills | 4 |
| Workflows | 5 |
| Integrations | 11 |

## Documentation

- [CLAUDE.md](CLAUDE.md) - System rules and quick reference
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture design
- [OVERVIEW-FOR-CTO.md](OVERVIEW-FOR-CTO.md) - Technical overview for stakeholders

## Tech Stack

- **LLM**: Claude Opus 4.5
- **Protocol**: MCP (Model Context Protocol)
- **Runtime**: Node.js 22+ / Bun
- **Language**: TypeScript

## License

Private / Personal Use

---

Built with Claude Code + MCP Protocol
