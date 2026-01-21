# Stage 7: Scientific Review

**Agent:** Scientific Advisor (External: OpenAI GPT-4o)
**Purpose:** Независимая проверка качества исследования

---

## Gate Condition

**Input:** Research Brief + Final Report (Notion URL)
**Output:** Review verdict (approved / needs_revision / rejected)

---

## Why External Model?

- Независимость от основного исполнителя
- Второе мнение от другой архитектуры
- Объективная оценка без bias

---

## Review Criteria

1. **Completeness** - Ответил ли отчёт на все вопросы из Brief?
2. **Accuracy** - Факты подтверждены источниками?
3. **Sources** - Качество и количество источников
4. **Actionability** - Можно ли действовать по отчёту?
5. **Structure** - Читаемость и организация

---

## Output

```json
{
  "score": 85,
  "verdict": "approved|needs_revision|rejected",
  "feedback": "общий комментарий",
  "scores": {
    "completeness": 90,
    "accuracy": 85,
    "sources": 80,
    "actionability": 85,
    "structure": 90
  },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "ready_for_publication": true
}
```

---

## Verdicts

### Approved (score ≥ 80)
- Отчёт готов к публикации
- Уведомить пользователя с URL

### Needs Revision (score 60-79)
- Вернуться к Stage 4 или Stage 5
- Исправить указанные weaknesses
- Повторить review (max 2 iterations)

### Rejected (score < 60)
- Уведомить пользователя о проблемах
- Предложить переформулировать задачу
- Или расширить scope

---

## ⛔ Self-Verification Questions

**ОБЯЗАТЕЛЬНО перед публикацией. Если любой ответ "нет" — доработать:**

1. **"Если бы я заплатил $500 за этот отчёт — я бы был доволен?"**

2. **"Могу ли я начать ДЕЙСТВОВАТЬ сегодня на основе этого?"**

3. **"Что в отчёте я НЕ мог бы найти за 10 минут в Google?"**

4. **"Ответил ли отчёт на ЦЕЛЬ из Discovery Brief?"**

5. **"Есть ли конкретные URLs, имена, контакты для next steps?"**

---

## Final Output

```
✅ Research Complete

Topic: {topic}
Notion: {url}
Score: {score}/100
Verified Facts: {count}
Sources: {count}

Ready for action.
```
