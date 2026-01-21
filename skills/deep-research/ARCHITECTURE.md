# Deep Research Agent Architecture v2.0

## Overview

Deep Research Agent - автономная multi-agent система для глубокого исследования с reasoning, критическим анализом и actionable выводами.

**Ключевые улучшения v2:**
- Devil's Advocate Agent для критического анализа
- Action Plan Agent для конкретных рекомендаций
- Consilium (multi-model) для верификации
- Reasoning Layer во всех findings

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DEEP RESEARCH ORCHESTRATOR v2.0                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: "Research topic X" + context (purpose, audience)                     │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    1. DISCOVERY AGENT                                  │  │
│  │  - Уточняет тему через вопросы                                        │  │
│  │  - Определяет цель (competitive analysis, market research, etc.)      │  │
│  │  - Идентифицирует ключевые аспекты                                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    2. PLANNER AGENT                                    │  │
│  │  - Разбивает на подтемы с приоритетами                                │  │
│  │  - Создаёт research questions (не generic)                            │  │
│  │  - Определяет source strategy                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               3. RETRIEVAL AGENTS (parallel, 5 types)                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │ Web      │  │Perplexity│  │ YouTube  │  │ News     │  │ Expert  │ │  │
│  │  │ Research │  │ Deep     │  │Transcript│  │ Sources  │  │ Sources │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               4. ANALYSIS AGENT (with reasoning)                       │  │
│  │  - Извлекает факты + WHY they matter                                  │  │
│  │  - Categorizes по relevance to goal                                   │  │
│  │  - Identifies patterns and connections                                │  │
│  │  - Flags contradictions                                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               5. FACT CHECK AGENT                                      │  │
│  │  - Каждый факт требует ≥2 источника                                   │  │
│  │  - Cross-validates claims                                             │  │
│  │  - Marks unverified as "needs verification"                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               6. SYNTHESIS AGENT (structured)                          │  │
│  │  - Creates narrative with clear structure                             │  │
│  │  - Для каждого факта: WHAT + SO WHAT + NOW WHAT                       │  │
│  │  - Groups by themes, not by sources                                   │  │
│  │  - Removes redundant/irrelevant info                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │        7. DEVIL'S ADVOCATE AGENT (NEW in v2)                           │  │
│  │  - Challenges every conclusion                                        │  │
│  │  - Identifies risks and blind spots                                   │  │
│  │  - Provides counter-arguments                                         │  │
│  │  - Questions assumptions                                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │        8. ACTION PLAN AGENT (NEW in v2)                                │  │
│  │  - Creates specific, actionable recommendations                       │  │
│  │  - Prioritizes by impact/effort matrix                                │  │
│  │  - Includes next steps with owners (if applicable)                    │  │
│  │  - Defines success metrics                                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │        9. CONSILIUM (multi-model verification) (NEW in v2)             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                             │  │
│  │  │ Claude   │  │ GPT-4    │  │ Gemini   │  → Vote on conclusions      │  │
│  │  │ Review   │  │ Review   │  │ Review   │  → Consensus required       │  │
│  │  └──────────┘  └──────────┘  └──────────┘                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                │                                                             │
│                ▼                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               10. REPORT EDITOR                                        │  │
│  │  - Formats final report                                               │  │
│  │  - Adds executive summary (verified facts only!)                      │  │
│  │  - Creates Notion/Markdown output                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## New Agents in v2

### 7. Devil's Advocate Agent

**Purpose**: Challenge conclusions, find blind spots, question assumptions.

**Input**: Synthesis report + findings

**Output**:
```json
{
  "challenges": [
    {
      "conclusion": "Harvey is the leader in Legal AI",
      "challenge": "Leadership based on funding, not revenue. Actual usage data unavailable.",
      "risk": "Overestimating market position based on PR",
      "alternative_view": "Multiple players may have similar actual traction"
    }
  ],
  "blind_spots": [
    "No analysis of Asian market players",
    "Missing regulatory risk assessment"
  ],
  "assumptions_questioned": [
    {
      "assumption": "Vertical AI is more defensible",
      "counter": "Horizontal players can add vertical features faster"
    }
  ],
  "risks": [
    {
      "risk": "Market timing - too early for enterprise AI adoption",
      "probability": "medium",
      "impact": "high"
    }
  ]
}
```

### 8. Action Plan Agent

**Purpose**: Convert findings into concrete, actionable recommendations.

**Input**: Synthesis + Devil's Advocate output + research goal

**Output**:
```json
{
  "recommendations": [
    {
      "priority": 1,
      "action": "Deep dive on Harvey's actual customer retention",
      "rationale": "They claim 700 firms but no NRR data available",
      "effort": "low",
      "impact": "high",
      "next_steps": [
        "Find Harvey customer interviews",
        "Check Glassdoor for employee insights",
        "Search for churn data in news"
      ],
      "success_metric": "Get actual usage/retention data",
      "owner": "researcher"
    }
  ],
  "key_decisions": [
    {
      "decision": "Which vertical to focus on?",
      "options": ["Legal (crowded)", "Wealth Management (emerging)", "Insurance (underserved)"],
      "recommendation": "Wealth Management - Nevis pattern shows opportunity",
      "reasoning": "Less competition, Sequoia backing validates, ex-Revolut team shows fintech DNA"
    }
  ],
  "quick_wins": [
    "Subscribe to Harvey/Nevis newsletters for updates",
    "Set up Google Alerts for vertical AI funding"
  ]
}
```

### 9. Consilium (Multi-Model Verification)

**Purpose**: Use multiple AI models to validate conclusions.

**Process**:
1. Send executive summary + key conclusions to 3 models
2. Each model rates confidence (1-10) and flags issues
3. Only conclusions with 2/3+ agreement go to final report
4. Disagreements are noted in "Contested Points" section

**Output**:
```json
{
  "verified_conclusions": [
    {
      "conclusion": "Harvey raised $510M+ and targets $100M ARR",
      "votes": { "claude": 9, "gpt4": 8, "gemini": 9 },
      "consensus": "high"
    }
  ],
  "contested_points": [
    {
      "claim": "Vertical AI is more defensible than horizontal",
      "votes": { "claude": 7, "gpt4": 4, "gemini": 6 },
      "disagreement": "GPT-4 notes horizontal players can pivot faster"
    }
  ]
}
```

## Report Structure v2

### Required Sections

1. **Executive Summary** (≤300 words)
   - Only verified facts (2+ sources)
   - Key conclusion in first sentence
   - 3-5 bullet points max

2. **Key Findings** (structured)
   ```
   ### Finding: [Title]

   **What**: [Fact]
   **So What**: [Why it matters for your goal]
   **Now What**: [Action to take]
   **Sources**: [Links]
   **Confidence**: [High/Medium/Low based on consilium]
   ```

3. **Competitive Landscape** (if applicable)
   - Clear comparison table
   - Strengths/weaknesses
   - No fluff descriptions

4. **Action Plan**
   - Prioritized recommendations
   - Effort/Impact matrix
   - Clear next steps

5. **Risks & Challenges**
   - Devil's Advocate findings
   - Blind spots acknowledged
   - Contested points

6. **Appendix**
   - Full source list
   - Methodology notes
   - Unverified claims (marked clearly)

## Anti-Patterns (What NOT to do)

1. **No generic descriptions**
   - BAD: "Harvey uses AI for legal work"
   - GOOD: "Harvey's custom OpenAI model processes 50K+ documents/day for due diligence"

2. **No unsupported claims**
   - BAD: "Harvey is the market leader"
   - GOOD: "Harvey raised the most funding ($510M), though revenue data is not public"

3. **No technology dumps**
   - BAD: List of all technologies a company uses
   - GOOD: Technologies that differentiate them + why they matter

4. **No missing context**
   - BAD: "$40M funding"
   - GOOD: "$40M Series A (Dec 2025), 10x previous round, Sequoia lead"

5. **No action-free findings**
   - Every finding must have "So What" and "Now What"

## Quality Checklist

Before marking research complete:

- [ ] Executive summary has 0 unverified claims
- [ ] Every finding has ≥2 sources
- [ ] Action plan has ≥5 specific recommendations
- [ ] Devil's Advocate section included
- [ ] Contested points documented
- [ ] No generic/fluffy descriptions
- [ ] Clear answer to original research question
- [ ] Notion page created and verified

## Configuration

```json
{
  "default_depth": "medium",
  "max_sources": 30,
  "consilium_enabled": true,
  "consilium_models": ["claude", "gpt-4", "gemini"],
  "min_sources_per_fact": 2,
  "devils_advocate_enabled": true,
  "action_plan_required": true,
  "report_sections": {
    "executive_summary": { "max_words": 300, "verified_only": true },
    "findings": { "format": "what_so_what_now_what" },
    "risks": { "required": true }
  }
}
```

## Implementation Status

- [x] Discovery Agent (basic)
- [x] Planner Agent
- [x] Retrieval Agents (web, youtube)
- [x] Analysis Agent (basic)
- [x] Fact Check Agent (basic)
- [x] Synthesis Agent
- [ ] Devil's Advocate Agent ← **NEW**
- [ ] Action Plan Agent ← **NEW**
- [ ] Consilium Integration ← **NEW**
- [x] Notion Export
- [x] Markdown Export

## Sources

- [Perplexity Deep Research](https://www.perplexity.ai/hub/blog/introducing-perplexity-deep-research)
- [Deep Research Agents: Systematic Examination](https://arxiv.org/html/2506.18096v2)
- Internal: Nightly Consilium pattern from `/mcp-server/src/skills/nightly-consilium.ts`
