# Agent: {NAME}

## Identity
{Краткое описание агента в 1-2 предложениях}

## Trigger
- "{trigger phrase 1}"
- "{trigger phrase 2}"
- "/{command}"

## Inputs
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| param1 | string | yes | - | Description |
| param2 | enum | no | value | option1/option2/option3 |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| result | notion_page | Final deliverable |

---

## Workflow

### ⛔ Stage Gates (ОБЯЗАТЕЛЬНО!)

**ЗАПРЕЩЕНО переходить к следующей стадии без завершения предыдущей!**

| From | To | Gate Condition |
|------|----|----------------|
| Start | Stage 0 | - |
| Stage 0 | Stage 1 | Task Brief ПОДТВЕРЖДЁН пользователем |
| Stage 1 | Stage 2 | [условие] |
| Stage N | Done | Deliverable ВЕРИФИЦИРОВАН |

---

### Stage 0: Discovery (ОБЯЗАТЕЛЬНО!)

**Purpose:** Понять задачу и собрать требования от пользователя

**⛔ БЛОКЕР: Нельзя переходить к Stage 1 без ответов на ВСЕ вопросы!**

**ОБЯЗАТЕЛЬНЫЕ ВОПРОСЫ:**

1. **Цель** - Какое решение хочешь принять на основе результата?
2. **Success Criteria** - Что для тебя "успешный результат"?
3. **Scope** - Что включить, что исключить?
4. **Формат** - Notion page? Google Doc? Другое?
5. **Ограничения** - Сроки, бюджет, другие constraints?

**Actions:**
- Задать ВСЕ вопросы выше
- Дождаться ответов
- Сформировать Task Brief
- ПОДТВЕРДИТЬ Task Brief с пользователем

**Output:** Task Brief
```json
{
  "task": "{description}",
  "goal": "{user goal}",
  "success_criteria": ["..."],
  "scope": {"include": [...], "exclude": [...]},
  "format": "notion_page",
  "constraints": {...},
  "confirmed_by_user": true  // ⛔ БЕЗ ЭТОГО НЕ ПЕРЕХОДИТЬ!
}
```

**⛔ GATE CHECK:** "Task Brief готов. Подтверждаешь? Можно начинать работу?"

---

### Stage 1: {Stage Name}

**Purpose:** {что делает этот стейдж}

**Input:** Task Brief from Stage 0

**Actions:**
1. Step one
2. Step two
3. Step three

**Output:** {что возвращает стейдж}

**⛔ GATE CHECK:** {условие перехода к следующему стейджу}

---

### Stage 2: {Stage Name}

**Purpose:** {что делает этот стейдж}

**Input:** Output from Stage 1

**Actions:**
1. Step one
2. Step two

**Output:** {что возвращает стейдж}

**⛔ GATE CHECK:** {условие перехода}

---

### Stage N: Verification (ОБЯЗАТЕЛЬНО последний!)

**Purpose:** Проверить что deliverable создан и корректен

**Actions:**
1. Проверить что deliverable существует (URL/path)
2. Проверить что deliverable соответствует Task Brief
3. Проверить Success Criteria

**Output:** Verified deliverable URL

**⛔ GATE CHECK:**
- [ ] Deliverable существует
- [ ] Deliverable доступен по URL
- [ ] Success criteria выполнены

---

## MCP Tools Used
- `tool_name` - why it's used
- `tool_name` - why it's used

## Example

**Input:**
```
{example trigger}
```

**Discovery Questions:**
```
1. Цель: ...
2. Success Criteria: ...
...
```

**Task Brief:**
```json
{
  "task": "...",
  "confirmed_by_user": true
}
```

**Output:**
```
✅ Completed: {agent_name}
🔗 Result: https://notion.so/...
```

## Configuration
```json
{
  "stages": [
    {"name": "Discovery", "timeout": 0},
    {"name": "Stage1", "timeout": 60000},
    {"name": "Verification", "timeout": 30000}
  ],
  "notifications": {
    "onStart": true,
    "onStageChange": true,
    "onComplete": true,
    "onError": true
  }
}
```

## Error Handling
- Error case 1 → Fallback action
- Error case 2 → Fallback action

## Logs
`/root/.claude/logs/agents/{name}/`
