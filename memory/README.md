# Elio Memory System

Долгосрочная память для хранения знаний между сессиями.

## Структура

```
memory/
├── facts.jsonl       # Общие факты и знания
├── people/           # Профили людей
│   └── {name}.json
├── projects/         # Контекст проектов
│   └── {project}.json
└── conversations/    # Важные выводы из разговоров
```

## Формат facts.jsonl

Каждая строка - отдельный факт:

```json
{"id": "uuid", "created": "2024-01-19", "category": "preference", "content": "Pasha предпочитает короткие ответы", "source": "conversation", "confidence": 0.9}
{"id": "uuid", "created": "2024-01-19", "category": "fact", "content": "Nebius Academy - B2B AI education", "source": "user", "confidence": 1.0}
```

## Формат people/{name}.json

```json
{
  "name": "Stepan Gershuni",
  "aliases": ["sgershuni", "Степан"],
  "first_seen": "2024-01-15",
  "last_updated": "2024-01-19",
  "relationship": "contact",
  "context": "Crypto/AI thought leader",
  "facts": [
    {"date": "2024-01-19", "fact": "Ведёт канал @cryptoEssay"}
  ],
  "links": {
    "telegram": "@sgershuni",
    "twitter": "sgershuni"
  },
  "notes": ""
}
```

## Формат projects/{project}.json

```json
{
  "name": "Elio",
  "created": "2024-01-19",
  "description": "AI Operating System with Claude as brain",
  "status": "active",
  "goals": [
    "Autonomous agent orchestration",
    "Multi-source research",
    "Persistent memory"
  ],
  "architecture": {
    "brain": "Claude Code CLI",
    "interface": "Telegram bot",
    "skills": ["youtube-transcript", "person-research", "deep-research"]
  },
  "decisions": [
    {"date": "2024-01-19", "decision": "Use spawn() instead of exec() for Claude CLI"}
  ],
  "todo": []
}
```

## API

```javascript
const Memory = require('./memory-manager');

// Add fact
Memory.addFact('preference', 'User prefers Russian language');

// Get person
const person = Memory.getPerson('Stepan Gershuni');

// Update project
Memory.updateProject('elio', { status: 'active' });

// Search
const results = Memory.search('AI agents');
```
