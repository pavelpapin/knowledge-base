# Deep Research Agent Architecture

## Overview

Deep Research Agent - автономный multi-agent система для глубокого исследования тем. Вдохновлён Perplexity Deep Research, OpenAI DR, Gemini DR.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEEP RESEARCH ORCHESTRATOR                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Input: "Research topic X"                                          │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PLANNER AGENT                             │   │
│  │  - Разбивает тему на подзадачи                               │   │
│  │  - Определяет стратегию исследования                         │   │
│  │  - Создаёт план из 3-10 шагов                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  RETRIEVAL AGENTS (parallel)                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │   │
│  │  │ Web      │  │Perplexity│  │ YouTube  │  │ Academic │     │   │
│  │  │ Search   │  │ API      │  │Transcript│  │ Papers   │     │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  ANALYSIS AGENT                              │   │
│  │  - Извлекает ключевые факты                                  │   │
│  │  - Выявляет противоречия                                     │   │
│  │  - Создаёт структурированные заметки                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  SYNTHESIS AGENT                             │   │
│  │  - Объединяет findings из всех источников                    │   │
│  │  - Создаёт coherent narrative                                │   │
│  │  - Генерирует insights и выводы                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  VERIFICATION AGENT                          │   │
│  │  - Проверяет факты против источников                         │   │
│  │  - Валидирует citations                                      │   │
│  │  - Оценивает confidence                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                │                                                    │
│                ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  OUTPUT AGENTS (parallel)                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │   │
│  │  │ Notion   │  │ Markdown │  │ NotebookLM│ │ Slides   │     │   │
│  │  │ Export   │  │ Report   │  │ Podcast  │  │ PPT      │     │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Agents

### 1. Planner Agent
**Задача**: Разбить тему на исследуемые подтемы
**Input**: Topic string
**Output**: Research plan (JSON)

```json
{
  "topic": "AI Agents 2026",
  "depth": "deep",
  "subtopics": [
    "Current state of AI agents",
    "Key players (OpenAI, Anthropic, Google)",
    "Multi-agent architectures",
    "Use cases in enterprise",
    "Limitations and challenges"
  ],
  "questions": [
    "What are the main architectural patterns?",
    "Which companies are leading?",
    "What are real-world deployments?"
  ],
  "sources_strategy": ["web", "perplexity", "youtube", "arxiv"]
}
```

### 2. Retrieval Agents
Параллельно собирают информацию из разных источников:

| Agent | Source | Method |
|-------|--------|--------|
| Web Search | Google/Bing | Claude web_search tool |
| Perplexity | perplexity.ai | API (if available) or web |
| YouTube | youtube.com | yt-dlp transcripts |
| Academic | arxiv, Google Scholar | web_fetch + parsing |
| Social | Twitter/X, Reddit | web_fetch |

### 3. Analysis Agent
**Задача**: Извлечь структурированные данные
**Output**:
```json
{
  "key_facts": [...],
  "entities": [...],
  "contradictions": [...],
  "confidence_scores": {...}
}
```

### 4. Synthesis Agent
**Задача**: Создать coherent отчёт
**Output**: Markdown report with:
- Executive summary
- Key findings
- Detailed analysis
- Sources
- Confidence assessment

### 5. Verification Agent
**Задача**: Проверить факты
- Cross-reference claims
- Validate citations work
- Flag uncertain claims

### 6. Output Agents

#### Notion Export
- Create page in Notion
- Add structured content
- Link sources

#### Markdown Report
- Standard markdown file
- With TOC
- Embedded sources

#### NotebookLM Podcast
- Generate audio summary
- Export to NotebookLM format

#### Slides/PPT
- Key points as slides
- Executive summary format

## Implementation

### Phase 1: Core (MVP)
```
skills/deep-research/
├── skill.json
├── run.ts
├── agents/
│   ├── planner.ts
│   ├── retrieval.ts
│   ├── analysis.ts
│   └── synthesis.ts
└── outputs/
    ├── markdown.ts
    └── notion.ts
```

### Phase 2: Enhanced
- Add Perplexity API integration
- Add YouTube transcript agent
- Add verification agent

### Phase 3: Advanced
- NotebookLM integration
- Slides generation
- Scheduled research jobs

## Config

```json
{
  "default_depth": "medium",
  "max_sources": 20,
  "max_iterations": 5,
  "output_formats": ["markdown", "notion"],
  "connectors": {
    "perplexity": { "enabled": false, "api_key_env": "PERPLEXITY_API_KEY" },
    "notion": { "enabled": true, "api_key_env": "NOTION_API_KEY" }
  }
}
```

## Usage

```bash
# Quick research
elio research "AI Agents 2026" --depth quick

# Deep research with Notion output
elio research "Quantum Computing Applications" --depth deep --output notion

# Research from Telegram
/research AI Agents 2026
```

## Iteration Flow

```
1. User submits topic
2. Planner creates research plan
3. User approves/modifies plan (optional)
4. Retrieval agents gather data (parallel)
5. Analysis extracts structure
6. Synthesis creates report
7. Verification checks facts
8. Output exports to chosen format
9. User reviews
10. Iterate if needed
```

## Data Model

```typescript
interface ResearchJob {
  id: string;
  topic: string;
  depth: 'quick' | 'medium' | 'deep';
  status: 'planning' | 'retrieving' | 'analyzing' | 'synthesizing' | 'verifying' | 'done';
  plan: ResearchPlan;
  sources: Source[];
  findings: Finding[];
  report: string;
  outputs: OutputResult[];
  created_at: string;
  updated_at: string;
}

interface Source {
  url: string;
  title: string;
  type: 'web' | 'youtube' | 'paper' | 'social';
  content: string;
  retrieved_at: string;
  relevance_score: number;
}

interface Finding {
  claim: string;
  sources: string[];
  confidence: number;
  category: string;
}
```

## Sources

- [Perplexity Deep Research](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research)
- [Deep Research Agents: Systematic Examination](https://arxiv.org/html/2506.18096v2)
- [2026 AI Research Landscape](https://labs.adaline.ai/p/the-ai-research-landscape-in-2026)
