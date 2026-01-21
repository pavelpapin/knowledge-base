# Deep Architecture Analysis

Эта часть System Review выходит за рамки checklist и анализирует систему на уровне архитектуры.

## Analysis Dimensions

### 1. Scalability Analysis

**Questions to answer:**
- Что станет bottleneck при 10x/100x нагрузке?
- Какие компоненты stateful и как их горизонтально масштабировать?
- Где single points of failure?

**Current state checks:**

```
┌─────────────────────────────────────────────────────────┐
│ Component          │ Scalable? │ Bottleneck Risk        │
├────────────────────┼───────────┼────────────────────────│
│ Redis              │ Single    │ HIGH - всё через него  │
│ Worker             │ Можно +   │ LOW - stateless        │
│ MCP Server         │ Можно +   │ MEDIUM - auth state    │
│ File Storage       │ Local     │ HIGH - не distributed  │
│ Session Storage    │ Redis     │ MEDIUM - memory bound  │
└─────────────────────────────────────────────────────────┘
```

**Recommendations format:**
```json
{
  "component": "Redis",
  "current_risk": "high",
  "issue": "Single Redis instance for queues, state, streams",
  "recommendation": "Split into: (1) Redis for queues, (2) Redis for state/cache, (3) Consider Redis Cluster",
  "effort": "medium",
  "impact": "high"
}
```

### 2. Security Analysis

**Questions:**
- Какие данные могут быть скомпрометированы?
- Где есть injection risks?
- Как защищены secrets?

**Checks:**

| Area | Check | Risk |
|------|-------|------|
| Secrets | Hardcoded vs env vs vault | How stored? |
| SQL | Parameterized queries | Injection risk |
| Shell | Command building | Command injection |
| Auth | Token validation | Bypass risk |
| Permissions | File access | Path traversal |
| MCP Tools | Input validation | Arbitrary execution |

**Deep dive questions:**
1. Что произойдет если `prompt` содержит shell injection?
2. Как валидируются inputs в MCP tools?
3. Кто может вызвать `elio_sql_execute`?
4. Что если Redis compromised?

### 3. Reliability Analysis

**Questions:**
- Что произойдет при crash каждого компонента?
- Есть ли retry logic?
- Как восстанавливаться после сбоев?

**Failure scenarios:**

```
Scenario: Redis dies
├── Impact: All queues lost, state lost
├── Current handling: None (crash)
└── Recommendation: Persistent queues + graceful degradation

Scenario: Worker crashes mid-job
├── Impact: Job stuck in "running" forever
├── Current handling: Timeout (10 min)
└── Recommendation: Heartbeat + stale job recovery

Scenario: MCP server OOM
├── Impact: All tools unavailable
├── Current handling: Process dies
└── Recommendation: Memory limits + restart policy
```

### 4. Data Flow Analysis

**Questions:**
- Как данные текут через систему?
- Где data может застрять?
- Есть ли data races?

**Current flow:**
```
User Request → MCP Tool → BullMQ Queue → Worker
                                           ↓
                                      Claude CLI
                                           ↓
                                    Redis Streams ← output
                                           ↓
                                    State Update
```

**Issues to check:**
- Что если output stream переполнится?
- Что если два worker'а возьмут один job?
- Race condition при state updates?

### 5. Technical Debt Map

**Categories:**
1. **Architecture debt** - неправильные абстракции
2. **Code debt** - хаки, workarounds
3. **Test debt** - отсутствие тестов
4. **Ops debt** - нет мониторинга, логов

**Prioritization:**
```
      HIGH IMPACT
           │
    ┌──────┼──────┐
    │  FIX │PLAN  │
    │  NOW │NEXT  │
    ├──────┼──────┤
    │TRACK │IGNORE│
    │      │      │
    └──────┴──────┘
           │
      LOW IMPACT
  LOW EFFORT ─── HIGH EFFORT
```

---

## Actionable Recommendations Template

Каждая рекомендация должна быть:

```json
{
  "id": "ARCH-001",
  "category": "scalability|security|reliability|debt",
  "severity": "critical|high|medium|low",
  "title": "Split Redis into separate instances",
  "problem": "Single Redis handles queues, state, streams - SPOF",
  "solution": {
    "summary": "Use separate Redis instances for different workloads",
    "steps": [
      "1. Create redis-queue for BullMQ",
      "2. Create redis-state for workflow state",
      "3. Update connection configs",
      "4. Test failover"
    ],
    "code_changes": [
      "packages/workflow/src/bullmq/connection.ts",
      "apps/worker/src/index.ts"
    ]
  },
  "effort_hours": 8,
  "risk_if_ignored": "System down if Redis fails",
  "auto_fixable": false
}
```

---

## Integration with Claude

При запуске deep analysis, Claude должен:

1. **Read codebase structure**
   - Найти все entry points
   - Построить dependency graph
   - Идентифицировать data flows

2. **Apply security mindset**
   - "Как бы я атаковал эту систему?"
   - "Что самое ценное здесь?"
   - "Где слабые точки входа?"

3. **Think about scale**
   - "Что если 1000 concurrent users?"
   - "Что если 1M records в БД?"
   - "Что если network latency 500ms?"

4. **Consider operations**
   - "Как это дебажить в production?"
   - "Как откатить изменение?"
   - "Как узнать что что-то сломалось?"

5. **Generate actionable items**
   - Конкретные файлы для изменения
   - Примерный код или псевдокод
   - Приоритет и effort estimate

---

## Output Format

```json
{
  "deep_analysis": {
    "timestamp": "2026-01-21T05:30:00Z",
    "scope_analyzed": ["packages/", "apps/", "mcp-server/"],

    "scalability": {
      "score": 60,
      "bottlenecks": [...],
      "recommendations": [...]
    },

    "security": {
      "score": 75,
      "vulnerabilities": [...],
      "recommendations": [...]
    },

    "reliability": {
      "score": 55,
      "failure_modes": [...],
      "recommendations": [...]
    },

    "tech_debt": {
      "total_items": 15,
      "critical": 2,
      "high": 5,
      "items": [...]
    },

    "top_recommendations": [
      {
        "id": "ARCH-001",
        "title": "...",
        "impact": "high",
        "effort": "medium"
      }
    ]
  }
}
```

---

## Example Deep Analysis Run

```
/system-review scope=deep

═══ Deep Architecture Analysis ═══

Analyzing codebase structure...
Found 45 TypeScript files across 3 packages

┌─────────────────────────────────────────┐
│ SCALABILITY ANALYSIS                    │
├─────────────────────────────────────────┤
│ Score: 60/100                           │
│                                         │
│ ⚠️ Redis single point of failure        │
│ ⚠️ No horizontal scaling for workers    │
│ ✓ Stateless MCP tools                   │
│ ⚠️ Local file storage                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ SECURITY ANALYSIS                       │
├─────────────────────────────────────────┤
│ Score: 75/100                           │
│                                         │
│ ✓ Secrets in env files                  │
│ ⚠️ SQL queries need parameterization    │
│ ⚠️ Shell command building in PTY        │
│ ✓ No hardcoded tokens                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ TOP 3 RECOMMENDATIONS                   │
├─────────────────────────────────────────┤
│ 1. [HIGH] Add circuit breaker for       │
│    external API calls                   │
│    Effort: 4h | Impact: High            │
│                                         │
│ 2. [HIGH] Implement job heartbeat       │
│    for stale job recovery               │
│    Effort: 6h | Impact: High            │
│                                         │
│ 3. [MED] Split Redis instances          │
│    Effort: 8h | Impact: Medium          │
└─────────────────────────────────────────┘

Apply recommendations? [y/N]
```
