# Ночной Цикл Elio OS

**Время:** 00:00 - 02:00 Tbilisi (20:00 - 22:00 UTC)

---

## Общая Картина

```
00:00  Day Review    собирает данные
         ↓
00:30  CTO              анализирует техническое состояние
         ↓
01:00  CPO              анализирует качество продукта
         ↓
01:30  CEO              принимает решения
         ↓
утро   Готовые решения  пользователь просыпается и видит
```

---

## 1. Day Review (00:00)

### Что делает
Собирает сырые данные за день в один JSON файл.

### Собирает
| Данные | Источник | Зачем |
|--------|----------|-------|
| Ошибки | `/logs/errors/`, MCP logs | CTO нужно знать что сломалось |
| Git changes | `git log --since="24h"` | CTO видит что менялось |
| Conversations | `/logs/daily/` | CPO видит что просил пользователь |
| Workflow runs | `system-loop-state.json` | Все видят что запускалось |
| System metrics | disk, memory, redis | CTO видит здоровье системы |
| API health | ping каждого API | CTO видит что работает |

### Output
```
/root/.claude/logs/daily/{date}/day-summary.json
```

### Проблемы сейчас
1. ❌ **Нет реального кода** — только WORKFLOW.md с описанием
2. ❌ **Conversations не собираются** — нет логирования разговоров
3. ❌ **Corrections не логируются** — теряем важный feedback

---

## 2. CTO (00:30)

### Что делает
Технический анализ системы + решает нужен ли consilium.

### Читает от Day Review
- `errors.total` → много ошибок?
- `errors.by_source` → где проблемы?
- `git.files_changed` → что менялось?
- `system.*` → система здорова?
- `api_health.*` → интеграции работают?

### Свои проверки
1. **Health Check** — все интеграции живы?
2. **Architecture Review** — есть ли проблемы в коде?
3. **Security Scan** — есть ли уязвимости?
4. **Auto-Fix** — исправляет lint, types, мелочи

### Ключевое решение
```
Запускать consilium (multi-model review)?

ДА если:
- Security issues (critical/high)
- Изменения > 3 файлов
- Новые зависимости
- Breaking changes
- Errors > 10 за день
```

### Output
- Report в Notion + Telegram
- Задачи в CTO Backlog
- Коммиты auto-fix'ов

### Проблемы сейчас
1. ❌ **Не читает day-summary.json** — не использует собранные данные
2. ❌ **Consilium не реализован** — решение принимается, но не запускается
3. ⚠️ **Backlog tools не существуют** — `backlog_create`, `backlog_update` не реализованы

---

## 3. CPO (01:00)

### Что делает
Анализирует качество продукта через призму пользователя.

### Читает от Day Review
- `conversations.*` → что просил пользователь?
- `conversations.corrections` → где ошибся?
- `conversations.feedback` → доволен/недоволен?

### Свои проверки
1. **Collect Feedback** — собрать жалобы, запросы, corrections
2. **Analyze Quality** — оценить accuracy, completeness
3. **Build Failure Typology** — категоризировать ошибки
4. **Create Eval Sets** — создать тесты для компонентов

### Output
- Report в Notion + Telegram
- Improvements в CPO Backlog
- Eval sets в `/core/eval/`

### Проблемы сейчас
1. ❌ **Нет данных для анализа** — conversations не логируются
2. ❌ **Eval sets не существуют** — `/core/eval/` пустой
3. ❌ **Quality metrics не собираются** — нечем измерять
4. ⚠️ **Backlog tools не существуют**

---

## 4. CEO (01:30)

### Что делает
Принимает стратегические решения, даёт задачи CTO/CPO.

### Читает от CTO/CPO
- CTO Report → что с техникой?
- CPO Report → что с качеством?
- Backlogs → что в работе?

### Свои проверки
1. **Understand State** — где мы относительно цели?
2. **Make Decisions** — что делаем, что режем?
3. **Assign to Team** — задачи CTO и CPO
4. **Cut & Prioritize** — резать zombie tasks

### Output
- Report в Notion + Telegram
- Задачи в backlogs CTO/CPO
- Изменённые приоритеты

### Проблемы сейчас
1. ⚠️ **Зависит от CTO/CPO reports** — если они не создались, нечего читать
2. ❌ **philosophy.md может быть устаревшим** — цели не актуализируются
3. ❌ **Backlog tools не существуют**

---

## Критические Проблемы

### 1. Нет логирования разговоров
CPO не может анализировать feedback, потому что разговоры не сохраняются.

**Решение:** Добавить hook на каждое сообщение → сохранять в `/logs/daily/{date}/conversations.jsonl`

### 2. Backlog tools не реализованы
Все три роли используют `backlog_create`, `backlog_update`, но этих tools нет.

**Решение:** Создать MCP adapter для backlog операций в БД.

### 3. Day Review только описан
Есть WORKFLOW.md, но нет кода который реально собирает данные.

**Решение:** Нужен скрипт или workflow runner который выполняет шаги.

### 4. Агенты не читают друг друга
CTO не читает day-summary.json. CPO не читает CTO report. Нет цепочки.

**Решение:** Добавить в prompt каждого агента явное чтение output предыдущего.

### 5. Consilium не реализован
CTO принимает решение "запустить consilium", но multi-model review не запускается.

**Решение:** Реализовать consilium workflow с вызовом разных моделей.

---

## Предложения по Улучшению

### A. Минимальные (чтобы работало)

1. **Conversation Logger**
   - Hook на user messages
   - Сохранять в JSONL
   - Включить corrections detection

2. **Backlog MCP Adapter**
   - CRUD для backlog_items таблицы
   - Tools: `backlog_create`, `backlog_list`, `backlog_update`, `backlog_complete`

3. **Day Review Script**
   - TypeScript скрипт вместо "agenta который прочитает md"
   - Реальный сбор данных
   - Сохранение в JSON

4. **Chain Reading**
   - В prompt CTO: "Прочитай /logs/daily/{date}/day-summary.json"
   - В prompt CPO: "Прочитай /logs/team/cto/{date}.md"
   - В prompt CEO: "Прочитай /logs/team/cto/ и /logs/team/cpo/"

### B. Средние (улучшение качества)

5. **Eval Sets Infrastructure**
   - Структура для eval sets
   - Runner для проверки качества
   - Метрики: accuracy, completeness, etc.

6. **Consilium Implementation**
   - Multi-model call (Claude, GPT-4, Groq)
   - Vote aggregation
   - Auto-fix для согласованных issues

7. **Report Templates**
   - Стандартизированные JSON reports
   - Парсинг для следующего агента
   - Notion templates

### C. Продвинутые (масштабирование)

8. **Real-time Dashboard**
   - Веб-интерфейс с метриками
   - История reports
   - Trend графики

9. **Feedback Loop**
   - Автоматическое создание issues из failures
   - Tracking resolution
   - Impact measurement

---

## Новый Порядок Действий

### Ночь (автоматически)

```
00:00  Day Review
       ├── Читает: logs, git, system
       ├── Пишет: /logs/daily/{date}/day-summary.json
       └── Notify: краткий summary в Telegram

00:30  CTO
       ├── Читает: day-summary.json
       ├── Делает: health check, architecture review, security scan
       ├── Auto-fix: lint, types, small issues
       ├── Решает: нужен ли consilium?
       ├── Пишет: /logs/team/cto/{date}.md, Notion
       └── Notify: CTO report в Telegram

01:00  CPO
       ├── Читает: day-summary.json (conversations), CTO report
       ├── Делает: quality analysis, failure typology
       ├── Обновляет: eval sets
       ├── Пишет: /logs/team/cpo/{date}.md, Notion
       └── Notify: CPO report в Telegram

01:30  CEO
       ├── Читает: CTO report, CPO report, backlogs
       ├── Делает: strategic decisions, task assignment
       ├── Обновляет: priorities, cuts scope
       ├── Пишет: /logs/team/ceo/{date}.md, Notion
       └── Notify: CEO report в Telegram

02:00  [Опционально] Consilium
       ├── Если CTO решил запустить
       ├── Multi-model review
       └── Auto-fix согласованных issues
```

### Утро (пользователь)

```
08:00  Standup
       ├── Читает: все ночные reports
       ├── Формирует: consolidated summary
       └── Notify: Telegram с highlights

Пользователь просыпается и видит:
- Что сделала система ночью
- Какие решения приняты
- Что нужно approve/review
```

---

## Приоритеты Реализации

### Phase 1: Минимум для работы (1-2 дня)
1. [ ] Conversation Logger (hook)
2. [ ] Day Review script (ts)
3. [ ] Chain reading в prompts
4. [ ] Backlog MCP adapter

### Phase 2: Качество (3-5 дней)
5. [ ] Eval sets infrastructure
6. [ ] Consilium basic implementation
7. [ ] Report templates

### Phase 3: Polish (1 неделя)
8. [ ] Dashboard
9. [ ] Feedback loop automation
10. [ ] Metrics tracking

---

## Метрики Успеха

| Метрика | Сейчас | Цель |
|---------|--------|------|
| Ночной цикл работает | ❌ | ✅ каждую ночь |
| Reports создаются | частично | все 4 в Notion |
| Данные передаются по цепочке | ❌ | ✅ JSON читается |
| Backlog обновляется | ❌ | ✅ автоматически |
| Пользователь видит результат утром | ❌ | ✅ Telegram summary |
