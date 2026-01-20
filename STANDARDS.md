# Elio Engineering Standards 2026

## CTO Directive: Modern Scalable Architecture

Мы строим системы будущего, а не легаси 2010-х годов. Все решения должны быть:
- Масштабируемыми
- Модульными
- Современными
- Типизированными

---

## Code Conventions

### General Rules
- **DRY** - Don't Repeat Yourself. Дублирование > 2 раз = выноси в утилиту
- **Single Responsibility** - один модуль/функция = одна задача
- **Descriptive naming** - имена должны объяснять что делает код
- **No magic values** - числа и строки выноси в именованные константы
- **Clean code** - удаляй неиспользуемые переменные, импорты и закомментированный код
- **Boy Scout Rule** - когда трогаешь код, исправь мелкие проблемы рядом (опечатки, мёртвый код)

### Comments
- Комментируй **почему**, а не **что** - код должен быть самодокументирующимся
- Удаляй очевидные и избыточные комментарии
- Сложный алгоритм = комментарий с объяснением trade-offs

### File Size Limits (CRITICAL)
- **MAX 200 строк на файл** - если больше, разбивай
- **MAX 50 строк на функцию** - если больше, декомпозируй
- **MAX 10 методов на класс** - если больше, выдели абстракцию

---

## TypeScript Standards

### Strict Typing
- **Strict mode** - всегда `"strict": true` в tsconfig
- **No `any`** - используй `unknown` + type guards
- **Explicit types** - для view models, props, возвращаемых значений
- **No implicit objects** - не создавай объекты без типизации

### Discriminated Unions
```typescript
// GOOD - discriminated union with tag
type Result =
  | { status: 'success'; data: User }
  | { status: 'error'; error: string };

function handle(result: Result) {
  switch (result.status) {
    case 'success': return result.data;
    case 'error': throw new Error(result.error);
    default: {
      const _exhaustive: never = result;
      throw new Error(`Unhandled case: ${_exhaustive}`);
    }
  }
}

// BAD - optional properties union
type Result = {
  data?: User;
  error?: string;
};
```

### Exports
- **Named exports ONLY** - никаких `export default`
- Default exports = антипаттерн:
  - Разные алиасы при импорте
  - Усложняет рефакторинг
  - Ухудшает tree-shaking
- Исключение: если инструмент требует (добавь `// eslint-disable-next-line`)

```typescript
// GOOD
export function createUser() {}
export const USER_LIMIT = 100;
export type User = { id: string };

// BAD
export default function createUser() {}
```

---

## Naming Conventions

### Files & Folders
- **Files**: kebab-case (`user-service.ts`)
- **Index files**: только для barrel exports

### Code
- **Classes**: PascalCase (`UserService`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`UserProfile`)
- **Boolean vars**: prefix `is`, `has`, `can` (`isActive`, `hasPermission`)

### Naming Rule
**Называй по текущему поведению, переименовывай когда поведение меняется**

---

## Project Structure

```
src/
├── index.ts          # Entry point ONLY (< 50 lines)
├── types/            # Type definitions
├── config/           # Configuration & constants
├── services/         # Business logic
├── handlers/         # Request handlers
├── utils/            # Pure utility functions
└── managers/         # State managers
```

### Import Order
1. Node.js built-ins (`fs`, `path`, `crypto`)
2. External packages (`@modelcontextprotocol/sdk`)
3. Internal workspace (`@elio/shared`)
4. Internal relative (`./utils`, `../types`)

---

## Architecture Principles

### Single Responsibility
Каждый модуль делает ОДНО дело хорошо:
- `services/` - бизнес-логика
- `handlers/` - обработка запросов
- `utils/` - чистые функции без side effects
- `types/` - только типы, без логики

### Centralized Config
- Доменные списки, маппинги, константы - в отдельных config объектах
- Не инлайнь одинаковые значения в разных файлах

```typescript
// GOOD - centralized
// config/status.ts
export const STATUS_COLORS = {
  active: 'green',
  pending: 'yellow',
  error: 'red'
} as const;

// BAD - inlined everywhere
const color = status === 'active' ? 'green' : status === 'pending' ? 'yellow' : 'red';
```

### Reuse Before Create
- Проверь существующие утилиты в `@elio/shared` и `utils/`
- Не создавай дубликаты существующего функционала

### Dependency Injection
Не хардкодь зависимости. Передавай через параметры или конструкторы.

---

## Error Handling

```typescript
// GOOD
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', { error });
  throw new AppError('OPERATION_FAILED', error);
}

// BAD
try {
  return await riskyOperation();
} catch (e) {
  console.log(e);  // NO!
}
```

---

## Async Patterns

### Parallel Execution
```typescript
// GOOD - Promise.all for parallel
const [users, posts] = await Promise.all([
  getUsers(),
  getPosts()
]);

// BAD - sequential when parallel is possible
const users = await getUsers();
const posts = await getPosts();
```

### Fire-and-Forget
```typescript
// GOOD - explicit void with comment
void sendAnalytics(event); // fire-and-forget, don't block response

// BAD - floating promise
sendAnalytics(event);
```

---

## Forbidden Patterns

НИКОГДА не делай:
- `any` типы (используй `unknown` + type guards)
- `export default` (только named exports)
- `var` (только `const` и `let`)
- Вложенность > 3 уровней
- God objects (классы которые делают всё)
- Magic numbers/strings (выноси в константы)
- `console.log` в production (используй logger)
- Синхронный IO в async контексте
- Массивные индексы как React keys (если порядок может измениться)

---

## Self-Review Checklist

После КАЖДОЙ задачи проверь:

1. **File sizes** - есть файлы > 200 строк? Разбей.
2. **Function sizes** - есть функции > 50 строк? Декомпозируй.
3. **Duplication** - есть копипаст? Вынеси в утилиту.
4. **Types** - всё типизировано? Нет `any`?
5. **Naming** - имена понятны без комментариев?
6. **Exports** - все named? Нет default?
7. **Constants** - нет magic values?
8. **Dead code** - удалён неиспользуемый код?

---

## Refactoring Triggers

Запускай рефакторинг когда:
- Файл превысил 200 строк
- Функция превысила 50 строк
- Появилось 3+ похожих блока кода
- Модуль имеет > 5 зависимостей
- Сложно понять что делает код без комментариев
- Есть `export default`

---

## Modern 2026 Stack

Предпочтительные технологии:
- **Runtime**: Node.js 22+ / Bun
- **Language**: TypeScript 5.x
- **Framework**: Hono / Elysia (не Express)
- **Validation**: Zod / TypeBox
- **Database**: Drizzle ORM / Prisma
- **Testing**: Vitest
- **Linting**: Biome (не ESLint)

---

## Architecture Review Questions

При каждом code review задавай:

1. **Tech Debt**: Какой самый большой технический долг в этом коде?
2. **Architecture**: Какое самое важное архитектурное изменение нужно?
3. **Scalability**: Как улучшить data flow для масштабируемости и модульности?

---

## Auto-Fix Rule (CRITICAL)

**После каждого code review с findings - СРАЗУ запускай фикс.**

Не спрашивай разрешения. Не предлагай варианты. Просто исправляй:

1. `architecture_analysis.tech_debt` - исправь первым
2. `architecture_analysis.recommended_change` - исправь вторым
3. `architecture_analysis.data_flow_improvement` - исправь третьим

Порядок приоритета фиксов:
1. **Security** (critical/high vulnerabilities)
2. **Architecture** (tech debt, coupling)
3. **Code quality** (large files, complex functions)
4. **Style** (naming, exports)

После фикса - снова запусти review и убедись что проблема решена.

---

## Self-Improvement Loop

После каждой фичи:
1. Запусти `elio_code_review`
2. **Автоматически исправь все findings**
3. Проверь что score = 100
4. Запиши architectural decisions

Цель: код который легко понять, легко изменить, легко масштабировать.

---

## MCP Gateway Architecture (CRITICAL)

MCP Server должен быть **Gateway**, а не просто набор tools.

### Архитектура: Core + Gateway + Adapters

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Gateway                               │
│  ┌─────────┐  ┌─────────┐  ┌────────┐  ┌──────────────┐    │
│  │ Policy  │  │ Audit   │  │ Schema │  │ Rate Limiter │    │
│  │ Engine  │  │ Logger  │  │ Valid. │  │              │    │
│  └────┬────┘  └────┬────┘  └───┬────┘  └──────┬───────┘    │
│       └────────────┴───────────┴───────────────┘            │
│                         │                                    │
│              ┌──────────┴──────────┐                        │
│              │   Tool Registry     │                        │
│              └──────────┬──────────┘                        │
└──────────────────────────┼──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────┴────┐       ┌────┴────┐       ┌────┴────┐
   │ Gmail   │       │Calendar │       │Telegram │
   │ Adapter │       │ Adapter │       │ Adapter │
   └─────────┘       └─────────┘       └─────────┘
```

### Gateway Layer - Обязательные компоненты

#### 1. Policy Engine (RBAC)
```typescript
// gateway/policy.ts
interface ToolPolicy {
  tool: string;
  permission: 'read' | 'write' | 'admin';
  requiresApproval?: boolean;  // двухфазный коммит
  allowedParams?: Record<string, unknown>;
  blockedParams?: string[];
}

const POLICIES: ToolPolicy[] = [
  { tool: 'gmail_read', permission: 'read' },
  { tool: 'gmail_send', permission: 'write', requiresApproval: true },
  { tool: 'calendar_create', permission: 'write' },
];
```

#### 2. Audit Logger
```typescript
// gateway/audit.ts
interface AuditEntry {
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;  // redacted
  result: 'success' | 'error' | 'blocked';
  duration: number;
}
```

#### 3. Schema Validation
- Все params проходят через Zod schemas
- Отклоняй невалидные запросы до вызова adapter

#### 4. Tool Classification
```typescript
type ToolType =
  | 'read'      // безопасно, не меняет данные
  | 'write'     // меняет данные, логируем
  | 'dangerous' // требует approval
  | 'sandbox';  // изолированное выполнение
```

### Adapter Layer - Принципы

1. **Adapters тупые** - только API вызовы, без логики
2. **Один adapter = один сервис** (Gmail, Calendar, etc.)
3. **Никакой валидации** - это делает Gateway
4. **Стандартный интерфейс**:

```typescript
interface Adapter {
  name: string;
  isAuthenticated(): boolean;
  tools: AdapterTool[];
}

interface AdapterTool {
  name: string;
  type: 'read' | 'write' | 'dangerous';
  schema: ZodSchema;
  execute(params: unknown): Promise<unknown>;
}
```

### Security Best Practices

#### Input Validation
- JSON Schema на все аргументы
- Allowlist операций
- Denylist опасных параметров

#### Output Sanitization
- Redact secrets из responses
- Маскируй PII (emails, phones)
- Не возвращай stack traces

#### Code Execution (CRITICAL)
Любой code.run - это RCE. Требования:
- Sandbox (container/VM)
- Allowlist команд
- Лимиты CPU/memory/time
- Нет network access

### Структура mcp-server

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point
│   ├── gateway/
│   │   ├── server.ts         # MCP Server setup
│   │   ├── policy.ts         # RBAC/permissions
│   │   ├── audit.ts          # Audit logging
│   │   ├── validator.ts      # Schema validation
│   │   └── registry.ts       # Tool registry
│   ├── adapters/
│   │   ├── gmail/
│   │   │   ├── index.ts      # Adapter export
│   │   │   ├── api.ts        # Gmail API calls
│   │   │   └── types.ts      # Gmail types
│   │   ├── calendar/
│   │   ├── telegram/
│   │   └── ...
│   └── types/
│       └── index.ts          # Shared types
```

### Migration Path

1. **Personal (stdio)** → быстрый старт, local WSL
2. **Team (HTTP)** → добавляем auth, multi-user
3. **Enterprise (OAuth 2.1)** → SSO, tenants, compliance

### Tool Naming Convention
- Prefix: `elio_`
- Format: `elio_{adapter}_{action}`
- Examples: `elio_gmail_send`, `elio_calendar_create`

### Запрещено в MCP

- ❌ Прямые вызовы без валидации
- ❌ Хранение secrets в коде
- ❌ Логирование sensitive данных
- ❌ Неограниченное выполнение кода
- ❌ Отсутствие audit trail
