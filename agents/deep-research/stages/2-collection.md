# Stage 2: Data Collection

**Agents:** 5 специализированных агентов работают параллельно
**Purpose:** Собрать сырые данные из разных источников

---

## Gate Condition

**Input:** Research Plan с subtopics
**Output:** Данные от всех агентов

---

## Agents

### Web Scout Agent
- Ходит по сайтам, ищет первоисточники
- Tools: `elio_web_search`, `elio_perplexity_search`
- Focus: официальные сайты, пресс-релизы, документация

### Market Analyst Agent
- Рынок, конкуренты, размеры, тренды
- Tools: `elio_perplexity_search`
- Focus: TAM/SAM, market reports, funding data

### Tech Analyst Agent
- Архитектуры, инструменты, стек, ограничения
- Tools: `elio_web_search`, `elio_perplexity_search`
- Focus: technical docs, GitHub, architecture decisions

### Legal Analyst Agent
- Регуляции, риски, лицензии, налоги
- Tools: `elio_perplexity_search`
- Focus: compliance, legal requirements, restrictions

### People Analyst Agent
- Ключевые люди, эксперты, фаундеры, инвесторы
- Tools: `elio_person_research`, `elio_linkedin_search`
- Focus: founders, investors, domain experts

---

## Agent Output Format

```json
{
  "agent": "market_analyst",
  "facts": [
    {
      "statement": "Market size is $12.9B in 2024",
      "sources": ["https://full-url-1...", "https://full-url-2..."],
      "source_tier": 1,
      "date": "2024-12",
      "confidence": 0.92
    }
  ],
  "insights": ["Market is growing 40% YoY"],
  "raw_links": ["https://..."],
  "gaps": ["Could not find data on X"]
}
```

---

## Quality Check после Stage 2

- [ ] Каждый факт имеет прямой URL (не "market.us", а полный URL)
- [ ] Числа имеют год/дату
- [ ] Для каждой сущности минимум 3 data points
- [ ] Source tier указан для каждого факта

---

## Gate Check

Все 5 агентов вернули данные → переход к Stage 3
