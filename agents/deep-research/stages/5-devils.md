# Stage 5: Devil's Advocate

**Agent:** Devil's Advocate Agent
**Purpose:** Найти слабые места, риски, контраргументы

---

## Gate Condition

**Input:** Synthesis (Stage 4)
**Output:** Challenges, risks, blind spots, failed examples

---

## Actions

1. Искать контраргументы к каждому выводу
2. Оспаривать рекомендации
3. Подсвечивать риски
4. Искать failed examples
5. Задавать неудобные вопросы

---

## ⛔ Обязательные вопросы

Для КАЖДОЙ рекомендации из Stage 4:

1. **"Почему это НЕ сработает?"**
   - Какие assumptions могут быть неверны?
   - Что может пойти не так?

2. **"Кто уже пробовал и провалился?"**
   - Искать failed startups/projects в этой области
   - Почему они провалились?

3. **"Что я упустил?"**
   - Какие области не рассмотрены?
   - Есть ли blind spots?

4. **"Через год это будет актуально?"**
   - AI/рынки меняются быстро
   - Какие тренды могут это обесценить?

5. **"Какой худший сценарий?"**
   - Что если ВСЁ пойдёт не так?
   - Какой downside risk?

---

## Output

```json
{
  "challenges": [
    {
      "to_recommendation": "recommendation text",
      "challenge": "почему это может не сработать",
      "severity": "high|medium|low"
    }
  ],
  "risks": [
    {
      "risk": "описание риска",
      "probability": "high|medium|low",
      "impact": "high|medium|low",
      "mitigation": "как снизить риск"
    }
  ],
  "blind_spots": [
    "что не было рассмотрено и почему"
  ],
  "failed_examples": [
    {
      "name": "Company/Project X",
      "what_happened": "описание провала",
      "lesson": "что из этого следует"
    }
  ],
  "what_if": [
    "What if scenario 1?",
    "What if scenario 2?"
  ],
  "obsolescence_risk": "оценка риска устаревания выводов"
}
```

---

## Gate Check

Risks documented (≥3 risks, ≥1 failed example) → переход к Stage 6
