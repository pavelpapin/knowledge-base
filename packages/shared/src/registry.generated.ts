/**
 * AUTO-GENERATED from registry.yaml
 * DO NOT EDIT MANUALLY
 *
 * Generated at: 2026-01-31T07:34:31.623Z
 *
 * To regenerate:
 *   pnpm codegen:registry
 */

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

/**
 * All workflow IDs in registry (including deprecated)
 */
export type WorkflowId =
  | 'system-review'
  | 'deep-research'
  | 'data-enrichment'
  | 'telegram-inbox'
  | 'email-inbox'
  | 'meeting-prep'
  | 'cold-outreach'
  | 'tz-builder'
  | 'day-review'
  | 'consilium';

/**
 * Active workflow IDs (excluding deprecated)
 */
export type ActiveWorkflowId =
  | 'system-review'
  | 'deep-research'
  | 'data-enrichment'
  | 'telegram-inbox'
  | 'email-inbox'
  | 'meeting-prep'
  | 'cold-outreach'
  | 'tz-builder'
  | 'day-review'
  | 'consilium';

export type WorkflowStatus = 'implemented' | 'prompt-only' | 'draft' | 'deprecated';

export type ReplaySafety = 'safe' | 'unsafe';

export interface FailureModel {
  retries: number;
  timeout: string;
  on_failure: 'telegram_notify' | 'email_notify' | 'log_only';
}

export interface WorkflowMeta {
  version?: string;
  updated_at?: string;
  description: string;
  status: WorkflowStatus;
  code?: string;
  docs?: string;
  script?: string;
  mcp_adapter?: string;
  stages?: string[];
  side_effects?: string[];
  replay_safety?: ReplaySafety;
  replay_guard?: string;
  done_when?: string;
  failure_model?: FailureModel;
  superseded_by?: string;
}

// ============================================================================
// SKILL TYPES
// ============================================================================

export type SkillId =
  | 'web-search'
  | 'youtube-transcript'
  | 'code-review'
  | 'auto-test'
  | 'deploy-website'
  | 'brutal-audit'
  | 'code-cleanup'
  | 'dep-maintenance'
  | 'disk-cleanup'
  | 'docs-audit'
  | 'git-maintenance'
  | 'smoke-test'
  | 'structure-audit'
  | 'person-research'
  | 'intercom-opener'
  | 'deep-research'
  | 'system-review';

export type SkillType = 'prompt-only' | 'package';

export interface SkillMeta {
  description: string;
  type: SkillType;
  package?: string;
  docs?: string;
  mcp_tools?: string[];
  version?: string;
  updated_at?: string;
}

// ============================================================================
// CONNECTOR TYPES
// ============================================================================

export type ConnectorId =
  | 'gmail'
  | 'telegram'
  | 'slack'
  | 'calendar'
  | 'notion'
  | 'google-docs'
  | 'google-sheets'
  | 'perplexity'
  | 'brave'
  | 'exa'
  | 'serper'
  | 'tavily'
  | 'semanticscholar'
  | 'scrapedo'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'github'
  | 'anysite'
  | 'grok'
  | 'whisper'
  | 'notebooklm'
  | 'figma'
  | 'zadarma'
  | 'n8n'
  | 'database'
  | 'webscraping'
  | 'sql'
  | 'agents'
  | 'system'
  | 'backlog'
  | 'community'
  | 'product-review';

export interface ConnectorMeta {
  adapter: string | null;
  tools_prefix?: string;
  description?: string;
  credentials?: string;
  priority?: 'primary' | 'fallback';
  used_by?: string[];
}

// ============================================================================
// REGISTRY CONSTANT
// ============================================================================

export const WORKFLOWS: Record<WorkflowId, WorkflowMeta> = {
  "system-review": {
    "version": "1.1.0",
    "updated_at": "2026-01-30",
    "description": "Ночной аудит системы: Collect -> Analyze -> Fix -> Split Files -> Verify -> Report",
    "code": "packages/system-review",
    "docs": "workflows/system-review/WORKFLOW.md",
    "script": "workflows/system-review/run.sh",
    "mcp_adapter": "mcp-server/src/adapters/system-review",
    "schedule": "0 3 * * *",
    "stages": [
      "collect",
      "analyze",
      "fix",
      "split-files",
      "verify",
      "report",
      "deliver"
    ],
    "status": "implemented",
    "side_effects": [
      "git_commit",
      "telegram_notify",
      "file_modify"
    ],
    "replay_safety": "unsafe",
    "replay_guard": "Dedup by date in workflow_runs",
    "done_when": "verify stage passes, report delivered to Telegram",
    "failure_model": {
      "retries": 1,
      "timeout": "6h",
      "on_failure": "telegram_notify"
    }
  },
  "deep-research": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Глубокое исследование темы с отчётом в Notion",
    "code": "packages/deep-research",
    "docs": "workflows/deep-research/WORKFLOW.md",
    "script": "workflows/deep-research/run.sh",
    "mcp_adapter": "mcp-server/src/adapters/deep-research",
    "mcp_tools": [
      "deep_research",
      "deep_research_resume",
      "deep_research_status"
    ],
    "stages": [
      "discovery",
      "planning",
      "collection",
      "factcheck",
      "synthesis",
      "devils_advocate",
      "report",
      "review"
    ],
    "status": "implemented",
    "side_effects": [
      "notion_page_create",
      "telegram_notify",
      "perplexity_api"
    ],
    "replay_safety": "unsafe",
    "replay_guard": "Dedup by topic hash in workflow_runs",
    "done_when": "Notion page URL returned and verified accessible",
    "failure_model": {
      "retries": 1,
      "timeout": "45m",
      "on_failure": "telegram_notify"
    }
  },
  "data-enrichment": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Обогащение данных CSV/JSON/Notion через внешние API с отчётом в Notion",
    "code": "packages/data-enrichment",
    "docs": "workflows/data-enrichment/WORKFLOW.md",
    "script": "workflows/data-enrichment/run.sh",
    "stages": [
      "discovery",
      "planning",
      "collection",
      "validation",
      "synthesis",
      "export",
      "report",
      "verification"
    ],
    "status": "implemented",
    "side_effects": [
      "notion_page_create",
      "telegram_notify",
      "file_write"
    ],
    "replay_safety": "unsafe",
    "replay_guard": "Dedup by input_hash in workflow_runs",
    "done_when": "Export file generated and report in Notion",
    "failure_model": {
      "retries": 1,
      "timeout": "30m",
      "on_failure": "telegram_notify"
    }
  },
  "telegram-inbox": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Обработка входящих Telegram сообщений",
    "docs": "workflows/telegram-inbox/WORKFLOW.md",
    "stages": [
      "collect",
      "classify",
      "act",
      "respond"
    ],
    "status": "prompt-only",
    "side_effects": [
      "telegram_reply",
      "task_create"
    ],
    "replay_safety": "safe",
    "done_when": "All messages classified and acted upon"
  },
  "email-inbox": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Обработка входящей почты",
    "docs": "workflows/email-inbox/WORKFLOW.md",
    "stages": [
      "collect",
      "classify",
      "act",
      "respond"
    ],
    "status": "prompt-only",
    "side_effects": [
      "gmail_reply",
      "task_create"
    ],
    "replay_safety": "safe",
    "done_when": "All emails classified and acted upon"
  },
  "meeting-prep": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Подготовка к встрече",
    "docs": "workflows/meeting-prep/WORKFLOW.md",
    "stages": [
      "research",
      "brief",
      "deliver"
    ],
    "status": "prompt-only",
    "side_effects": [
      "notion_page_create",
      "telegram_notify"
    ],
    "replay_safety": "safe",
    "done_when": "Brief delivered to Notion and notified via Telegram"
  },
  "cold-outreach": {
    "version": "0.1.0",
    "updated_at": "2026-01-30",
    "description": "Подготовка холодного аутрича",
    "docs": "workflows/cold-outreach/WORKFLOW.md",
    "stages": [
      "research",
      "compose",
      "review"
    ],
    "status": "draft",
    "side_effects": [
      "file_create"
    ],
    "replay_safety": "safe",
    "done_when": "Outreach draft delivered for review"
  },
  "tz-builder": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Генерация ТЗ на новые workflows",
    "docs": "workflows/tz-builder/WORKFLOW.md",
    "stages": [
      "discovery",
      "research",
      "architecture",
      "spec_writing",
      "verification"
    ],
    "status": "prompt-only",
    "side_effects": [
      "file_create"
    ],
    "replay_safety": "safe",
    "done_when": "Spec file created and verified"
  },
  "day-review": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Утренний/вечерний обзор дня: что сделано, что запланировано",
    "docs": "workflows/day-review/WORKFLOW.md",
    "stages": [
      "collect",
      "summarize",
      "deliver"
    ],
    "status": "prompt-only",
    "side_effects": [
      "telegram_notify"
    ],
    "replay_safety": "safe",
    "done_when": "Summary delivered to Telegram"
  },
  "consilium": {
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "description": "Консилиум — мульти-модельное обсуждение",
    "docs": "workflows/consilium/WORKFLOW.md",
    "stages": [
      "collect",
      "discuss",
      "synthesize",
      "deliver"
    ],
    "status": "prompt-only",
    "side_effects": [
      "telegram_notify"
    ],
    "replay_safety": "safe",
    "done_when": "Discussion summary delivered"
  }
} as const;

export const SKILLS: Record<SkillId, SkillMeta> = {
  "web-search": {
    "description": "Поиск в интернете через DuckDuckGo/Serper",
    "type": "package",
    "package": "packages/web-search",
    "docs": "skills/web-search/SKILL.md",
    "mcp_tools": [
      "duckduckgo_search",
      "parse_webpage",
      "serper_search"
    ]
  },
  "youtube-transcript": {
    "description": "Получение транскрипта YouTube видео",
    "type": "prompt-only",
    "docs": "skills/youtube-transcript/SKILL.md"
  },
  "code-review": {
    "description": "Ревью кода — безопасность, качество, стиль",
    "type": "package",
    "package": "packages/code-review",
    "docs": "skills/code-review/SKILL.md",
    "mcp_adapter": "mcp-server/src/adapters/code-review"
  },
  "auto-test": {
    "description": "Автоматический запуск и анализ тестов",
    "type": "prompt-only",
    "docs": "skills/auto-test/SKILL.md"
  },
  "deploy-website": {
    "description": "Деплой сайта",
    "type": "prompt-only",
    "docs": "skills/deploy-website/SKILL.md"
  },
  "brutal-audit": {
    "description": "Жёсткий аудит кода",
    "type": "prompt-only",
    "docs": "skills/brutal-audit/SKILL.md"
  },
  "code-cleanup": {
    "description": "Очистка кода от мусора",
    "type": "prompt-only",
    "docs": "skills/code-cleanup/SKILL.md"
  },
  "dep-maintenance": {
    "description": "Обновление зависимостей",
    "type": "prompt-only",
    "docs": "skills/dep-maintenance/SKILL.md"
  },
  "disk-cleanup": {
    "description": "Очистка диска",
    "type": "prompt-only",
    "docs": "skills/disk-cleanup/SKILL.md"
  },
  "docs-audit": {
    "description": "Аудит документации",
    "type": "prompt-only",
    "docs": "skills/docs-audit/SKILL.md"
  },
  "git-maintenance": {
    "description": "Обслуживание git-репозиториев",
    "type": "prompt-only",
    "docs": "skills/git-maintenance/SKILL.md"
  },
  "smoke-test": {
    "description": "Быстрый smoke-тест системы",
    "type": "prompt-only",
    "docs": "skills/smoke-test/SKILL.md"
  },
  "structure-audit": {
    "description": "Аудит структуры проекта",
    "type": "prompt-only",
    "docs": "skills/structure-audit/SKILL.md"
  },
  "person-research": {
    "description": "OSINT исследование человека из открытых источников",
    "type": "prompt-only",
    "docs": "skills/person-research/SKILL.md"
  },
  "intercom-opener": {
    "description": "Автооткрытие домофона: webhook принимает входящий звонок от Zadarma PBX и проигрывает DTMF ***** для открытия двери",
    "type": "prompt-only",
    "version": "1.0.0",
    "updated_at": "2026-01-30",
    "docs": "skills/intercom-opener/SKILL.md",
    "service": "intercom-opener.service",
    "infra": {
      "webhook_url": "https://getelio.co/zadarma/webhook",
      "server": "projects/intercom-opener/webhook-server.py",
      "systemd": "/etc/systemd/system/intercom-opener.service",
      "nginx": "/etc/nginx/sites-enabled/website.conf",
      "port": 3847
    },
    "zadarma": {
      "number": "+995706070051",
      "pbx_id": 393129,
      "sound_id": "697c9c683612d1a940003890",
      "sip_pbx": "941433"
    }
  },
  "deep-research": {
    "description": "Skill-версия deep-research для ad-hoc исследования",
    "type": "prompt-only",
    "docs": "skills/deep-research/SKILL.md"
  },
  "system-review": {
    "description": "Skill-версия system-review для ручного аудита",
    "type": "prompt-only",
    "docs": "skills/system-review/SKILL.md"
  }
} as const;

export const CONNECTORS: Record<ConnectorId, ConnectorMeta> = {
  "gmail": {
    "adapter": "mcp-server/src/adapters/gmail",
    "tools_prefix": "elio_gmail"
  },
  "telegram": {
    "adapter": "mcp-server/src/adapters/telegram",
    "tools_prefix": "elio_telegram"
  },
  "slack": {
    "adapter": "mcp-server/src/adapters/slack",
    "tools_prefix": "elio_slack"
  },
  "calendar": {
    "adapter": "mcp-server/src/adapters/calendar",
    "tools_prefix": "elio_calendar"
  },
  "notion": {
    "adapter": "mcp-server/src/adapters/notion",
    "tools_prefix": "elio_notion"
  },
  "google-docs": {
    "adapter": "mcp-server/src/adapters/docs",
    "tools_prefix": "elio_docs"
  },
  "google-sheets": {
    "adapter": "mcp-server/src/adapters/sheets",
    "tools_prefix": "elio_sheets"
  },
  "perplexity": {
    "adapter": "mcp-server/src/adapters/perplexity",
    "tools_prefix": "elio_perplexity",
    "credentials": "secrets/perplexity.json",
    "models": [
      "sonar",
      "sonar-pro",
      "sonar-reasoning"
    ],
    "tools": [
      "elio_perplexity_search",
      "elio_perplexity_factcheck"
    ],
    "used_by": [
      "deep-research"
    ],
    "rate_limit": "30/min",
    "priority": "primary"
  },
  "brave": {
    "adapter": "mcp-server/src/adapters/brave"
  },
  "exa": {
    "adapter": "mcp-server/src/adapters/exa"
  },
  "serper": {
    "adapter": "mcp-server/src/adapters/serper"
  },
  "tavily": {
    "adapter": "mcp-server/src/adapters/tavily"
  },
  "semanticscholar": {
    "adapter": "mcp-server/src/adapters/semanticscholar"
  },
  "scrapedo": {
    "adapter": "mcp-server/src/adapters/scrapedo"
  },
  "linkedin": {
    "adapter": "mcp-server/src/adapters/linkedin",
    "tools_prefix": "elio_linkedin"
  },
  "twitter": {
    "adapter": "mcp-server/src/adapters/twitter"
  },
  "youtube": {
    "adapter": "mcp-server/src/adapters/youtube",
    "priority": "primary",
    "overlaps_with": [
      "anysite"
    ],
    "note": "YouTube Data API v3 (свой ключ, 10K units/день). Предпочтительнее anysite."
  },
  "github": {
    "adapter": "mcp-server/src/adapters/github"
  },
  "anysite": {
    "adapter": "mcp-server/src/adapters/anysite",
    "priority": "fallback",
    "note": "Scraping-based. Shared лимит points. Fallback для YouTube/LinkedIn/Twitter."
  },
  "grok": {
    "adapter": "mcp-server/src/adapters/grok"
  },
  "whisper": {
    "adapter": "mcp-server/src/adapters/whisper"
  },
  "notebooklm": {
    "adapter": "mcp-server/src/adapters/notebooklm"
  },
  "figma": {
    "adapter": "mcp-server/src/adapters/figma"
  },
  "zadarma": {
    "adapter": null,
    "credentials": "secrets/zadarma-credentials.txt",
    "api_key": "secrets/zadarma-credentials.txt",
    "note": "VoIP provider. Georgian number +995706070051. API for PBX, IVR, numbers.",
    "used_by": [
      "intercom-opener"
    ]
  },
  "n8n": {
    "adapter": "mcp-server/src/adapters/n8n",
    "tools_prefix": "elio_n8n"
  },
  "database": {
    "adapter": "mcp-server/src/adapters/database",
    "tools_prefix": "elio_database"
  },
  "webscraping": {
    "adapter": "mcp-server/src/adapters/webscraping"
  },
  "sql": {
    "adapter": "mcp-server/src/adapters/sql"
  },
  "agents": {
    "adapter": "mcp-server/src/adapters/agents",
    "tools_prefix": "elio_agents",
    "note": "Background agent execution via Claude CLI"
  },
  "system": {
    "adapter": "mcp-server/src/adapters/system"
  },
  "backlog": {
    "adapter": "mcp-server/src/adapters/backlog"
  },
  "community": {
    "adapter": "mcp-server/src/adapters/community"
  },
  "product-review": {
    "adapter": "mcp-server/src/adapters/product-review",
    "tools_prefix": "elio_product_review",
    "description": "Product quality review - analyzes feedback, errors, quality metrics"
  }
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get workflow metadata by ID
 * @throws if workflow not found
 */
export function getWorkflow(id: WorkflowId): WorkflowMeta {
  const workflow = WORKFLOWS[id];
  if (!workflow) {
    throw new Error(`Workflow '${id}' not found in registry`);
  }
  return workflow;
}

/**
 * Check if workflow is active (not deprecated)
 */
export function isWorkflowActive(id: WorkflowId): boolean {
  return WORKFLOWS[id]?.status !== 'deprecated';
}

/**
 * Get all active workflow IDs
 */
export function getActiveWorkflowIds(): ActiveWorkflowId[] {
  return Object.keys(WORKFLOWS).filter(id =>
    WORKFLOWS[id as WorkflowId].status !== 'deprecated'
  ) as ActiveWorkflowId[];
}

/**
 * Get workflow by ID, throw if deprecated
 */
export function getActiveWorkflow(id: WorkflowId): WorkflowMeta {
  const workflow = getWorkflow(id);
  if (workflow.status === 'deprecated') {
    const superseded = workflow.superseded_by;
    throw new Error(
      `Workflow '${id}' is deprecated. Use '${superseded}' instead.`
    );
  }
  return workflow;
}

/**
 * Get skill metadata by ID
 */
export function getSkill(id: SkillId): SkillMeta {
  const skill = SKILLS[id];
  if (!skill) {
    throw new Error(`Skill '${id}' not found in registry`);
  }
  return skill;
}

/**
 * Get connector metadata by ID
 */
export function getConnector(id: ConnectorId): ConnectorMeta {
  const connector = CONNECTORS[id];
  if (!connector) {
    throw new Error(`Connector '${id}' not found in registry`);
  }
  return connector;
}
