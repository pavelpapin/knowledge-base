# Skill: web-search

## Purpose
Поиск информации в интернете через различные поисковые системы.

## When to Use
- Нужно найти актуальную информацию
- Проверить факты
- Найти ссылки на источники
- Начать исследование темы

## Inputs
- `query` (required): Поисковый запрос
- `num_results` (optional, default: 10): Количество результатов
- `site` (optional): Ограничить поиск доменом (например, site:github.com)

## Outputs
```json
{
  "results": [
    {
      "title": "Заголовок",
      "url": "https://...",
      "snippet": "Описание"
    }
  ]
}
```

## Algorithm
1. Получить поисковый запрос
2. Если указан site - добавить site: к запросу
3. Выполнить поиск через Perplexity API или встроенный WebSearch
4. Отфильтровать нерелевантные результаты
5. Вернуть топ-N результатов

## Examples

### Простой поиск
```bash
./run.sh --query "AI agents frameworks 2025"
```

### Поиск на конкретном сайте
```bash
./run.sh --query "MCP protocol" --site "anthropic.com"
```

## Integrations
- `perplexity` - основной поисковый движок
- Claude WebSearch - fallback

## Error Handling
- Если Perplexity недоступен - использовать WebSearch
- При пустых результатах - переформулировать запрос
- Timeout: 60 секунд

## Notes
- Результаты могут быть неактуальными
- Для глубокого исследования использовать deep-research
- Проверять источники перед использованием
