# Skill: youtube-transcript

## Purpose
Скачивание и обработка транскриптов YouTube видео.

## When to Use
- Нужен текст из видео
- Анализ контента видео без просмотра
- Источник для deep-research
- Создание конспекта

## Inputs
- `url` (required): URL YouTube видео
- `language` (optional, default: "auto"): Язык субтитров
  - `ru` - русский
  - `en` - английский
  - `auto` - автоопределение

## Outputs
```json
{
  "title": "Video Title",
  "channel": "Channel Name",
  "duration": 3600,
  "transcript": "Full transcript text...",
  "segments": [
    { "start": 0, "end": 10, "text": "..." }
  ],
  "language": "en"
}
```

## Algorithm
1. Извлечь video ID из URL
2. Получить метаданные (yt-dlp --dump-json)
3. Скачать субтитры (приоритет: manual > auto)
4. Выбрать нужный язык
5. Очистить от таймкодов и тегов
6. Вернуть чистый текст

## Examples

### Базовое использование
```bash
./run.sh --url "https://youtube.com/watch?v=xxx"
```

### С указанием языка
```bash
./run.sh --url "https://youtu.be/xxx" --language "en"
```

## Integrations
- Standalone (использует yt-dlp)
- Используется в: deep-research

## Error Handling
- Нет субтитров - вернуть ошибку с предложением audio transcription
- Приватное видео - ошибка доступа
- Age-restricted - попробовать с cookies
- Timeout: 2 минуты

## Notes
- yt-dlp должен быть установлен
- Некоторые видео без субтитров
- Auto-generated субтитры менее точные
- Для длинных видео (>2h) может быть медленно
