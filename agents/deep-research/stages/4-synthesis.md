# Stage 4: Synthesis

**Agent:** Synthesizer Agent
**Purpose:** Собрать единую картину, сформировать выводы

---

## Gate Condition

**Input:** Verified facts (Stage 3)
**Output:** Key findings, scenarios, recommendations, decision framework

---

## Pre-Synthesis: Context Integration

**⛔ ОБЯЗАТЕЛЬНО перед синтезом перечитать Discovery Brief:**

1. Какой опыт/экспертиза у пользователя? → Учесть в рекомендациях
2. Какие ресурсы (время, деньги, команда)? → Фильтровать нереалистичные опции
3. Какой timeline? → Приоритизировать quick wins vs long-term
4. Что пользователь УЖЕ знает? → Не повторять очевидное

---

## Actions

1. Работать ТОЛЬКО с verified data
2. Применить "So What?" test к каждому факту
3. Построить логическую модель
4. Сформировать выводы и сценарии
5. Создать Decision Framework
6. Написать actionable recommendations

---

## "So What?" Test

Применять к КАЖДОМУ факту:

❌ "Рынок vertical AI = $12.9B"
✅ "Рынок vertical AI = $12.9B, но 60% = healthcare + legal где уже гиганты. Оставшиеся 40% (~$5B) = возможность."

**Правило:** Если факт не ведёт к действию или решению — не включать.

---

## Concrete Examples Rule

Каждое утверждение ДОЛЖНО иметь пример:

❌ "Point solution быстрее выходит на рынок"
✅ "Point solution быстрее выходит на рынок. Пример: EvenUp начал с одной фичи и за 2 года достиг $50M ARR"

**Если нет примера — пометить как hypothesis.**

---

## Output

```json
{
  "key_findings": [
    {
      "finding": "...",
      "evidence": ["fact1", "fact2"],
      "implication": "что это значит для пользователя"
    }
  ],
  "scenarios": [
    {"name": "Optimistic", "conditions": [...], "outcome": "..."},
    {"name": "Base case", "conditions": [...], "outcome": "..."},
    {"name": "Pessimistic", "conditions": [...], "outcome": "..."}
  ],
  "recommendations": [
    {
      "recommendation": "...",
      "first_step": "конкретное действие на завтра",
      "resources": ["url1", "url2"]
    }
  ],
  "decision_framework": {
    "criteria": [...],
    "weights": {...},
    "how_to_use": "..."
  }
}
```

---

## Quality Check после Stage 4

- [ ] Каждая рекомендация отвечает на "что делать ЗАВТРА"
- [ ] Нет generic фраз без конкретики
- [ ] Framework привязан к контексту пользователя
- [ ] Каждый вывод подкреплён примером

---

## Gate Check

Synthesis готов (key_findings + recommendations) → переход к Stage 5
