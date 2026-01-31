# Registry Enforcement System

**Цель:** Сделать нарушение правил registry невозможным или очевидным немедленно.

**Принцип:** Fail fast, fail loud. Правильное — легко, неправильное — невозможно.

---

## 🏛️ Архитектура (5 слоёв)

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: SCHEMA (compile-time)                              │
│ ─────────────────────────────────────────────────────────── │
│ registry.schema.json → validates registry.yaml structure    │
│ Blocks: invalid YAML, missing required fields               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: CODEGEN (development-time)                         │
│ ─────────────────────────────────────────────────────────── │
│ registry.yaml → registry.generated.ts (types + consts)      │
│ Blocks: typos in workflow_id, non-existent workflows        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: RUNTIME (execution-time)                           │
│ ─────────────────────────────────────────────────────────── │
│ Workflow executor checks registry before start              │
│ Blocks: deprecated workflows, missing failure_model         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: DRIFT DETECTION (continuous)                       │
│ ─────────────────────────────────────────────────────────── │
│ Cron job: filesystem vs registry every 6h                   │
│ Alerts: Telegram notification on drift                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: CI/CD (pre-merge)                                  │
│ ─────────────────────────────────────────────────────────── │
│ GitHub Actions: schema + lint + codegen check               │
│ Blocks: PRs that break registry integrity                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Schema Validation

### Файл: `registry.schema.json`

JSON Schema для `registry.yaml`. Гарантирует:
- Все обязательные поля присутствуют
- Типы корректны (string, array, enum)
- Enum values валидны (status: implemented|draft|deprecated)
- Cross-field validation (если status=implemented → требуется failure_model)

**Использование:**
```bash
# Pre-commit hook
npx ajv validate -s registry.schema.json -d registry.yaml

# В lint-registry.sh
if command -v ajv &> /dev/null; then
  ajv validate -s registry.schema.json -d registry.yaml || exit 1
fi
```

**Что блокирует:**
- ❌ Добавление workflow без `version`
- ❌ Неправильный `status` (typo: "implemeted")
- ❌ Implemented workflow без `failure_model`
- ❌ Некорректный формат `updated_at`

---

## Layer 2: Code Generation

### Скрипт: `scripts/codegen-registry.ts`

Генерирует TypeScript из `registry.yaml`:

```typescript
// packages/shared/src/registry.generated.ts (auto-generated)

export type WorkflowId = 
  | 'system-review'
  | 'deep-research'
  | 'data-enrichment'
  | 'telegram-inbox'
  | 'email-inbox'
  // ... все workflows из registry

export type WorkflowStatus = 'implemented' | 'draft' | 'prompt-only' | 'deprecated';

export interface WorkflowMeta {
  version: string;
  updated_at: string;
  description: string;
  status: WorkflowStatus;
  stages?: string[];
  side_effects?: string[];
  replay_safety?: 'safe' | 'unsafe';
  // ...
}

export const REGISTRY: Record<WorkflowId, WorkflowMeta> = {
  'system-review': {
    version: '1.2.0',
    updated_at: '2026-01-31',
    description: 'Ночной аудит системы',
    status: 'implemented',
    // ... из registry.yaml
  },
  // ...
} as const;

export function getWorkflow(id: WorkflowId): WorkflowMeta {
  return REGISTRY[id];
}

export function isWorkflowActive(id: WorkflowId): boolean {
  return REGISTRY[id].status !== 'deprecated';
}
```

**Использование в коде:**
```typescript
// До: hardcoded string, typo possible
await executeWorkflow('sistem-review'); // ❌ typo

// После: type-safe
import { WorkflowId, getWorkflow } from '@elio/shared/registry.generated';

await executeWorkflow('system-review' satisfies WorkflowId); // ✅ type-checked
// await executeWorkflow('sistem-review'); // ❌ TypeScript error!

const meta = getWorkflow('system-review');
console.log(meta.version); // "1.2.0"
```

**Генерация:**
```bash
# Запускается автоматически при изменении registry.yaml
npx tsx scripts/codegen-registry.ts

# Husky hook
# .husky/post-checkout
if git diff HEAD@{1} HEAD -- registry.yaml | grep -q '^[+-]'; then
  pnpm codegen:registry
fi
```

**Что блокирует:**
- ❌ Typos в workflow_id (TypeScript compile error)
- ❌ Обращение к несуществующему workflow
- ❌ Использование deprecated workflow без explicit check

---

## Layer 3: Runtime Enforcement

### Файл: `packages/workflow/src/registry-loader.ts`

Workflow executor читает registry перед запуском:

```typescript
import { parse } from 'yaml';
import { readFileSync } from 'fs';
import { ELIO_ROOT } from '@elio/shared';

const REGISTRY_PATH = `${ELIO_ROOT}/registry.yaml`;

export class RegistryLoader {
  private static registry: any = null;

  static load() {
    if (!this.registry) {
      const content = readFileSync(REGISTRY_PATH, 'utf8');
      this.registry = parse(content);
    }
    return this.registry;
  }

  static validateWorkflow(workflowId: string): void {
    const registry = this.load();
    const workflow = registry.workflows[workflowId];

    if (!workflow) {
      throw new Error(
        `Workflow '${workflowId}' not found in registry. ` +
        `Add it to registry.yaml first.`
      );
    }

    if (workflow.status === 'deprecated') {
      const superseded = workflow.superseded_by;
      throw new Error(
        `Workflow '${workflowId}' is deprecated. ` +
        `Use '${superseded}' instead.`
      );
    }

    if (workflow.status === 'implemented') {
      // Implemented workflows must have complete metadata
      const required = ['version', 'failure_model', 'replay_safety', 'done_when'];
      for (const field of required) {
        if (!workflow[field]) {
          throw new Error(
            `Workflow '${workflowId}' is implemented but missing '${field}'. ` +
            `Update registry.yaml.`
          );
        }
      }
    }
  }

  static getWorkflowMeta(workflowId: string) {
    this.validateWorkflow(workflowId);
    return this.load().workflows[workflowId];
  }

  static checkReplaySafety(workflowId: string, dedupKey?: string): boolean {
    const meta = this.getWorkflowMeta(workflowId);
    
    if (meta.replay_safety === 'safe') {
      return true; // Always safe to replay
    }

    if (!meta.replay_guard) {
      throw new Error(
        `Workflow '${workflowId}' has replay_safety=unsafe but no replay_guard defined`
      );
    }

    // Check replay_guard logic (DB query for dedup key)
    // ...
    return false;
  }
}
```

**Использование:**
```typescript
// elio/src/cli.ts
import { RegistryLoader } from '@elio/workflow/registry-loader';

async function runWorkflow(workflowId: string, args: any) {
  // BEFORE executing, validate via registry
  RegistryLoader.validateWorkflow(workflowId); // ✅ Blocks if deprecated/invalid
  
  const meta = RegistryLoader.getWorkflowMeta(workflowId);
  console.log(`Starting ${workflowId} v${meta.version}`);
  
  // Check replay safety
  if (!RegistryLoader.checkReplaySafety(workflowId)) {
    throw new Error(`Workflow already ran recently (replay_guard check failed)`);
  }
  
  // Proceed with execution
  await executeWorkflowStages(workflowId, meta);
}
```

**Что блокирует:**
- ❌ Запуск workflow, которого нет в registry
- ❌ Запуск deprecated workflow (явная ошибка)
- ❌ Запуск implemented workflow без complete metadata
- ❌ Replay unsafe workflow без проверки dedup key

---

## Layer 4: Drift Detection

### Скрипт: `scripts/detect-registry-drift.ts`

Cron job (каждые 6 часов) проверяет:
1. Все workflows на диске есть в registry
2. Все deprecated workflows удалены с диска
3. Все MCP адаптеры referenced в registry

```typescript
import { parse } from 'yaml';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { notify } from '@elio/shared';

interface DriftReport {
  orphaned_workflows: string[]; // На диске, но нет в registry
  orphaned_skills: string[];
  deprecated_on_disk: string[]; // Deprecated в registry, но есть на диске
  orphaned_adapters: string[];
  missing_metadata: string[]; // Implemented без полных метаданных
}

async function detectDrift(): Promise<DriftReport> {
  const registry = parse(readFileSync('registry.yaml', 'utf8'));
  const report: DriftReport = {
    orphaned_workflows: [],
    orphaned_skills: [],
    deprecated_on_disk: [],
    orphaned_adapters: [],
    missing_metadata: [],
  };

  // Check workflows on disk vs registry
  const workflowDirs = readdirSync('workflows', { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '_template')
    .map(d => d.name);

  for (const dir of workflowDirs) {
    if (!registry.workflows[dir]) {
      report.orphaned_workflows.push(dir);
    }
  }

  // Check deprecated workflows still on disk
  for (const [name, meta] of Object.entries(registry.workflows)) {
    if (meta.status === 'deprecated' && existsSync(`workflows/${name}`)) {
      report.deprecated_on_disk.push(name);
    }
  }

  // Check MCP adapters
  const adapterDirs = readdirSync('mcp-server/src/adapters', { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '__tests__')
    .map(d => d.name);

  for (const dir of adapterDirs) {
    const yamlContent = readFileSync('registry.yaml', 'utf8');
    if (!yamlContent.includes(dir)) {
      report.orphaned_adapters.push(dir);
    }
  }

  return report;
}

async function main() {
  const report = await detectDrift();
  const hasDrift = Object.values(report).some(arr => arr.length > 0);

  if (hasDrift) {
    const message = `⚠️ Registry Drift Detected!\n\n` +
      (report.orphaned_workflows.length > 0
        ? `Workflows on disk not in registry:\n${report.orphaned_workflows.map(w => `  - ${w}`).join('\n')}\n\n`
        : '') +
      (report.deprecated_on_disk.length > 0
        ? `Deprecated workflows still on disk:\n${report.deprecated_on_disk.map(w => `  - ${w}`).join('\n')}\n\n`
        : '') +
      (report.orphaned_adapters.length > 0
        ? `MCP adapters not in registry:\n${report.orphaned_adapters.map(a => `  - ${a}`).join('\n')}\n\n`
        : '') +
      `Run: ./scripts/lint-registry.sh`;

    await notify({ message, priority: 'high' });
    console.error(message);
    process.exit(1);
  } else {
    console.log('✅ No drift detected. Registry and filesystem in sync.');
  }
}

main();
```

**Cron setup:**
```bash
# scheduler/config.json
{
  "jobs": [
    {
      "name": "registry-drift-detection",
      "schedule": "0 */6 * * *", // Every 6 hours
      "script": "npx tsx scripts/detect-registry-drift.ts",
      "notify_on_failure": true
    }
  ]
}
```

**Что блокирует:**
- ⚠️ Orphaned workflows (уведомление → ручная проверка)
- ⚠️ Deprecated на диске (уведомление → автоудаление или ручная проверка)
- ⚠️ Адаптеры без registry entry (уведомление)

---

## Layer 5: CI/CD (GitHub Actions)

### Файл: `.github/workflows/validate-registry.yml`

```yaml
name: Registry Integrity Check

on:
  push:
    paths:
      - 'registry.yaml'
      - 'workflows/**'
      - 'skills/**'
      - 'mcp-server/src/adapters/**'
  pull_request:
    paths:
      - 'registry.yaml'
      - 'workflows/**'
      - 'skills/**'
      - 'mcp-server/src/adapters/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    name: Validate Registry
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install yq
        run: |
          wget -qO /usr/local/bin/yq \
            https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
          chmod +x /usr/local/bin/yq
      
      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: |
          npm install -g ajv-cli
          pnpm install
      
      - name: Validate YAML schema
        run: npx ajv validate -s registry.schema.json -d registry.yaml
      
      - name: Lint registry
        run: ./scripts/lint-registry.sh
      
      - name: Check codegen is up-to-date
        run: |
          pnpm codegen:registry
          if ! git diff --exit-code packages/shared/src/registry.generated.ts; then
            echo "❌ registry.generated.ts is out of sync!"
            echo "Run: pnpm codegen:registry"
            exit 1
          fi
      
      - name: Detect drift
        run: npx tsx scripts/detect-registry-drift.ts
```

**Что блокирует:**
- ❌ Merge PR с invalid registry.yaml
- ❌ Merge PR с orphaned workflows
- ❌ Merge PR с outdated codegen

---

## 🔄 Workflow: Добавление нового workflow

### До (без enforcement)
```bash
# Developer пишет код
mkdir -p packages/my-workflow/src
# Забыл добавить в registry!
git commit -m "Add my-workflow"
# ✅ Commits успешно, система сломана
```

### После (с enforcement)
```bash
# 1. Сначала registry (pre-commit hook блокирует если забыл)
vim registry.yaml  # Добавить my-workflow

# 2. Codegen автоматически (husky hook)
# → registry.generated.ts обновлён

# 3. Пишем код с type safety
import { WorkflowId } from '@elio/shared/registry.generated';
const id: WorkflowId = 'my-workflow'; // ✅ Type-checked

# 4. Pre-commit hook
git add .
git commit -m "Add my-workflow"
# → lint-registry.sh runs
# → Schema validation runs
# → ✅ Commits только если всё валидно

# 5. GitHub Actions (на push)
# → CI validates schema
# → CI runs lint-registry.sh
# → CI checks codegen is current
# → ✅ Merge только если всё ОК

# 6. Runtime (при запуске)
elio workflow my-workflow
# → RegistryLoader.validateWorkflow('my-workflow')
# → ✅ Проверяет metadata, status, replay_safety

# 7. Drift detection (каждые 6h)
# → Проверяет filesystem vs registry
# → ⚠️ Telegram alert если drift
```

---

## 📊 Сравнение: До vs После

| Сценарий | До | После |
|----------|-----|--------|
| Создать workflow без registry entry | ✅ Возможно | ❌ Блокируется pre-commit |
| Typo в workflow_id | ✅ Runtime error | ❌ TypeScript compile error |
| Запустить deprecated workflow | ⚠️ Runs с warning | ❌ Runtime error с указанием альтернативы |
| Забыть failure_model для implemented | ✅ Возможно | ❌ Блокируется lint + schema |
| Orphaned workflows на диске | ⚠️ Накапливаются | ⚠️ Telegram alert каждые 6h |
| Outdated codegen | ✅ Возможно | ❌ Блокируется CI |
| Invalid YAML syntax | ⚠️ Runtime error | ❌ Блокируется pre-commit |

---

## 🚀 Roadmap

### Phase 1: Foundation (сейчас)
- [x] Pre-commit hook (lint-registry.sh)
- [x] Basic validation

### Phase 2: Type Safety (1-2 дня)
- [ ] registry.schema.json
- [ ] scripts/codegen-registry.ts
- [ ] registry.generated.ts
- [ ] Update workflow executor to use RegistryLoader

### Phase 3: Observability (1-2 дня)
- [ ] scripts/detect-registry-drift.ts
- [ ] Cron job setup
- [ ] Telegram alerts

### Phase 4: CI/CD (1 день)
- [ ] .github/workflows/validate-registry.yml
- [ ] Husky hooks для codegen

### Phase 5: Polish (опционально)
- [ ] IDE extension для autocomplete workflow_id
- [ ] Dashboard в Notion с registry stats
- [ ] Auto-fix для simple drift (удаление deprecated)

---

## 🎯 Success Metrics

**После внедрения всех слоёв:**
- ✅ 0 orphaned workflows
- ✅ 0 runtime errors из-за typos в workflow_id
- ✅ 100% coverage для implemented workflows (all required fields)
- ✅ < 1 hour время обнаружения drift (instead of days/weeks)
- ✅ 0 PRs merged с broken registry

**Принцип:** Make it impossible to break, not just hard.
