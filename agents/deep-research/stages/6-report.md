# Stage 6: Final Report

**Agent:** Report Editor Agent
**Purpose:** Оформить финальный отчет в Notion

---

## Gate Condition

**Input:** Synthesis + Devil's Advocate output
**Output:** Notion page URL

---

## Actions

1. Создать Notion page по шаблону
2. Структурировать контент
3. Применить Anti-Fluff checklist
4. Добавить все источники с URLs
5. Сделать readable и actionable

---

## Notion Page Structure

1. **Executive Summary** (3-5 предложений)
   - Только verified facts
   - Только Tier 1-2 источники
   - Ключевой вывод + рекомендация

2. **Ключевые выводы**
   - Bullet points
   - Каждый с источником
   - "So What?" для каждого

3. **Карта рынка/области**
   - Визуальная структура (таблица или список)
   - Конкуренты, игроки, сегменты

4. **Детальный анализ**
   - По subtopics из Research Plan
   - Факты + примеры

5. **Риски и неопределённости**
   - Из Devil's Advocate
   - С mitigation strategies

6. **Практические рекомендации**
   - Что делать завтра (конкретно)
   - URLs, имена, контакты

7. **Decision Framework**
   - Как выбирать между опциями
   - Привязан к контексту пользователя

8. **Appendix: Sources**
   - Все источники в формате: "Title - URL - Date"
   - Разбиты по Tier 1/2/3

---

## Anti-Fluff Checklist

**⛔ Перед публикацией удалить или переписать:**

- [ ] "важно отметить что..." → написать суть
- [ ] "следует рассмотреть..." → что конкретно
- [ ] "рекомендуется изучить..." → ЧТО и ГДЕ (URL)
- [ ] "необходимо провести анализ..." → какой, первый шаг
- [ ] Рекомендации без конкретного действия
- [ ] Числа без источника или года
- [ ] Списки где >50% очевидно

---

## Quality Check после Stage 6

- [ ] Можно ли ДЕЙСТВОВАТЬ по отчёту без доп. ресёрча?
- [ ] Есть конкретные URLs, имена, контакты?
- [ ] Убрано всё что не помогает принять решение?
- [ ] Executive Summary только из verified facts?

---

## Output

```json
{
  "notion_url": "https://notion.so/...",
  "page_id": "...",
  "sections_count": 8,
  "sources_count": 25,
  "verified_facts_used": 32
}
```

---

## Gate Check

Notion page EXISTS и accessible → переход к Stage 7
