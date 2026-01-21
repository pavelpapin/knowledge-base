# Elio Observability & Self-Healing System

## Проблема

1. **Нет видимости** - когда Claude работает долго, пользователь не видит прогресс
2. **Нет логов** - MCP server пишет в stdout который не виден в UI
3. **Нет recovery** - если что-то падает, нет автоматического восстановления
4. **Нет rate limiting** - можно перегрузить API

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY LAYER                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Logger     │  │   Metrics    │  │   Tracer     │          │
│  │  (file+db)   │  │  (counters)  │  │ (spans/ctx)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                      │
│                    ┌──────▼──────┐                              │
│                    │  Collector   │                              │
│                    │  (unified)   │                              │
│                    └──────┬───────┘                              │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         │                 │                 │                    │
│    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐               │
│    │  File   │      │ Supabase │      │ Telegram │              │
│    │  Sink   │      │   Sink   │      │  Alerts  │              │
│    └─────────┘      └──────────┘      └──────────┘              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      SELF-HEALING LAYER                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Rate Limiter │  │   Circuit    │  │   Retry      │          │
│  │ (per-api)    │  │   Breaker    │  │   Manager    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Timeout     │  │  Fallback    │  │   Health     │          │
│  │  Manager     │  │   Provider   │  │   Checker    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Компоненты

### 1. Logger (улучшенный)

```typescript
// Пишет одновременно в:
// - File: /root/.claude/logs/YYYY-MM-DD.log
// - DB: workflow_runs.logs (JSONB array)
// - Console: для debug

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;        // 'deep-research', 'gmail', etc.
  runId?: string;         // workflow_runs.id для группировки
  message: string;
  data?: unknown;
  duration?: number;      // для трейсинга
}
```

### 2. Progress Reporter

```typescript
// Отправляет прогресс пользователю
interface ProgressUpdate {
  runId: string;
  stage: string;          // 'discovery', 'data_collection', etc.
  progress: number;       // 0-100
  message: string;
  eta?: number;           // seconds remaining
}

// Каналы доставки:
// - Telegram (если чат настроен)
// - File: /root/.claude/logs/progress/{runId}.json
// - DB: workflow_runs.progress
```

### 3. Rate Limiter

```typescript
interface RateLimitConfig {
  perplexity: { rpm: 20, daily: 1000 };
  gmail: { rpm: 60, daily: 10000 };
  notion: { rpm: 3, daily: 2000 };
  linkedin: { rpm: 10, daily: 100 };
  // ...
}

// Стратегии при limit:
// 1. Queue - поставить в очередь
// 2. Delay - подождать
// 3. Fail - вернуть ошибку
```

### 4. Circuit Breaker

```typescript
interface CircuitState {
  service: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure: Date;
  nextRetry: Date;
}

// Правила:
// - 3 failures → open circuit
// - Wait 30s → half-open (try 1 request)
// - Success → closed
// - Failure → open again
```

### 5. Retry Manager

```typescript
interface RetryConfig {
  maxAttempts: 3;
  baseDelay: 1000;        // ms
  maxDelay: 30000;        // ms
  backoff: 'exponential'; // or 'linear', 'constant'
  retryOn: ['TIMEOUT', 'RATE_LIMIT', '5xx'];
  noRetryOn: ['AUTH_ERROR', '4xx'];
}
```

### 6. Health Checker

```typescript
// Проверяет все интеграции при старте и периодически
interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  latency: number;
  error?: string;
}

// Проверки:
// - Supabase connection
// - Gmail auth valid
// - Notion token valid
// - Perplexity API reachable
```

## Реализация

### Phase 1: File-based Logging (немедленно)

```typescript
// /root/.claude/mcp-server/src/utils/file-logger.ts

import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = '/root/.claude/logs/daily';

export function logToFile(entry: LogEntry): void {
  const date = new Date().toISOString().split('T')[0];
  const file = join(LOG_DIR, `${date}.log`);

  mkdirSync(LOG_DIR, { recursive: true });

  const line = JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString()
  }) + '\n';

  appendFileSync(file, line);
}
```

### Phase 2: Progress to Telegram

```typescript
// При старте long-running операции
async function startWithProgress(runId: string, stages: string[]) {
  await notifyTelegram(`🚀 Started: ${runId}\nStages: ${stages.join(' → ')}`);

  for (const stage of stages) {
    await notifyTelegram(`⏳ ${stage}...`);
    // ... выполнение
    await notifyTelegram(`✅ ${stage} done`);
  }

  await notifyTelegram(`🎉 Completed: ${runId}`);
}
```

### Phase 3: Rate Limiter

```typescript
// /root/.claude/mcp-server/src/utils/rate-limiter.ts

interface RateLimiter {
  acquire(service: string): Promise<void>;
  release(service: string): void;
  getStatus(service: string): RateLimitStatus;
}

// Использует Redis или in-memory с файловым бэкапом
```

### Phase 4: Circuit Breaker + Retry

```typescript
// Обёртка для всех API вызовов
async function withResilience<T>(
  service: string,
  fn: () => Promise<T>,
  config?: RetryConfig
): Promise<T> {
  // Check circuit
  if (circuitBreaker.isOpen(service)) {
    throw new Error(`Circuit open for ${service}`);
  }

  // Rate limit
  await rateLimiter.acquire(service);

  try {
    return await retry(fn, config);
  } catch (error) {
    circuitBreaker.recordFailure(service);
    throw error;
  } finally {
    rateLimiter.release(service);
  }
}
```

## Конфиги

### /root/.claude/config/rate-limits.json

```json
{
  "perplexity": {
    "requestsPerMinute": 20,
    "requestsPerDay": 1000,
    "strategy": "queue"
  },
  "gmail": {
    "requestsPerMinute": 60,
    "requestsPerDay": 10000,
    "strategy": "delay"
  },
  "notion": {
    "requestsPerMinute": 3,
    "requestsPerDay": 2000,
    "strategy": "queue"
  }
}
```

### /root/.claude/config/retry.json

```json
{
  "default": {
    "maxAttempts": 3,
    "baseDelay": 1000,
    "maxDelay": 30000,
    "backoff": "exponential"
  },
  "perplexity": {
    "maxAttempts": 5,
    "baseDelay": 2000,
    "backoff": "exponential"
  }
}
```

## Мониторинг

### Dashboard (Telegram команды)

```
/status - общий статус всех сервисов
/logs [service] [count] - последние логи
/metrics [period] - метрики за период
/health - health check всех интеграций
```

### Alerts

```typescript
// Автоматические алерты в Telegram:
// - Circuit открыт для сервиса
// - Rate limit исчерпан
// - Workflow failed после всех retry
// - Health check failed
```

## Приоритеты реализации

1. **File Logger** - сразу видны логи в `/root/.claude/logs/`
2. **Progress Reporter** - прогресс в Telegram
3. **Rate Limiter** - защита от перегрузки API
4. **Circuit Breaker** - защита от каскадных failures
5. **Health Checker** - видимость статуса интеграций

## Метрики для сбора

```typescript
interface Metrics {
  // Counters
  requests_total: Counter;
  requests_failed: Counter;
  rate_limits_hit: Counter;
  circuit_opens: Counter;

  // Gauges
  active_requests: Gauge;
  circuit_state: Gauge;  // 0=closed, 1=half-open, 2=open

  // Histograms
  request_duration: Histogram;
  retry_count: Histogram;
}
```
