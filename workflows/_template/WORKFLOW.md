# Workflow: {workflow-name}

## Purpose
{Что делает этот workflow и когда использовать}

## Trigger
- **Type**: manual | scheduled | event
- **Schedule**: {cron expression if scheduled}
- **Event**: {event name if event-driven}

## Prerequisites
- {Prerequisite 1}
- {Prerequisite 2}

## Steps

### 1. {Step Name}
- **Action**: {what to do}
- **Skill**: {skill_name} (optional)
- **Input**: {source of data}
- **Output**: {where to save}
- **On Error**: {action}

### 2. {Step Name}
- **Action**: {what to do}
- **Condition**: {when to execute}
- **Skill**: {skill_name}

### N. Human Review (if needed)
- **Action**: Ask user for approval
- **Show**: {what to show user}
- **On Approve**: {next step}
- **On Reject**: {action}

## Output
{Final output of the workflow}

## Logging
- Log to: `/root/.claude/logs/workflows/{workflow-name}/`
- Log format: `{date}_{id}.json`

## Error Handling
| Error | Action |
|-------|--------|
| {error1} | {action} |

## Example Run
```
1. Trigger: {how triggered}
2. Step 1: {what happened}
3. ...
4. Result: {final result}
```
