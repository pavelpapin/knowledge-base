# System Review Skill

Комплексная проверка системы после больших изменений. Проверяет сборку, архитектуру, качество кода и runtime.

## When to Use
- После больших архитектурных изменений
- Перед merge в main
- Nightly (автоматически)
- Ручной запуск: `/system-review`

## Inputs
| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `scope` | no | string | `full` (default), `quick`, `build-only` |
| `fix` | no | boolean | Auto-fix найденные проблемы |
| `notify` | no | boolean | Отправить результат в Telegram |

## Output Format
```json
{
  "timestamp": "2026-01-21T05:30:00Z",
  "duration_seconds": 45,
  "overall_status": "pass|warn|fail",
  "overall_score": 85,
  "checks": {
    "build": { "status": "pass", "details": {...} },
    "architecture": { "status": "warn", "issues": [...] },
    "code_quality": { "status": "pass", "details": {...} },
    "runtime": { "status": "pass", "details": {...} },
    "integration": { "status": "pass", "details": {...} }
  },
  "summary": "Build OK. 2 architecture warnings. All runtime checks pass.",
  "action_items": [
    { "priority": "medium", "issue": "...", "fix": "..." }
  ]
}
```

---

## Algorithm

### Phase 1: Build Check (обязательно)

```bash
# 1.1 TypeScript compilation
cd /root/.claude && pnpm build 2>&1

# 1.2 Check for errors
# Парсить output на наличие "error TS"

# 1.3 Check dependencies
pnpm install --frozen-lockfile 2>&1
```

**Критерии прохождения:**
- [ ] Все packages компилируются без ошибок
- [ ] Нет unresolved dependencies
- [ ] Нет циклических зависимостей

### Phase 2: Architecture Check

```bash
# 2.1 File size check
find /root/.claude/packages /root/.claude/apps /root/.claude/mcp-server/src \
  -name "*.ts" -exec wc -l {} \; | awk '$1 > 200 {print}'

# 2.2 Function complexity (approximate)
grep -r "function\|const.*=.*=>" --include="*.ts" | wc -l

# 2.3 Check for index.ts re-exports
find . -name "index.ts" -exec grep -l "export \* from" {} \;
```

**Критерии:**
- [ ] Файлы < 200 строк (исключение: сложные интеграции < 300)
- [ ] Функции < 50 строк
- [ ] Каждый модуль имеет index.ts с re-exports
- [ ] Нет циклических imports

### Phase 3: Code Quality

```bash
# 3.1 No `any` types
grep -r ": any" --include="*.ts" | grep -v node_modules | grep -v "// eslint-disable"

# 3.2 No console.log (should use logger)
grep -r "console\.\(log\|error\|warn\)" --include="*.ts" | grep -v node_modules | grep -v test

# 3.3 No hardcoded secrets
grep -rE "(api[_-]?key|password|secret|token)\s*[:=]\s*['\"][^'\"]+['\"]" --include="*.ts"

# 3.4 TODO/FIXME check
grep -rE "(TODO|FIXME|HACK|XXX)" --include="*.ts" | grep -v node_modules
```

**Критерии:**
- [ ] 0 `any` types (или с явным комментарием почему)
- [ ] 0 console.log в production коде
- [ ] 0 hardcoded secrets
- [ ] Все TODO имеют ticket reference

### Phase 4: Runtime Check

```bash
# 4.1 Redis connection
redis-cli ping

# 4.2 MCP server health
curl -s http://localhost:3000/health || node -e "require('./mcp-server/dist/index.js')"

# 4.3 Worker starts
pgrep -f "apps/worker" || (cd /root/.claude/apps/worker && timeout 5 node dist/index.js)

# 4.4 Database connection
# Через MCP tool: elio_database_health
```

**Критерии:**
- [ ] Redis responds to ping
- [ ] MCP server starts without errors
- [ ] Worker can process a test job
- [ ] Database connection OK

### Phase 5: Integration Check

```bash
# 5.1 All adapters load
node -e "
  const adapters = require('./mcp-server/dist/adapters/index.js');
  console.log('Adapters:', Object.keys(adapters.allAdapters));
"

# 5.2 Tools registered
node -e "
  const { allTools } = require('./mcp-server/dist/adapters/index.js');
  console.log('Tools count:', allTools.length);
"

# 5.3 Test MCP tool call
# elio_database_health или простой read-only tool
```

**Критерии:**
- [ ] Все adapters загружаются без ошибок
- [ ] Tools > 50 зарегистрировано
- [ ] Базовый tool call работает

---

## Scoring

| Check | Weight | Pass | Warn | Fail |
|-------|--------|------|------|------|
| Build | 30% | No errors | Warnings | Errors |
| Architecture | 20% | All OK | 1-3 issues | >3 issues |
| Code Quality | 20% | All OK | 1-5 issues | >5 issues |
| Runtime | 20% | All pass | 1 fail | >1 fail |
| Integration | 10% | All load | Some fail | Critical fail |

**Overall:**
- 90-100: PASS (green)
- 70-89: WARN (yellow)
- <70: FAIL (red)

---

## Auto-Fix Actions

Когда `fix=true`:

1. **Large files** → Предложить split (не автоматически)
2. **console.log** → Заменить на `logger.info/warn/error`
3. **Missing types** → Добавить explicit types
4. **Unused imports** → Удалить

---

## Notification Template

```
📊 System Review Complete

Status: ✅ PASS | ⚠️ WARN | ❌ FAIL
Score: 85/100

Build: ✅ OK
Architecture: ⚠️ 2 large files
Code Quality: ✅ OK
Runtime: ✅ All services up
Integration: ✅ 67 tools loaded

Action Items:
• Split ProcessHandle.ts (262 lines)
• Split AgentRunner.ts (290 lines)

Full report: /root/.claude/logs/system-review/2026-01-21.json
```

---

## Examples

### Quick check after changes
```
/system-review scope=quick
```
Проверяет только build и runtime.

### Full review with auto-fix
```
/system-review scope=full fix=true notify=true
```
Полная проверка, автофикс простых проблем, уведомление в Telegram.

### Build-only (CI mode)
```
/system-review scope=build-only
```
Только проверка компиляции. Для CI/CD.

---

## Integration with Nightly Consilium

System Review запускается как часть Nightly Consilium:
1. System Review (этот skill)
2. Code Review (глубокий анализ)
3. Report generation
4. Telegram notification

---

## Notes

- Runtime checks требуют запущенного Redis
- Для полной проверки worker должен быть в состоянии принимать jobs
- Результаты сохраняются в `/root/.claude/logs/system-review/`
- История ревью используется для trend analysis
