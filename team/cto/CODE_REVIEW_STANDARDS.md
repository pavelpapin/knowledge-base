# CTO Code Review Standards

Стандарты для ночного code review. CTO проверяет код по этим критериям.

---

## 1. Separation of Concerns (Смешение ответственности)

### Red Flags
- Файл делает > 1 вещи (данные + UI + бизнес-логика)
- Функция > 50 строк
- Класс с > 5 публичных методов
- Import из > 10 модулей
- God object (знает обо всём)

### Паттерны нарушения

```typescript
// ❌ ПЛОХО: Смешение responsibilities
class UserService {
  async createUser(data) {           // Business logic
    const validated = validate(data); // Validation
    await db.insert(validated);       // Data access
    await sendEmail(validated.email); // Side effect
    logger.info('User created');      // Logging
    metrics.increment('users');       // Metrics
    return this.formatResponse(validated); // Presentation
  }
}

// ✅ ХОРОШО: Разделение
class UserService {
  constructor(
    private repo: UserRepository,
    private events: EventBus
  ) {}

  async createUser(data: CreateUserDTO): Promise<User> {
    const user = await this.repo.create(data);
    this.events.emit('user.created', user);
    return user;
  }
}
```

### Как искать

```bash
# Файлы с > 10 imports
grep -l "^import" **/*.ts | xargs -I {} sh -c 'echo "{}: $(grep -c "^import" {})"' | awk -F: '$2 > 10'

# Функции > 50 строк
# Анализировать AST или считать строки между function/const и }
```

### Рефакторинг

1. **Extract Service** — выделить логику в отдельный сервис
2. **Event-Driven** — заменить прямые вызовы на события
3. **Repository Pattern** — отделить data access
4. **DTO/Mapper** — отделить presentation

---

## 2. Single Responsibility Principle

### Каждый файл = одна ответственность

| Тип файла | Ответственность |
|-----------|-----------------|
| `types.ts` | Только типы и интерфейсы |
| `client.ts` | HTTP клиент, авторизация |
| `api.ts` | Бизнес-функции API |
| `repository.ts` | Data access |
| `service.ts` | Бизнес-логика |
| `controller.ts` | HTTP handlers |
| `utils.ts` | Pure functions |
| `config.ts` | Configuration |
| `index.ts` | Re-exports |

### Размеры

| Тип | Max строк | Действие |
|-----|-----------|----------|
| Стандартный | 200 | Split |
| Integration | 300 | Split |
| Config | 100 | Extract |
| Types | 150 | Split by domain |

---

## 3. Dependency Inversion

### Red Flags

```typescript
// ❌ ПЛОХО: Прямая зависимость
import { SupabaseClient } from '@supabase/supabase-js';

class UserService {
  private client = new SupabaseClient(url, key);
}

// ✅ ХОРОШО: Инверсия через интерфейс
interface UserRepository {
  create(data: CreateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
}

class UserService {
  constructor(private repo: UserRepository) {}
}
```

### Как проверять

- Конструктор принимает конкретные классы? → DI нужен
- `new SomeClass()` внутри класса? → Factory нужен
- Import конкретной БД в business logic? → Repository нужен

---

## 4. Code Duplication

### Уровни дублирования

| Уровень | Описание | Действие |
|---------|----------|----------|
| Exact | Идентичный код | Extract function |
| Similar | Похожая структура | Extract + параметризация |
| Semantic | Одна идея, разный код | Абстракция |

### Как искать

```bash
# Похожие строки
jscpd --min-lines 5 --min-tokens 50 ./src

# Похожие функции
# AST анализ с similarity score
```

### Когда НЕ рефакторить

- Дублирование в разных bounded contexts
- < 3 повторений
- Код будет расходиться в будущем

---

## 5. Error Handling

### Red Flags

```typescript
// ❌ ПЛОХО
try {
  await doSomething();
} catch (e) {
  console.log(e); // Silent fail
}

// ❌ ПЛОХО
async function process() {
  const data = await fetch(); // Unhandled rejection
  return transform(data);
}

// ✅ ХОРОШО
async function process(): Promise<Result<Data, ProcessError>> {
  try {
    const data = await fetch();
    return { ok: true, data: transform(data) };
  } catch (error) {
    logger.error('Process failed', { error });
    return { ok: false, error: new ProcessError(error) };
  }
}
```

### Проверки

- [ ] Все async функции обёрнуты в try/catch или .catch()
- [ ] Ошибки логируются с контекстом
- [ ] Нет silent catch (пустой catch block)
- [ ] Есть типизированные error classes
- [ ] External calls имеют timeout

---

## 6. Observability

### Каждый компонент должен иметь

```typescript
// Logging
logger.info('Operation started', { operationId, params });
logger.error('Operation failed', { operationId, error });

// Metrics (optional)
metrics.increment('operation.count');
metrics.timing('operation.duration', durationMs);

// Tracing (optional)
const span = tracer.startSpan('operation');
span.end();
```

### Red Flags

- Функция > 20 строк без логов
- External call без таймаута
- Catch без логирования
- Async operation без tracking

---

## 7. API Design

### Red Flags

```typescript
// ❌ ПЛОХО: Inconsistent
function getUser(id) { return user; }
function fetchUsers() { return users; }
function retrieveUserById(userId) { return user; }

// ✅ ХОРОШО: Consistent
function getById(id: string): Promise<User | null>;
function getAll(): Promise<User[]>;
function create(data: CreateUserDTO): Promise<User>;
function update(id: string, data: UpdateUserDTO): Promise<User>;
function delete(id: string): Promise<void>;
```

### Naming Conventions

| Операция | Prefix |
|----------|--------|
| Read one | `get`, `find` |
| Read many | `list`, `getAll` |
| Create | `create` |
| Update | `update` |
| Delete | `delete`, `remove` |
| Check | `is`, `has`, `can` |
| Transform | `to`, `from`, `parse` |

---

## 8. TypeScript Quality

### Red Flags

```typescript
// ❌ any
function process(data: any) { }

// ❌ Type assertion without validation
const user = data as User;

// ❌ Optional chaining hell
const value = obj?.prop?.nested?.deep?.value;

// ❌ Non-null assertion
const name = user!.name;
```

### Требования

- [ ] Нет `any` (использовать `unknown` + type guard)
- [ ] Нет `as` без runtime validation
- [ ] Max 2 уровня optional chaining
- [ ] `!` только с комментарием почему safe

---

## 9. Refactoring Checklist

### Перед рефакторингом

- [ ] Есть ли тесты?
- [ ] Понятен ли scope изменений?
- [ ] Можно ли откатить?
- [ ] Есть ли зависимые компоненты?

### После рефакторинга

- [ ] Build проходит
- [ ] Тесты проходят
- [ ] Imports обновлены
- [ ] Exports обновлены
- [ ] Документация обновлена

---

## 10. Auto-Fix Rules

### CTO делает автоматически

| Issue | Action |
|-------|--------|
| File > 200 lines | Split into types/client/api/index |
| Function > 50 lines | Extract helpers |
| > 10 imports | Create barrel file |
| Duplicate code (exact) | Extract function |
| Missing types | Add TypeScript types |
| console.log | Replace with logger |
| Hardcoded values | Extract to config |

### CTO предлагает (не делает сам)

| Issue | Action |
|-------|--------|
| Mixed responsibilities | Architectural refactor |
| Missing abstraction | Design pattern |
| Circular dependency | Module restructure |
| Missing tests | Test coverage |

---

## Review Output Format

```json
{
  "review_date": "2026-01-21",
  "files_analyzed": 150,
  "total_issues": 23,

  "by_category": {
    "separation_of_concerns": 5,
    "single_responsibility": 3,
    "dependency_inversion": 2,
    "code_duplication": 4,
    "error_handling": 3,
    "observability": 2,
    "api_design": 1,
    "typescript_quality": 3
  },

  "auto_fixed": [
    {
      "file": "adapters/notion.ts",
      "issue": "File > 200 lines",
      "action": "Split into notion/types.ts, notion/client.ts, notion/api.ts, notion/index.ts",
      "commit": "abc123"
    }
  ],

  "proposed": [
    {
      "file": "services/user.ts",
      "issue": "Mixed responsibilities",
      "suggestion": "Extract UserRepository, add EventBus for side effects",
      "priority": "P1",
      "effort": "M"
    }
  ],

  "metrics": {
    "avg_file_size": 120,
    "max_file_size": 450,
    "files_over_limit": 3,
    "functions_over_limit": 7,
    "any_count": 12,
    "todo_count": 25
  }
}
```

---

## Integration with Nightly Workflow

1. **Day Review** собирает git changes
2. **CTO** читает changes и применяет эти стандарты
3. **Auto-fix** для простых issues
4. **Propose** для сложных (добавляет в backlog)
5. **Consilium** если нужен multi-model review

---

## 11. Infrastructure & DevOps Standards

### Resource Monitoring

Каждую ночь CTO проверяет состояние инфраструктуры:

| Resource | Warning | Critical | Auto-Fix |
|----------|---------|----------|----------|
| Disk | >70% | >85% | Clear caches |
| RAM | >80% | >90% | Alert |
| Swap | >50% | >70% | Alert |
| OOM Kills | >0 | - | Investigate |

### Process Management

**Требования к production процессам:**

```ini
# Каждый сервис ДОЛЖЕН иметь systemd unit с:
[Service]
# 1. Auto-restart
Restart=on-failure
RestartSec=10

# 2. Resource limits
MemoryAccounting=yes
MemoryMax=2G
CPUQuota=80%

# 3. OOM protection
OOMScoreAdjust=-500
```

### Disk Cleanup Policy

**Auto-cleanup при disk >85%:**

| Directory | Max Age | Action |
|-----------|---------|--------|
| `~/.cache/pip/` | 7 days | Delete |
| `~/.cache/ms-playwright/` | 30 days | Delete if unused |
| `~/.npm/_cacache/` | 14 days | Trim |
| `/var/log/journal/` | 7 days | Vacuum |
| `/tmp/` | 1 day | Clear |

### Health Check Endpoints

**Каждый сервис ДОЛЖЕН экспонировать:**

```typescript
// GET /health
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  checks: {
    database: boolean;
    memory: boolean;  // RSS < 80% of limit
    dependencies: boolean;
  };
}
```

### OOM Prevention Checklist

- [ ] `vm.overcommit_memory=2` in sysctl.conf
- [ ] Memory limits set for all services
- [ ] OOM score adjusted for critical processes
- [ ] Swap configured as safety net
- [ ] Monitoring alerts at 80% RAM

### Infrastructure Review Output

```json
{
  "infrastructure_health": {
    "status": "warning",
    "disk_percent": 45,
    "ram_percent": 67,
    "swap_percent": 42,
    "oom_kills_24h": 0,
    "failed_services": 0
  },
  "process_compliance": {
    "services_with_limits": 3,
    "services_without_limits": 1,
    "services_protected_oom": 2
  },
  "recommendations": [
    "Set memory limit for mcp-server",
    "RAM usage trending high - monitor"
  ]
}
```

---

*Last updated: 2026-01-22*
