# Workflow: Day Review

**Purpose:** Собрать все данные за день в один структурированный отчёт для CTO, CPO и CEO.

**Schedule:** Ежедневно в 00:00 Tbilisi (первый, перед всеми)

---

## Что собираем

### 1. Errors & Exceptions
```
Sources:
- /root/.claude/logs/errors/{date}.jsonl
- /root/.claude/logs/nightly/*.log (последние)
- Redis error logs
- MCP server errors
```

**Output format:**
```json
{
  "errors": [
    {
      "timestamp": "...",
      "source": "mcp-server",
      "level": "error",
      "message": "...",
      "stack": "...",
      "count": 5
    }
  ],
  "summary": {
    "total": 12,
    "by_source": {"mcp": 5, "workflow": 3, "agent": 4},
    "by_level": {"error": 8, "warn": 4}
  }
}
```

---

### 2. Git Changes
```
Source: git log --since="24 hours ago"
```

**Collect:**
- Commits (author, message, files changed)
- Lines added/removed
- Files modified

---

### 3. Conversations
```
Source: /root/.claude/logs/daily/{date}/conversations.jsonl
```

**Extract:**
- User messages
- Corrections (когда пользователь поправил)
- Requests (что просили сделать)
- Feedback (позитивный/негативный)

---

### 4. Workflow Executions
```
Source:
- /root/.claude/logs/system-loop/
- Database: workflow_runs
- /root/.claude/state/system-loop-state.json
```

**Collect:**
- What ran
- Success/failure
- Duration
- Errors

---

### 5. System Metrics
```
Sources:
- Redis INFO
- Disk usage
- Memory usage
- Process list
```

---

### 6. External API Health
```
Check:
- Notion API
- Telegram API
- Perplexity API
- Supabase
```

---

## Output

### Location
```
/root/.claude/logs/daily/{date}/day-summary.json
```

### Format
```json
{
  "date": "2026-01-21",
  "generated_at": "2026-01-21T20:00:00Z",

  "errors": {
    "total": 12,
    "critical": 0,
    "by_source": {},
    "top_errors": []
  },

  "git": {
    "commits": 5,
    "files_changed": 12,
    "lines_added": 234,
    "lines_removed": 56,
    "authors": ["claude"]
  },

  "conversations": {
    "total_messages": 45,
    "corrections": 3,
    "requests": ["...", "..."],
    "feedback": {"positive": 2, "negative": 1}
  },

  "workflows": {
    "executed": 4,
    "succeeded": 3,
    "failed": 1,
    "details": []
  },

  "system": {
    "disk_usage": "45%",
    "memory_usage": "62%",
    "redis_memory": "12MB",
    "uptime": "5 days"
  },

  "api_health": {
    "notion": "ok",
    "telegram": "ok",
    "perplexity": "ok",
    "supabase": "ok"
  }
}
```

---

## Execution Steps

### Step 1: Collect Errors
```bash
# Scan error logs
find /root/.claude/logs -name "*.log" -mtime -1 -exec grep -l "ERROR\|error\|Error" {} \;

# Parse and aggregate
```

### Step 2: Collect Git Changes
```bash
cd /root/.claude
git log --since="24 hours ago" --pretty=format:'%H|%an|%s' --stat
```

### Step 3: Collect Conversations
```bash
# Read today's conversation logs
cat /root/.claude/logs/daily/$(date +%Y-%m-%d)/conversations.jsonl 2>/dev/null
```

### Step 4: Collect Workflow Results
```bash
# Read system loop state
cat /root/.claude/state/system-loop-state.json
```

### Step 5: Collect System Metrics
```bash
# Disk
df -h / | tail -1 | awk '{print $5}'

# Memory
free -m | grep Mem | awk '{print int($3/$2*100)"%"}'

# Redis
redis-cli INFO memory | grep used_memory_human
```

### Step 6: Check API Health
```bash
# Telegram
curl -s "https://api.telegram.org/bot${TOKEN}/getMe" | jq '.ok'

# Notion (via MCP)
# Perplexity (via MCP)
# Supabase
curl -s "${SUPABASE_URL}/rest/v1/" -H "apikey: ${SUPABASE_KEY}" | head -1
```

### Step 7: Generate Summary
Combine all data into `day-summary.json`

### Step 8: Notify
Send brief summary to Telegram:
```
📊 Day Review Complete

Errors: 12 (0 critical)
Git: 5 commits, +234/-56 lines
Conversations: 45 messages, 3 corrections
Workflows: 3/4 succeeded
System: OK

Full report: /logs/daily/{date}/day-summary.json
```

---

## Tools Required

| Task | Tool |
|------|------|
| Read logs | `Read`, `Glob`, `Grep` |
| Git info | `Bash` |
| System info | `Bash` |
| API checks | `Bash` (curl) |
| Save report | `Write` |
| Notify | `elio_telegram_notify` |

---

## Dependencies

- Runs FIRST, before CTO/CPO/CEO
- No dependencies on other workflows
- Creates data that others consume

---

## Verification

**Success criteria:**
1. `day-summary.json` created
2. File size > 500 bytes
3. All sections populated
4. Telegram notification sent
