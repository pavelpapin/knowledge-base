# Skill: deep-research

## Purpose
Многоагентная система глубокого исследования темы с планированием, сбором данных, анализом и синтезом отчета.

## When to Use
- Нужен комплексный обзор темы
- Требуется структурированный отчет
- Много источников для анализа
- Важна верификация фактов

## Inputs
- `topic` (required): Тема для исследования
- `depth` (optional, default: "medium"): Глубина исследования
  - `quick` - 3 подтемы, базовый анализ
  - `medium` - 5 подтем, стандартный анализ
  - `deep` - 7+ подтем, глубокий анализ с верификацией
- `output` (optional, default: "markdown"): Формат вывода
  - `markdown` - MD файл
  - `notion` - страница в Notion
  - `notebooklm` - источники для NotebookLM
  - `slides` - презентация

## Outputs
```json
{
  "job": {
    "id": "research-xxx",
    "status": "completed",
    "plan": { "subtopics": [...], "questions": [...] },
    "sources": [...],
    "findings": [...],
    "report": "..."
  },
  "report_path": "/path/to/report.md"
}
```

## Algorithm

### Phase 1: Planning (Planner Agent)
1. Разбить тему на подтемы
2. Сформулировать ключевые вопросы
3. Определить типы источников
4. Создать план исследования

### Phase 2: Retrieval (Retrieval Agent)
1. Поиск веб-источников
2. Поиск видео (YouTube)
3. Поиск научных статей
4. Сбор и дедупликация

### Phase 3: Analysis (Analysis Agent)
1. Извлечение ключевых фактов
2. Категоризация по подтемам
3. Выявление паттернов
4. Оценка достоверности

### Phase 4: Synthesis (Synthesis Agent)
1. Структурирование отчета
2. Написание секций
3. Добавление цитат и ссылок
4. Формулировка выводов

### Phase 5: Verification (optional)
1. Проверка фактов
2. Кросс-валидация источников
3. Пометка неподтвержденного

## Examples

### Быстрое исследование
```bash
./run.sh --topic "AI agents market 2025" --depth quick
```

### Глубокое исследование для отчета
```bash
./run.sh --topic "MCP protocol ecosystem" --depth deep --output notion
```

## Integrations
- `perplexity` - веб-поиск
- `youtube-transcript` - видео
- `notion` - экспорт
- `notebooklm` - источники

## Error Handling
- Если источников мало - расширить запросы
- Timeout на каждую фазу
- Partial results при ошибках
- Логирование в /logs/skills/deep-research/

## Notes
- Для коротких вопросов использовать web-search
- Результаты кэшируются 24 часа
- Ресурсоемкая операция (5-15 минут)
