# Consilium Review System

## Concept

Три модели (Claude, OpenAI, Groq) проводят консилиум по отчету:
1. Каждая дает независимую оценку
2. Каждая видит оценки других и может пересмотреть
3. Синтезируется единое ТЗ на доработку

## Round 1: Independent Review

Каждая модель получает отчет и оценивает по критериям:

### Criteria (для всех моделей одинаковые)
```json
{
  "completeness": {
    "score": 0-20,
    "issues": ["...", "..."],
    "suggestions": ["...", "..."]
  },
  "accuracy": {
    "score": 0-20,
    "issues": [],
    "suggestions": []
  },
  "sources": {
    "score": 0-20,
    "issues": [],
    "suggestions": []
  },
  "actionability": {
    "score": 0-20,
    "issues": [],
    "suggestions": []
  },
  "structure": {
    "score": 0-20,
    "issues": [],
    "suggestions": []
  },
  "total_score": 0-100,
  "verdict": "approved | needs_revision | rejected",
  "key_concerns": ["..."],
  "strengths": ["..."]
}
```

## Round 2: Cross-Review

Каждая модель видит:
- Оригинальный отчет
- Свою оценку (Round 1)
- Оценки двух других моделей

Задача: пересмотреть свою оценку с учетом мнений коллег.

```json
{
  "original_verdict": "needs_revision",
  "revised_verdict": "approved",
  "changed_scores": {
    "accuracy": { "from": 15, "to": 18, "reason": "OpenAI убедил что источники достаточны" }
  },
  "agreement": {
    "with_claude": ["issue1", "issue2"],
    "with_openai": ["issue3"],
    "with_groq": []
  },
  "disagreement": {
    "with_claude": { "issue": "...", "my_position": "..." },
    "with_openai": null,
    "with_groq": { "issue": "...", "my_position": "..." }
  }
}
```

## Round 3: Synthesis

Алгоритм объединения:

### 1. Консенсус (2/3 согласны)
```python
for issue in all_issues:
    models_agree = count(models where issue in model.issues)
    if models_agree >= 2:
        add_to_unified_tz(issue, priority="high")
```

### 2. Критические issues (любой нашел)
```python
for model in [claude, openai, groq]:
    for issue in model.key_concerns:
        if issue.severity == "critical":
            add_to_unified_tz(issue, priority="critical")
```

### 3. Спорные пункты (разные мнения)
```python
for issue in disputed_issues:
    add_to_unified_tz(issue, priority="review",
                      note=f"Claude: {claude_opinion}, OpenAI: {openai_opinion}, Groq: {groq_opinion}")
```

### Final Verdict Logic
```python
verdicts = [claude.verdict, openai.verdict, groq.verdict]

if verdicts.count("rejected") >= 2:
    final_verdict = "rejected"
elif verdicts.count("approved") >= 2:
    final_verdict = "approved"
else:
    final_verdict = "needs_revision"
```

## Unified Improvement TZ

Output format:
```json
{
  "final_verdict": "needs_revision",
  "consensus_score": 76,
  "model_scores": {
    "claude": 78,
    "openai": 74,
    "groq": 76
  },
  "critical_issues": [
    {
      "issue": "Отсутствует источник для claim X",
      "found_by": ["claude", "openai"],
      "action": "Найти и добавить источник или удалить claim"
    }
  ],
  "high_priority": [
    {
      "issue": "Рекомендации слишком общие",
      "found_by": ["openai", "groq"],
      "action": "Конкретизировать с цифрами и сроками"
    }
  ],
  "suggestions": [
    {
      "suggestion": "Добавить визуализацию данных",
      "found_by": ["groq"],
      "action": "Опционально"
    }
  ],
  "disputed": [
    {
      "topic": "Нужен ли раздел про конкурентов",
      "opinions": {
        "claude": "Да, критично для контекста",
        "openai": "Нет, выходит за scope",
        "groq": "Да, но кратко"
      },
      "action": "Решение за пользователем"
    }
  ]
}
```

## Model-Specific Prompts

### Claude (Opus) Prompt
```
Ты Senior Research Scientist. Твоя роль в консилиуме:
- Глубокий анализ методологии
- Проверка логической связности
- Оценка качества рекомендаций

Особый фокус: научная строгость и actionability.
```

### OpenAI (GPT-4o) Prompt
```
Ты Chief Editor научного журнала. Твоя роль:
- Проверка источников и цитирования
- Оценка полноты раскрытия темы
- Качество структуры и изложения

Особый фокус: accuracy и completeness.
```

### Groq (Llama 70B) Prompt
```
Ты Devil's Advocate. Твоя роль:
- Найти слабые места и пробелы
- Поставить под сомнение выводы
- Предложить альтернативные интерпретации

Особый фокус: критический анализ и risk assessment.
```

## Implementation

```typescript
interface ConsiliumResult {
  round1: {
    claude: ModelReview;
    openai: ModelReview;
    groq: ModelReview;
  };
  round2: {
    claude: RevisedReview;
    openai: RevisedReview;
    groq: RevisedReview;
  };
  synthesis: UnifiedTZ;
  final_verdict: 'approved' | 'needs_revision' | 'rejected';
  iterations: number;
}

async function runConsilium(report: string): Promise<ConsiliumResult> {
  // Round 1: Parallel independent reviews
  const [claudeR1, openaiR1, groqR1] = await Promise.all([
    callClaude(report, CLAUDE_REVIEW_PROMPT),
    callOpenAI(report, OPENAI_REVIEW_PROMPT),
    callGroq(report, GROQ_REVIEW_PROMPT)
  ]);

  // Round 2: Cross-review (can also be parallel)
  const [claudeR2, openaiR2, groqR2] = await Promise.all([
    callClaude(report, CROSS_REVIEW_PROMPT, { others: [openaiR1, groqR1] }),
    callOpenAI(report, CROSS_REVIEW_PROMPT, { others: [claudeR1, groqR1] }),
    callGroq(report, CROSS_REVIEW_PROMPT, { others: [claudeR1, openaiR1] })
  ]);

  // Round 3: Synthesis (single call)
  const synthesis = synthesize(claudeR2, openaiR2, groqR2);

  return {
    round1: { claude: claudeR1, openai: openaiR1, groq: groqR1 },
    round2: { claude: claudeR2, openai: openaiR2, groq: groqR2 },
    synthesis,
    final_verdict: synthesis.final_verdict,
    iterations: 0
  };
}
```

## Cost Estimation

| Model | Round 1 | Round 2 | Total Tokens | Cost |
|-------|---------|---------|--------------|------|
| Claude Opus | ~8K in, ~2K out | ~12K in, ~1K out | ~23K | ~$0.50 |
| OpenAI GPT-4o | ~8K in, ~2K out | ~12K in, ~1K out | ~23K | ~$0.25 |
| Groq Llama 70B | ~8K in, ~2K out | ~12K in, ~1K out | ~23K | FREE |

**Total per consilium: ~$0.75**

## Workflow Integration

Заменяем Stage 7 + Stage 8 на единый Consilium:

```
[Stage 6: Report Draft]
        │
        ▼
[Stage 7: CONSILIUM]
        │
        ├── Round 1 (parallel) ─┬─ Claude Review
        │                       ├─ OpenAI Review
        │                       └─ Groq Review
        │
        ├── Round 2 (parallel) ─┬─ Claude Cross-Review
        │                       ├─ OpenAI Cross-Review
        │                       └─ Groq Cross-Review
        │
        └── Round 3 ─── Synthesis ─── Unified TZ
                              │
                              ├── approved ────► Stage 8: Publish
                              ├── needs_revision ► Apply TZ, retry (max 2)
                              └── rejected ────► Notify user
```

## Advantages

1. **Устойчивость к bias** - три разные модели снижают риск однобокой оценки
2. **Comprehensive coverage** - каждая модель имеет свои сильные стороны
3. **Прозрачность** - видно кто что нашел и почему
4. **Cost-effective** - Groq бесплатный, основная нагрузка на него
5. **Cross-validation** - модели проверяют друг друга
