# Skill: deep-research v2.0

## Purpose

Многоагентная система глубокого исследования темы с:
- **Reasoning**: What / So What / Now What для каждого факта
- **Devil's Advocate**: Критический анализ выводов
- **Action Plan**: Конкретные рекомендации
- **Consilium**: Multi-model верификация

## When to Use

- Конкурентный анализ рынка
- Исследование стартапов и раундов
- Анализ технологий и трендов
- Глубокое погружение в тему

## Inputs

- `topic` (required): Тема для исследования
- `goal` (optional): Цель исследования (competitive analysis, market research, etc.)
- `depth` (optional, default: "medium"):
  - `quick` - 3 подтемы, базовый анализ
  - `medium` - 5 подтем, стандартный анализ
  - `deep` - 7+ подтем, полный анализ с consilium
- `output` (optional, default: "markdown"):
  - `markdown` - MD файл
  - `notion` - страница в Notion
  - `json` - структурированные данные

## Architecture v2.0

```
┌─────────────────────────────────────────────────────────────┐
│                 DEEP RESEARCH ORCHESTRATOR                   │
├─────────────────────────────────────────────────────────────┤
│  1. Discovery Agent    → Уточняет тему и цель               │
│  2. Planner Agent      → Разбивает на подтемы               │
│  3. Retrieval Agents   → Сбор из web, RSS, YouTube          │
│  4. Analysis Agent     → Извлечение фактов с reasoning      │
│  5. Fact Check Agent   → Требует ≥2 источника               │
│  6. Synthesis Agent    → What / So What / Now What          │
│  7. Devil's Advocate   → Критика, слепые пятна, риски       │
│  8. Action Plan Agent  → Рекомендации и next steps          │
│  9. Consilium          → Multi-model верификация            │
│ 10. Report Editor      → Финальный отчет в Notion           │
└─────────────────────────────────────────────────────────────┘
```

## Sub-Skills

### Funding Detection Agent

Детектирует раунды финансирования из открытых источников.

**Источники:**
- GDELT API (новости)
- RSS фиды (TechCrunch, VentureBeat, Sifted, EU-Startups)
- PR Newswire, BusinessWire

**Pipeline:**
1. Сбор статей (GDELT + RSS)
2. Очистка и фильтрация
3. Семантическая классификация (LLM)
4. Structured extraction
5. Дедупликация событий
6. Enrichment (если confidence < 0.6)

**Output:**
```json
{
  "company_name": "Nevis",
  "round_type": "Series A",
  "amount": 35,
  "currency": "USD",
  "investors": ["Sequoia", "Ribbit Capital"],
  "lead_investor": "Sequoia",
  "announcement_date": "2025-12-15",
  "confidence_score": 0.85
}
```

**Принцип:** Детектируем СОБЫТИЯ, не строим базу. База — следствие, событие — сигнал.

## Report Structure v2

1. **Executive Summary** (≤300 слов)
   - Только verified факты (≥2 источника)
   - Главный вывод первым предложением

2. **Key Findings**
   ```
   ### Finding: [Title]
   | What | Факт |
   | So What | Почему важно |
   | Now What | Что делать |
   | Confidence | HIGH/MEDIUM/LOW |
   ```

3. **Action Plan**
   - Priority Matrix (Impact/Effort)
   - Конкретные рекомендации
   - Quick wins (сделать сегодня)

4. **Devil's Advocate**
   - Challenges к выводам
   - Blind spots
   - Risks с mitigation

5. **Consilium**
   - Model agreement %
   - Verified conclusions
   - Contested points

## Examples

### Конкурентный анализ
```bash
elio research "Vertical AI startups 2025" \
  --goal "competitive analysis" \
  --depth deep \
  --output notion
```

### Исследование раундов
```bash
elio funding-detect \
  --lookback 72h \
  --output jsonl
```

## Quality Checklist

- [ ] Executive summary: 0 unverified claims
- [ ] Every finding: ≥2 sources
- [ ] Action plan: ≥5 recommendations
- [ ] Devil's Advocate: included
- [ ] Consilium: ≥60% agreement
- [ ] No generic descriptions
- [ ] Clear answer to research question

## Anti-Patterns

❌ "Harvey uses AI for legal work" (generic)
✅ "Harvey's custom OpenAI model processes 50K+ docs/day for due diligence"

❌ "Harvey is the market leader" (unsupported)
✅ "Harvey raised the most ($510M), but revenue data not public"

❌ List of technologies (dump)
✅ Technologies that differentiate + why they matter

❌ Findings without action
✅ Every finding has "So What" and "Now What"

## Integrations

- `perplexity` - веб-поиск
- `youtube-transcript` - видео
- `notion` - экспорт отчетов
- `gdelt` - новости для funding detection
- `rss` - startup news feeds

## Logs

```
/root/.claude/logs/
├── research/           # Research reports
│   └── {topic}_{date}.md
├── funding/            # Funding events
│   └── events_{date}.jsonl
└── skills/deep-research/
    └── {run_id}.log
```
