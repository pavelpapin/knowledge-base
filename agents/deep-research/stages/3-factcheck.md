# Stage 3: Fact Checking

**Agent:** Fact Checker Agent
**Purpose:** Перекрёстная проверка всех данных

---

## Gate Condition

**Input:** Данные от всех агентов (Stage 2)
**Output:** Verified / Unverified / Rejected facts

---

## Actions

1. Cross-reference каждого факта
2. Подтверждение источников (≥2 независимых)
3. Проверка source tier
4. Отбраковка слабых данных
5. Пометка Unverified для непроверенных

---

## Verification Rules

### Verified (можно в Executive Summary)
- ≥2 независимых источника
- Источники Tier 1 или Tier 2
- Данные не старше 2 лет (или помечены как historical)

### Unverified (можно в body, с пометкой)
- 1 источник
- Tier 3 источник
- Нет точной даты

### Rejected (не включать)
- Противоречит verified фактам
- Источник недостоверен
- Данные устарели (>3 лет без пометки)

---

## Output

```json
{
  "verified_facts": [
    {
      "statement": "...",
      "sources": ["url1", "url2"],
      "confidence": 0.95
    }
  ],
  "unverified_facts": [
    {
      "statement": "...",
      "sources": ["url1"],
      "reason": "single source",
      "confidence": 0.6
    }
  ],
  "rejected_facts": [
    {
      "statement": "...",
      "reason": "contradicts verified data"
    }
  ],
  "verification_stats": {
    "total": 45,
    "verified": 32,
    "unverified": 10,
    "rejected": 3
  }
}
```

---

## Gate Check

`verified_facts.length > 0` → переход к Stage 4
