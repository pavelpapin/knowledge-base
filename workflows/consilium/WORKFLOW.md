# Workflow: Consilium (Multi-Model Review)

**Purpose:** Получить второе мнение от разных AI моделей для критических решений.

**Trigger:** Вызывается CTO когда выполняются критерии Stage 5.

---

## Когда запускается

CTO решает запустить consilium если ANY:
1. Security issues (critical/high)
2. Архитектурные изменения > 3 файлов
3. Новые зависимости добавлены
4. Breaking changes в interfaces
5. Errors > 10 за день

---

## Стадии

### Stage 1: Prepare Context

**Input от CTO:**
```json
{
  "reason": "security|architecture|dependencies|breaking|errors",
  "focus_areas": ["path/to/file1.ts", "path/to/file2.ts"],
  "context": "Brief description of what to review"
}
```

**Actions:**
1. Собрать содержимое focus_areas файлов
2. Собрать git diff за день
3. Подготовить общий контекст

---

### Stage 2: Claude Analysis

**Model:** Claude (current session)

**Prompt:**
```
Review the following code/changes for:
1. Security vulnerabilities
2. Architectural issues
3. Performance concerns
4. Best practices violations

{context}

Provide structured feedback with severity (critical/high/medium/low).
```

**Output:**
```json
{
  "model": "claude",
  "findings": [
    {
      "severity": "high",
      "category": "security",
      "file": "...",
      "line": 42,
      "issue": "...",
      "suggestion": "..."
    }
  ],
  "summary": "..."
}
```

---

### Stage 3: OpenAI Analysis (via Perplexity or direct)

**Model:** GPT-4 via Perplexity API

**Prompt:** Same as Claude but through `elio_perplexity_search` with code review focus.

**Note:** If direct OpenAI not available, use Perplexity's GPT-4 mode or skip.

---

### Stage 4: Groq Analysis (optional)

**Model:** Llama via Groq

**Note:** Fast but less accurate. Use for sanity check.

---

### Stage 5: Vote Aggregation

**Logic:**
```
For each finding:
  - If 2+ models agree → HIGH CONFIDENCE
  - If 1 model only → REVIEW NEEDED
  - If contradicting → FLAG FOR HUMAN

Priority = max(all_models_severity)
```

**Output:**
```json
{
  "consensus": [
    {
      "issue": "...",
      "agreed_by": ["claude", "gpt4"],
      "severity": "high",
      "confidence": "high",
      "action": "auto_fix|propose|escalate"
    }
  ],
  "disagreements": [
    {
      "issue": "...",
      "claude_says": "...",
      "gpt4_says": "...",
      "action": "human_review"
    }
  ]
}
```

---

### Stage 6: Apply Safe Fixes

**What to auto-fix:**
- Issues with HIGH confidence AND severity < high
- Formatting, types, lint issues
- Clear security fixes (e.g., sanitization)

**What to propose:**
- Issues with HIGH confidence AND severity >= high
- Architectural changes
- Anything with disagreements

**Rules:**
- Each fix = separate commit
- Run tests after each fix
- Rollback if tests fail

---

### Stage 7: Generate Report

**Format:**
```markdown
# Consilium Report — {date}

## 🎯 Trigger
- Reason: {reason}
- Focus: {files}

## 🤖 Models Used
- Claude: ✅
- GPT-4: ✅
- Groq: ❌ (skipped)

## 🔍 Findings Summary

### High Confidence (all models agree)
| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 1 | High | SQL injection in query.ts:42 | Auto-fixed |
| 2 | Medium | Missing error handling | Proposed |

### Disagreements (need review)
| # | Claude | GPT-4 | Decision |
|---|--------|-------|----------|
| 1 | "Refactor needed" | "Code is fine" | Human review |

## ✅ Actions Taken
- Auto-fixed: 3 issues
- Proposed: 2 issues (in backlog)
- Escalated: 0 issues

## 📊 Metrics
- Total findings: 12
- Agreement rate: 75%
- Auto-fix rate: 25%
```

---

### Stage 8: Deliver

**Actions:**
1. Save report to `/root/.claude/logs/consilium/{date}.md`
2. Add proposed fixes to CTO Backlog
3. Send summary to Telegram
4. Update Day Collector with consilium results

---

## Tools Required

| Task | Tool |
|------|------|
| Read files | `Read`, `Glob` |
| Claude analysis | (current model) |
| GPT-4 analysis | `elio_perplexity_search` |
| Apply fixes | `Edit`, `Write` |
| Run tests | `Bash` |
| Git commit | `Bash` |
| Notify | `elio_telegram_notify` |
| Backlog | `backlog_create` |

---

## Example Trigger from CTO

```typescript
// In CTO workflow, Stage 5
const shouldRunConsilium =
  securityIssues.some(i => i.severity === 'critical' || i.severity === 'high') ||
  changedFiles.length > 3 ||
  newDependencies.length > 0 ||
  breakingChanges.length > 0 ||
  daySummary.errors.total > 10;

if (shouldRunConsilium) {
  // Call consilium via elio_agent_start
  await elio_agent_start({
    prompt: `Run consilium workflow.

Reason: ${triggerReason}
Focus areas:
${focusAreas.join('\n')}

Context: ${context}`,
    cwd: '/root/.claude'
  });
}
```

---

## Limitations

1. **No direct OpenAI access** — using Perplexity as proxy
2. **No Groq integration** — optional, skip if not configured
3. **Async only** — CTO doesn't wait for consilium to finish
4. **Daily limit** — max 1 consilium per night to avoid cost

---

## Future Improvements

1. Add direct OpenAI/Anthropic API calls
2. Add Groq for fast sanity checks
3. Add code execution sandbox for testing fixes
4. Add human approval step for high-severity fixes
5. Track consilium history for learning
