# Elio Agents

Агенты - это автономные multi-step процессы для сложных задач.

## Available Agents

| Agent | Description | Trigger |
|-------|-------------|---------|
| [deep-research](deep-research/AGENT.md) | Глубокое исследование темы | "deep research про X" |
| [tz-builder](tz-builder/AGENT.md) | Создание ТЗ на агентов | "создай ТЗ на агента X" |

## How to Use

### From Telegram
```
deep research про AI agents 2026
```

### From Claude Code
```
Запусти агента deep-research с темой "AI agents 2026"
```

## Agent Structure

```
agents/
├── {agent-name}/
│   ├── AGENT.md      # Полное описание
│   ├── WORKFLOW.md   # Детальный workflow (опционально)
│   └── agent.json    # Конфигурация
└── _templates/       # Шаблоны для новых агентов
```

## Creating New Agents

1. Используй TZ-Builder:
   ```
   создай ТЗ на агента для {описание}
   ```

2. Или вручную:
   ```
   mkdir /root/.claude/agents/{name}
   # Создай AGENT.md по шаблону из _templates
   ```

## Agent vs Skill

| Aspect | Agent | Skill |
|--------|-------|-------|
| Complexity | Multi-step, autonomous | Single operation |
| Duration | Minutes to hours | Seconds to minutes |
| State | Has state, can pause/resume | Stateless |
| Example | Deep Research, TZ Builder | Web Search, YouTube Transcript |
