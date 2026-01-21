# Stage 1: Research Planning

**Agent:** Task Planner Agent
**Purpose:** Разбить исследование на задачи

---

## Gate Condition

**Input:** Research Brief (confirmed)
**Output:** Research Plan с subtopics и quality criteria

---

## Actions

1. Проанализировать Research Brief
2. Определить subtopics для исследования
3. Выбрать какие агенты нужны
4. Установить quality criteria

---

## Output: Research Plan

```json
{
  "research_id": "research_2026_01_{topic_slug}",
  "stages": [
    {"id": "data_collection", "agents": ["web_scout", "market", "tech", "legal", "people"]},
    {"id": "fact_check"},
    {"id": "synthesis"},
    {"id": "devils_advocate"},
    {"id": "report"}
  ],
  "subtopics": [
    "Subtopic 1",
    "Subtopic 2",
    "Subtopic 3",
    "..."
  ],
  "quality_criteria": [
    "2_sources_per_fact",
    "no_unverified_in_exec_summary",
    "actionable_recommendations"
  ],
  "estimated_time": "45 min"
}
```

---

## Subtopics Guidelines

Количество subtopics зависит от `detail_level` из Brief:
- **Широкий обзор:** 7-10 subtopics, поверхностно
- **Глубокий анализ:** 3-5 subtopics, детально
- **Баланс:** 5-7 subtopics, средняя глубина

---

## Gate Check

Research Plan создан → переход к Stage 2
