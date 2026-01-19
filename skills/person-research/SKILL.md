# Skill: person-research

## Purpose
Сбор информации о человеке из открытых источников (OSINT).

## When to Use
- Подготовка к встрече/звонку
- Персонализация outreach
- Проверка контакта
- Обновление записи в CRM/context

## Inputs
- `name` (required): Имя человека (желательно полное)
- `context` (optional): Дополнительный контекст
  - Компания
  - Должность
  - Город/страна
  - Email или LinkedIn URL
- `sources` (optional, default: all): Источники поиска
  - `linkedin` - профиль LinkedIn
  - `twitter` - Twitter/X
  - `github` - GitHub
  - `web` - общий веб-поиск

## Outputs
```json
{
  "profile": {
    "name": "Full Name",
    "title": "Current Position",
    "company": "Company Name",
    "location": "City, Country",
    "bio": "Summary",
    "experience": [...],
    "education": [...],
    "skills": [...],
    "interests": [...],
    "contact": {
      "email": "...",
      "linkedin": "...",
      "twitter": "..."
    }
  },
  "sources": [
    { "type": "linkedin", "url": "...", "confidence": 0.95 }
  ],
  "talking_points": [
    "Общие интересы",
    "Недавние достижения",
    "Возможные темы"
  ]
}
```

## Algorithm
1. Нормализовать имя
2. Если есть LinkedIn URL - начать с него
3. Поиск в LinkedIn через Proxycurl
4. Поиск в Twitter/X
5. Поиск в GitHub
6. Общий веб-поиск для дополнения
7. Объединить данные, разрешить конфликты
8. Сгенерировать talking points

## Examples

### С контекстом компании
```bash
./run.sh --name "John Smith" --context "CEO at TechStartup, San Francisco"
```

### По LinkedIn URL
```bash
./run.sh --name "John Smith" --context "linkedin.com/in/johnsmith"
```

## Integrations
- `linkedin` - Proxycurl API
- `perplexity` - веб-поиск
- `web-search` - общий поиск

## Error Handling
- Множественные совпадения - запросить уточнение
- Нет результатов - расширить поиск
- Rate limits - очередь запросов
- Timeout: 5 минут

## Notes
- Использовать этично, только публичная информация
- Сохранять в context/people/ для будущего использования
- Обновлять профиль раз в месяц
- Не хранить чувствительные данные
