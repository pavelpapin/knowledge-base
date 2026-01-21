# Changelog

All notable changes to Elio OS are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [3.2.0] - 2026-01-20

### Added
- **Worker-Based Agent Execution** - New architecture inspired by [myagent](https://github.com/serge-arbor/myagent)
  - `@elio/workflow` - Temporal-like API for workflow orchestration using BullMQ
  - `@elio/agent-runner` - CLI process management with streaming output
  - `@elio/shared` - Shared paths and utilities
  - `apps/worker` - Background workers for agent execution

- **New MCP Tools for Agents**
  - `elio_agent_start` - Start background agent workflow
  - `elio_agent_status` - Query agent status
  - `elio_agent_signal` - Send signals (userInput, cancel)
  - `elio_agent_cancel` - Cancel running agent

- **BullMQ + Redis Infrastructure**
  - Redis Streams for real-time output
  - Redis PubSub for signals
  - Redis hashes for workflow state
  - `docker-compose.yml` with Redis service

- **AgentNotificationService**
  - Debounced notifications to Telegram
  - Input request notifications
  - Progress updates

- **Structured Error Hierarchy**
  - `WorkflowError`, `ConnectionError`, `TimeoutError`
  - `AgentExecutionError`, `CancellationError`
  - `isRetryable()` and `wrapError()` helpers

- **BoundedAsyncQueue**
  - Prevents memory overflow during agent execution
  - Configurable max size and overflow behavior

### Changed
- Migrated from npm to pnpm workspace
- Added workspace packages structure
- Updated `package.json` to v3.2.0

### Technical
- Worker concurrency: 4 for agents, 2 for scheduled tasks
- Redis Streams with MAXLEN ~1000 for auto-cleanup
- Session persistence via `sessionId` parameter

---

## [3.1.2] - 2026-01-19

### Changed
- **Slack Integration Refactor** - Split 283 line file into modular structure
  - `types.ts` - SlackMessage, SlackChannel, SlackUser interfaces
  - `client.ts` - Base HTTP client with auth
  - `messages.ts` - sendMessage, updateMessage, deleteMessage, addReaction, searchMessages
  - `channels.ts` - listChannels, getChannel, getChannelHistory, joinChannel
  - `users.ts` - listUsers, getUser, getUserByEmail, openDM, sendDM
  - `index.ts` - Clean re-exports with formatters

- **Calendar Integration Refactor** - Split 279 line file into modular structure
  - `types.ts` - GoogleToken, CalendarEvent, CalendarList interfaces
  - `client.ts` - OAuth token management, base HTTP client
  - `api.ts` - listCalendars, listEvents, createEvent, deleteEvent, getTodayEvents, getWeekEvents
  - `index.ts` - Clean re-exports

- **Perplexity Integration Refactor** - Split 276 line file into modular structure
  - `types.ts` - PerplexityCredentials, PerplexityResponse, SearchResult types
  - `client.ts` - API key management, base HTTP client
  - `api.ts` - search, research, factCheck, summarize, compare
  - `index.ts` - Clean re-exports

- **NotebookLM Integration Refactor** - Split 261 line file into modular structure
  - `notebooks.ts` - createNotebook, getNotebook, listNotebooks, deleteNotebook, addNote, getNotes
  - `sources.ts` - addTextSource, addUrlSource, addGoogleDocSource, removeSource
  - `export.ts` - exportForNotebookLM, generateAnalysisPrompt, getStats
  - `index.ts` - Clean re-exports (was 261 lines, now 32 lines)

### Technical
- All integration files now under 200 lines (code quality standard)
- Consistent module pattern: types → client → api → index
- Backwards-compatible re-exports maintain existing API

---

## [3.1.1] - 2026-01-20

### Changed
- **Database Adapter Refactor** - Split 279 line file into modular structure
  - `schemas.ts` - Zod schemas with safe JSON parsing
  - `tools/workflow.ts` - Workflow run tools
  - `tools/schedule.ts` - Schedule management tools
  - `tools/task.ts` - GTD task tools
  - `tools/state.ts` - State and message tools
  - `index.ts` - Clean composition (19 lines)

- **SQL Adapter Security** - Fixed path traversal vulnerability
  - Whitelist validation for migration files
  - Cannot access files outside migrations directory

- **Memory Leak Fixes**
  - Rate limiter now cleans up expired entries
  - Cache has auto-cleanup interval (every 5 min)
  - Proper `destroy()` method for cleanup

### Removed
- Deleted duplicate `/src/integrations/supabase/index.ts` (389 lines)
  - Was duplicating Repository pattern functionality
  - All code now uses `/src/db/` layer

### Fixed
- `tasks_active` tool now respects `limit` parameter
- All JSON parsing now uses `safeJsonParse()` with proper error handling

---

## [3.1.0] - 2026-01-20

### Added
- **Supabase Integration** - PostgreSQL database for persistent state
  - Tables: `workflow_runs`, `scheduled_tasks`, `messages`, `tasks`, `people`, `conversation_memory`, `system_state`
  - Extended schema: `skill_executions`, `audit_log`, `improvements`, `entities`, `relationships`, `integration_state`, `artifacts`
  - Migrations in `/mcp-server/migrations/`

- **Repository Pattern** - Clean data access layer
  - `WorkflowRepository` - workflow run tracking
  - `ScheduleRepository` - scheduled tasks
  - `MessageRepository` - inbox messages
  - `TaskRepository` - GTD tasks
  - `PersonRepository` - CRM contacts
  - `AuditRepository` - security logs
  - `StateRepository` - key-value state

- **Cache Layer** - In-memory caching with TTL
  - `getDb().cache.getOrSet()` for cached queries
  - Auto-expiry and pattern invalidation

- **New MCP Tools**
  - `elio_database_task_create` - create GTD task
  - `elio_database_task_stats` - task statistics
  - `elio_database_tasks_active` - active tasks list
  - `elio_database_health` - database health check

### Changed
- Database adapter now uses Repository pattern instead of direct Supabase calls
- Credentials path added: `/root/.claude/secrets/supabase.json`

---

## [3.0.0] - 2026-01-19

### Added
- **MCP Gateway Architecture** - Central gateway with policy engine
  - Tool classification: read/write/dangerous/sandbox
  - Rate limiting per tool
  - Audit logging with PII redaction
  - Schema validation via Zod

- **Adapter Pattern** - Each integration as separate adapter
  - Gmail, Calendar, Telegram, Slack, Notion
  - Perplexity, LinkedIn, n8n, NotebookLM
  - Google Sheets, Google Docs

- **Structured Logger** - Centralized logging
  - Log levels: debug/info/warn/error
  - Context-aware logging via `createLogger()`

### Changed
- Removed old `/tools/` folder - replaced by `/adapters/`
- Removed duplicate `integrations/gmail.ts` - use `adapters/gmail/`
- Split `gmail/api.ts` into `auth.ts` + `api.ts` (was 223 lines, now <200 each)
- All `console.log` replaced with logger

### Fixed
- Zod v4 compatibility with `zod-to-json-schema`
- Various adapter API signature mismatches

---

## [2.0.0] - 2026-01-18

### Added
- **Turborepo Monorepo** - Multi-package architecture
  - `@elio/shared` - centralized config, paths, store utilities
  - `@elio/core` - event bus, store
  - `@elio/mcp-server` - MCP integrations
  - `@elio/gtd` - task management
  - `@elio/scheduler` - job scheduling
  - `@elio/headless` - background tasks
  - `@elio/context-graph` - knowledge graph
  - `@elio/self-improvement` - learning system

- **Event Bus** - Pub/sub for cross-module communication
  - Auto-emit on store save/update
  - Subscribe to data changes

- **Centralized Config** - All paths in `@elio/shared`
  - `paths.credentials.*` for all secrets
  - `paths.data.*` for all data stores

---

## [1.0.0] - 2026-01-15

### Added
- Initial Elio OS structure
- Skills system with `/skills/` folder
- Workflows system with `/workflows/` folder
- Context loading from `/context/`
- MCP Server with basic integrations
- Telegram bot integration

---

## Version Numbering

- **Major (X.0.0)** - Breaking changes, architecture shifts
- **Minor (0.X.0)** - New features, backward compatible
- **Patch (0.0.X)** - Bug fixes, small improvements
