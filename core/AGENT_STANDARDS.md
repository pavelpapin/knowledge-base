# Agent Standards v1.1

**Дата создания:** 2026-01-20
**Последнее обновление:** 2026-01-21

Этот документ определяет обязательные стандарты для создания любых агентов в системе Elio. Каждый новый агент ДОЛЖЕН следовать этим правилам.

---

## 1. Обязательные компоненты агента

Каждый агент ДОЛЖЕН иметь:

```
agents/{agent-name}/
├── AGENT.md              # Описание, inputs/outputs, workflow
├── prompts/
│   └── {stage}.md        # Промпты для каждой стадии
├── config.json           # Конфигурация агента
└── tests/
    └── {agent-name}.test.ts  # Тесты
```

### AGENT.md обязательные секции:

```markdown
# {Agent Name}

## Purpose
Одно предложение - что делает агент

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| topic | string | yes | ... |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| report | notion_page | ... |

## Workflow Stages
1. Stage 1: Name - description
2. Stage 2: Name - description
...

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Verification
Как проверяется что агент выполнил задачу
```

---

## 2. Stage Structure (⛔ КРИТИЧНО!)

**КАЖДЫЙ агент ОБЯЗАН иметь явную структуру стейджей. Это НЕ опционально.**

### 2.1 Обязательные элементы Stage Structure

```markdown
## Stages

### ⛔ Stage Gates (ОБЯЗАТЕЛЬНО в каждом AGENT.md!)

| From | To | Gate Condition |
|------|----|----------------|
| Start | Stage 0 | - |
| Stage 0 | Stage 1 | [условие перехода] |
| Stage N | Stage N+1 | [условие перехода] |
| Last Stage | Done | [финальная верификация] |

### Stage 0: [Name] (ОБЯЗАТЕЛЬНО!)
**Purpose:** [что делает этот стейдж]
**⛔ БЛОКЕР:** [что должно произойти для перехода]
**Actions:** [список действий]
**Output:** [что возвращает стейдж]

### Stage 1: [Name]
...
```

### 2.2 Правила выполнения стейджей

1. **Стейджи выполняются СТРОГО по порядку** - нельзя перескакивать
2. **Каждый стейдж имеет Gate Condition** - условие для перехода к следующему
3. **Stage 0 ВСЕГДА = Discovery/Clarification** - сбор требований от пользователя
4. **Последний стейдж ВСЕГДА = Verification** - проверка deliverable
5. **Между стейджами - явное подтверждение** перехода

### 2.3 Stage 0: Discovery (ОБЯЗАТЕЛЬНО для всех агентов!)

**Каждый агент ОБЯЗАН начинаться с Discovery стейджа.**

#### ⛔ ФОРМАТ ВЗАИМОДЕЙСТВИЯ (СТРОГО!)

**Discovery = ОДИН блок со ВСЕМИ вопросами (до 10 штук).**

```
ЗАПРЕЩЕНО:
❌ Задавать вопросы по одному
❌ Ждать ответа после каждого вопроса
❌ Растягивать Discovery на несколько сообщений

ОБЯЗАТЕЛЬНО:
✅ Задать ВСЕ вопросы СРАЗУ в ОДНОМ сообщении
✅ Пользователь отвечает на ВСЕ вопросы ОДНИМ сообщением
✅ После ответов - сформировать Brief и запросить подтверждение
```

#### Шаблон Discovery сообщения:

```markdown
**STAGE 0: DISCOVERY**

1. **Цель** - Какое решение хочешь принять на основе результата?
   - Вариант A?
   - Вариант B?
   - Другое?

2. **Success Criteria** - Что для тебя "успешный результат"?

3. **География** - Какие регионы? (US, Europe, Global)

4. **Scope - Включить** - Что обязательно должно быть?

5. **Scope - Исключить** - Что НЕ включать?

6. **Глубина** - Сколько объектов детально разобрать? (5? 10? 20?)

7. **Ограничения** - Сроки, бюджет, другие constraints?

8. **Формат** - Notion page? Google Doc? Презентация?

9. **Приоритеты** - Какие аспекты важнее всего?

10. **Контекст** - Что ещё нужно знать?

---
Ответь на все вопросы одним сообщением.
```

#### После ответов пользователя:

```markdown
**RESEARCH BRIEF**

```json
{
  "topic": "...",
  "goal": "...",
  "success_criteria": [...],
  "geography": [...],
  "scope": {"include": [...], "exclude": [...]},
  "depth": "...",
  "constraints": {...},
  "format": "...",
  "priorities": [...],
  "context": "..."
}
```

**⛔ GATE CHECK:** Подтверждаешь Brief? Можно начинать работу?
```

#### Правила:

1. **Минимум 5 вопросов, максимум 10** - зависит от сложности агента
2. **Вопросы пронумерованы** - для удобства ответа
3. **Варианты ответов где возможно** - ускоряет процесс
4. **Заканчивается строкой** "Ответь на все вопросы одним сообщением"
5. **После ответов - Brief в JSON** - структурированно
6. **Gate check обязателен** - явное подтверждение перед работой

### 2.4 Execution Pattern

```typescript
// Правильный паттерн выполнения агента
async function runAgent(input: AgentInput) {
  const stages = getStages(); // Загрузить из AGENT.md

  for (const stage of stages) {
    // 1. Notify start
    await notifyTelegram(`📋 Stage ${stage.index}/${stages.length}: ${stage.name}`);

    // 2. Execute stage
    const result = await stage.execute();

    // 3. Check gate condition
    if (!stage.gateCondition(result)) {
      throw new Error(`Gate condition failed for ${stage.name}`);
    }

    // 4. Log completion
    logger.info(`Stage ${stage.name} completed`, { result });
  }
}
```

### 2.5 Anti-Skip Protection

**ЗАПРЕЩЕНО:**
- ❌ Пропускать стейджи
- ❌ Объединять стейджи
- ❌ Менять порядок стейджей
- ❌ Начинать работу без Discovery
- ❌ Завершать без Verification

**При нарушении:** Агент ДОЛЖЕН остановиться и сообщить об ошибке.

---

## 3. Progress & Observability (ОБЯЗАТЕЛЬНО)

### 2.1 Telegram Notifications

Каждый агент ОБЯЗАН отправлять уведомления:

```typescript
// При старте
await notifyTelegram(`🚀 Started: ${agentName} - ${taskDescription}`);

// При каждой стадии
await notifyTelegram(`📋 ${currentStage}/${totalStages}: ${stageName} (${percent}%)`);

// При завершении
await notifyTelegram(`✅ Completed: ${agentName}\n🔗 Result: ${resultUrl}`);

// При ошибке
await notifyTelegram(`❌ Failed: ${agentName}\n⚠️ Error: ${errorMessage}`);
```

### 2.2 File Logging

Каждый агент ОБЯЗАН логировать в файлы:

```typescript
import { createFileLogger } from '../utils/file-logger.js';

const logger = createFileLogger(agentName, runId);

// Логируем все важные события
logger.info('Starting stage', { stage: 'discovery' });
logger.warn('Retry needed', { attempt: 2, reason: 'timeout' });
logger.error('Stage failed', { error: errorMessage });
```

### 2.3 Run Tracking

```typescript
import { startRun, updateStage, completeRun, failRun } from '../utils/progress.js';

// Обязательный паттерн
const runId = generateRunId(agentName);
await startRun(runId, taskDescription, stageNames);

try {
  for (const stage of stages) {
    await updateStage(runId, stage.name, stage.details);
    await stage.execute();
  }
  await completeRun(runId, result);
} catch (error) {
  await failRun(runId, error.message);
  throw error;
}
```

---

## 4. Verification (ОБЯЗАТЕЛЬНО)

### 3.1 Каждый агент ОБЯЗАН верифицировать результат

НИКОГДА не говорить "готово" без проверки!

```typescript
import { verify, VERIFY_PRESETS } from '../utils/verify.js';

// После создания deliverable
const verifyResult = await verify({
  type: 'notion_page',
  pageId: createdPageId,
  minBlocks: 15,
  requiredHeadings: ['Executive Summary', 'Recommendations']
});

if (!verifyResult.ok) {
  // Retry или fail
  throw new Error(`Verification failed: ${verifyResult.error}`);
}

// Только после успешной верификации
await notifyTelegram(`✅ Verified: ${verifyResult.url}`);
```

### 3.2 Типы проверок

| Deliverable Type | Verification |
|------------------|--------------|
| Notion page | Существует, >N блоков, есть нужные заголовки |
| File | Существует, >N байт, содержит нужный текст |
| Email | Отправлен, есть message_id |
| Calendar event | Создан, есть event_id |
| API response | Status 200, содержит нужные поля |

### 3.3 Retry при неудаче

```typescript
const MAX_RETRIES = 3;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  const result = await createDeliverable();
  const verified = await verify(result);

  if (verified.ok) {
    return result;
  }

  if (attempt < MAX_RETRIES) {
    await notifyTelegram(`⚠️ Verification failed (${attempt}/${MAX_RETRIES}), retrying...`);
    await sleep(2000 * attempt); // Exponential backoff
  }
}

throw new Error('Verification failed after all retries');
```

---

## 5. Error Handling

### 4.1 Все ошибки должны быть обработаны

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error: String(error) });
  await notifyTelegram(`❌ Error in ${stageName}: ${error.message}`);

  // Decide: retry, skip, or fail
  if (isRetryable(error)) {
    return retry();
  }

  throw error; // Propagate to outer handler
}
```

### 4.2 Graceful degradation

Если некритичная часть падает - продолжать с warning:

```typescript
let youtubeData = null;
try {
  youtubeData = await fetchYoutubeTranscript(url);
} catch (error) {
  logger.warn('YouTube fetch failed, continuing without', { error });
  // Продолжаем без YouTube данных
}
```

---

## 6. Rate Limiting & Circuit Breaker

### 5.1 Все внешние API вызовы через rate limiter

```typescript
import { withRateLimit } from '../utils/rate-limiter.js';
import { withCircuitBreaker } from '../utils/circuit-breaker.js';

// Правильно
const result = await withRateLimit('perplexity', () =>
  withCircuitBreaker('perplexity', () =>
    perplexitySearch(query)
  )
);

// Неправильно - прямой вызов
const result = await perplexitySearch(query);
```

---

## 7. Deliverables

### 6.1 Всегда указывать где результат

Агент ОБЯЗАН вернуть конкретный URL или path:

```typescript
// Правильно
return {
  success: true,
  deliverable: {
    type: 'notion_page',
    url: 'https://notion.so/page-id',
    verified: true
  }
};

// Неправильно
return { success: true, message: 'Done!' };
```

### 6.2 Notion > Local Files

Приоритет для хранения результатов:
1. **Notion** - для отчётов, документов, данных
2. **Google Docs** - для документов требующих совместной работы
3. **Local files** - только как backup или для технических логов

---

## 8. Stages Design

### 7.1 Каждая стадия - атомарная операция

```typescript
// Правильно - стадии независимы
const stages = [
  { name: 'Discovery', fn: discovery },
  { name: 'Planning', fn: planning },
  { name: 'Data Collection', fn: collectData },
  { name: 'Analysis', fn: analyze },
  { name: 'Report', fn: createReport },
  { name: 'Verification', fn: verify }  // ОБЯЗАТЕЛЬНО последняя
];

// Неправильно - всё в одной функции
async function doEverything() { ... }
```

### 7.2 Последняя стадия ВСЕГДА verification

```typescript
stages.push({
  name: 'Verification',
  fn: async () => {
    const result = await verify(deliverable);
    if (!result.ok) throw new Error(result.error);
    return result;
  }
});
```

---

## 9. Configuration

### 8.1 config.json формат

```json
{
  "name": "agent-name",
  "version": "1.0.0",
  "description": "What the agent does",

  "inputs": {
    "topic": { "type": "string", "required": true },
    "depth": { "type": "string", "default": "medium" }
  },

  "outputs": {
    "report": { "type": "notion_page" }
  },

  "stages": [
    { "name": "Discovery", "timeout": 60000 },
    { "name": "Analysis", "timeout": 300000 },
    { "name": "Report", "timeout": 120000 },
    { "name": "Verification", "timeout": 30000 }
  ],

  "verification": {
    "type": "notion_page",
    "minBlocks": 15,
    "requiredHeadings": ["Summary", "Recommendations"]
  },

  "notifications": {
    "onStart": true,
    "onStageChange": true,
    "onComplete": true,
    "onError": true
  },

  "retry": {
    "maxAttempts": 3,
    "backoff": "exponential"
  }
}
```

---

## 10. Testing

### 9.1 Каждый агент должен иметь тесты

```typescript
// agents/{name}/tests/{name}.test.ts

describe('AgentName', () => {
  it('should complete successfully with valid input', async () => {
    const result = await runAgent({ topic: 'test' });
    expect(result.success).toBe(true);
    expect(result.deliverable.url).toBeDefined();
  });

  it('should fail gracefully with invalid input', async () => {
    await expect(runAgent({})).rejects.toThrow('topic is required');
  });

  it('should notify on progress', async () => {
    const notifications: string[] = [];
    // Mock notifyTelegram
    // Run agent
    expect(notifications).toContain('Started');
    expect(notifications).toContain('Completed');
  });

  it('should verify deliverable', async () => {
    const result = await runAgent({ topic: 'test' });
    expect(result.verified).toBe(true);
  });
});
```

---

## 11. Issue Logging & Self-Improvement (ОБЯЗАТЕЛЬНО)

### 10.1 Issue Logging

Каждый агент ОБЯЗАН логировать проблемы (не технические ошибки, а семантические):

```typescript
import {
  startRun,
  startStage,
  completeStage,
  logIssue,
  logSourceSuccess,
  completeRun
} from '../core/observability/index.js';

// При старте агента
const runId = startRun('deep-research', topic);

// При каждой стадии
startStage(runId, 'data-collection');

// Логируем успешные источники
logSourceSuccess(runId, 'perplexity', 5);

// Логируем проблемы (НЕ технические ошибки!)
logIssue(runId, 'data_source_failed', 'LinkedIn API returned empty', {
  source: 'linkedin',
  query: personName,
  suggestion: 'Try web search workaround'
});

logIssue(runId, 'verification_failed', 'Could not verify funding amount', {
  fact: '$100M Series C',
  sources: ['techcrunch'],
  expected: '2+ sources'
});

// При завершении
completeStage(runId, 'data-collection', 'completed');
const summary = completeRun(runId, 'completed', {
  type: 'notion_page',
  url: resultUrl
});
```

### 10.2 Issue Types

| Type | Когда использовать |
|------|-------------------|
| `data_source_failed` | Источник вернул пустой результат или ошибку |
| `data_source_blocked` | Источник активно заблокировал запрос |
| `data_incomplete` | Получили данные, но не хватает важных полей |
| `data_stale` | Данные устарели |
| `data_conflict` | Разные источники дают разные данные |
| `verification_failed` | Не удалось подтвердить факт 2+ источниками |
| `quality_low` | Результат низкого качества |
| `timeout` | Операция заняла слишком много времени |
| `rate_limited` | Достигли лимита запросов |
| `missing_context` | Не хватает контекста для выполнения |

### 10.3 Post-Run Analysis

После завершения КАЖДОГО агента автоматически запускается анализ:

```typescript
import { analyzeRun } from '../core/observability/index.js';

// В конце агента
const summary = completeRun(runId, status);
if (summary) {
  const analysis = analyzeRun(summary);
  // analysis содержит:
  // - suggestions: рекомендации по улучшению
  // - improvementTasks: задачи для nightly agent
  // - nightlyTasks: что можно автоматизировать
}
```

### 10.4 Nightly Improvement

Каждую ночь в 03:00 запускается автоматический агент улучшений:

1. **Health Check** - проверяет все источники данных
2. **Auto-Fix** - исправляет простые проблемы (reset rate limits, refresh tokens)
3. **Analysis** - анализирует паттерны ошибок
4. **Report** - генерирует отчёт и задачи на утро

Workflow: `/root/.claude/workflows/nightly-improvement/WORKFLOW.md`

### 10.5 Observability Wrapper

Простой способ обернуть агента в observability:

```typescript
import { withObservability } from '../core/observability/index.js';

const { result, runId, summary } = await withObservability(
  'deep-research',
  topic,
  async (runId) => {
    // Весь код агента здесь
    // runId доступен для логирования
    return result;
  }
);
```

---

## 12. Lessons Learned (обновлять!)

### 11.1 Ошибки 2026-01-20

| Ошибка | Причина | Исправление |
|--------|---------|-------------|
| Сказал "готово" без проверки | Нет verification stage | Добавить обязательную верификацию |
| Пользователь не видел прогресс | Логи в stdout | Telegram notifications обязательны |
| Результат не в Notion | Забыл последний шаг | Verification проверяет deliverable |
| Пропустил Discovery stage | Не следовал workflow | Stages должны быть атомарными |

### 11.2 Ошибки 2026-01-21

| Ошибка | Причина | Исправление |
|--------|---------|-------------|
| Пропустил Discovery вопросы | Stage gate был "мягким" | Добавить ⛔ БЛОКЕР и чеклист обязательных вопросов |
| Сразу перешёл к Planning | Нет явной проверки confirmed_by_user | Gate check: "Подтверждаешь Research Brief?" |
| Не спросил цель исследования | Вопросы не были ОБЯЗАТЕЛЬНЫМИ | Список 6 обязательных вопросов с ⛔ |
| Задавал вопросы по одному | Не было правила про формат | ВСЕ вопросы СРАЗУ в ОДНОМ сообщении (до 10 шт) |

### 11.3 Добавлять сюда новые ошибки!

При обнаружении новой системной ошибки:
1. Добавить в таблицу выше
2. Обновить соответствующий раздел стандартов
3. Создать/обновить тесты
4. Применить ко всем существующим агентам

---

## Checklist для нового агента

- [ ] Создана структура папок
- [ ] AGENT.md заполнен полностью
- [ ] config.json создан
- [ ] Промпты для каждой стадии
- [ ] Progress notifications настроены
- [ ] File logging настроен
- [ ] Verification stage добавлен
- [ ] Error handling везде
- [ ] Rate limiting для внешних API
- [ ] Circuit breaker для внешних API
- [ ] Тесты написаны
- [ ] Deliverable возвращает URL/path
- [ ] Issue logging интегрирован
- [ ] Post-run analysis вызывается

---

*Этот документ обновляется при каждом обнаружении новой системной ошибки.*
