# Elio Skills Registry

Skills - это модульные возможности, которые Elio может использовать для выполнения задач.

## Структура skill

```
skills/
├── skill-name/
│   ├── skill.json    # Метаданные и конфигурация
│   ├── run.sh        # Точка входа (bash)
│   └── run.js        # Или JavaScript
```

## Формат skill.json

```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "Что делает этот skill",
  "author": "elio",
  "entrypoint": "run.sh",
  "inputs": {
    "url": {
      "type": "string",
      "required": true,
      "description": "URL для обработки"
    }
  },
  "outputs": {
    "result": {
      "type": "string",
      "description": "Результат выполнения"
    }
  },
  "dependencies": ["curl", "jq"],
  "timeout": 300,
  "tags": ["research", "youtube"]
}
```

## Вызов skill

```bash
# Из командной строки
/root/.claude/skills/youtube-transcript/run.sh "https://youtube.com/..."

# Или через Elio
elio skill youtube-transcript --url "https://..."
```

## Доступные skills

См. подпапки в этой директории.
