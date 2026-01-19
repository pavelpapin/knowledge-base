# Elio Engineering Standards 2026

## CTO Directive: Modern Scalable Architecture

Мы строим системы будущего, а не легаси 2010-х годов. Все решения должны быть:
- Масштабируемыми
- Модульными
- Современными
- Типизированными

---

## Code Standards

### File Size Limits (CRITICAL)
- **MAX 200 строк на файл** - если больше, разбивай
- **MAX 50 строк на функцию** - если больше, декомпозируй
- **MAX 10 методов на класс** - если больше, выдели абстракцию
- **Дублирование > 2 раз** - выноси в утилиту

### Language & Stack
- **TypeScript ONLY** - никакого чистого JavaScript
- **Strict mode** - всегда `"strict": true` в tsconfig
- **ES2022+** - используй современный синтаксис
- **Async/await** - никаких callback hell

### Project Structure
```
src/
├── index.ts          # Entry point ONLY (< 50 lines)
├── types/            # Type definitions
├── config/           # Configuration
├── services/         # Business logic
├── handlers/         # Request handlers
├── utils/            # Pure utility functions
└── managers/         # State managers
```

### Naming Conventions
- **Files**: kebab-case (`user-service.ts`)
- **Classes**: PascalCase (`UserService`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE (`MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (`UserProfile`)

### Import Order
1. Node.js built-ins (`fs`, `path`, `crypto`)
2. External packages (`express`, `lodash`)
3. Internal absolute (`@/services/user`)
4. Internal relative (`./utils`, `../types`)

---

## Architecture Principles

### Single Responsibility
Каждый модуль делает ОДНО дело хорошо.
- `services/` - бизнес-логика
- `handlers/` - обработка запросов
- `utils/` - чистые функции без side effects
- `types/` - только типы, без логики

### Dependency Injection
Не хардкодь зависимости. Передавай через параметры или конструкторы.

### Error Handling
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

### Async Patterns
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

---

## After Every Task: Self-Review Checklist

После КАЖДОЙ задачи проверь:

1. **File sizes** - есть файлы > 200 строк? Разбей.
2. **Function sizes** - есть функции > 50 строк? Декомпозируй.
3. **Duplication** - есть копипаст? Вынеси в утилиту.
4. **Types** - всё типизировано? Нет `any`?
5. **Naming** - имена понятны без комментариев?
6. **Tests** - основная логика покрыта?

---

## Refactoring Triggers

Запускай рефакторинг когда:
- Файл превысил 200 строк
- Функция превысила 50 строк
- Появилось 3+ похожих блока кода
- Модуль имеет > 5 зависимостей
- Сложно понять что делает код без комментариев

---

## Forbidden Patterns

НИКОГДА не делай:
- `any` типы (используй `unknown` + type guards)
- `var` (только `const` и `let`)
- Вложенность > 3 уровней
- God objects (классы которые делают всё)
- Magic numbers (выноси в константы)
- Console.log в production (используй logger)
- Синхронный IO в async контексте

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

## Self-Improvement Loop

После каждой фичи:
1. Проверь checklist выше
2. Если нашёл проблемы - сразу исправь
3. Подумай какое следующее архитектурное улучшение
4. Запиши decision в memory

Цель: код который легко понять, легко изменить, легко масштабировать.
