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

## Workflow

### Phase 1: {Phase Name}
```
Input: {what comes in}
Output: {what comes out}

Steps:
1. Step one
2. Step two
3. Step three
```

### Phase 2: {Phase Name}
```
...
```

## MCP Tools Used
- `tool_name` - why it's used
- `tool_name` - why it's used

## Example

**Input:**
```
{example input}
```

**Output:**
```
{example output}
```

## Configuration
```json
{
  "setting1": "value1",
  "setting2": "value2"
}
```

## Error Handling
- Error case 1 → Fallback action
- Error case 2 → Fallback action

## Logs
`/root/.claude/logs/agents/{name}/`
