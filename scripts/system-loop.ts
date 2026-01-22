#!/usr/bin/env npx tsx
/**
 * System Loop - Universal Orchestration Agent
 *
 * Unified hourly loop that manages ALL scheduled work:
 * 1. Team members (CEO, CTO, CPO) from team/config.json
 * 2. Scheduled workflows from config/schedules.json
 * 3. Database scheduled_tasks from Supabase
 * 4. Standup and weekly summaries
 *
 * Architecture:
 * - Reads from multiple config sources
 * - Checks cron expressions against current time
 * - Spawns work via BullMQ queues (or CLI fallback)
 * - Tracks state in database + local file backup
 * - Sends notifications on start/complete/error
 *
 * Run hourly via cron: 0 * * * * /root/.claude/scripts/system-loop.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { spawn, execSync } from 'child_process'
import { Cron } from 'croner'

// ============ Configuration ============

const CONFIG = {
  teamConfig: '/root/.claude/team/config.json',
  schedulesConfig: '/root/.claude/config/schedules.json',
  workflowsDir: '/root/.claude/workflows',
  rolesDir: '/root/.claude/team',
  stateFile: '/root/.claude/state/system-loop-state.json',
  logDir: '/root/.claude/logs/system-loop',
  defaultTimezone: 'Asia/Tbilisi',
  catchUpWindowHours: 2,
  agentTimeoutMinutes: 30,
}

// ============ Types ============

interface TeamMember {
  enabled: boolean
  name: string
  description: string
  schedule: {
    type: string
    cron: string
    after?: string
    description: string
  }
  triggers: string[]
  permissions: Record<string, unknown>
  reports: Record<string, unknown>
  backlog?: Record<string, unknown>
  manages?: string[]
}

interface Collector {
  enabled: boolean
  name: string
  description: string
  schedule: {
    type: string
    cron: string
    description: string
  }
  workflow: string
  outputs: {
    path: string
    notify: boolean
  }
}

interface TeamConfig {
  team: string
  timezone: string
  collectors?: Record<string, Collector>
  members: Record<string, TeamMember>
  standup: {
    enabled: boolean
    time: string
    channel: string
    includeMembers: string[]
  }
  weeklySummary: {
    enabled: boolean
    day: string
    time: string
  }
}

interface ScheduledWorkflow {
  name: string
  description: string
  workflow: string
  frequency: string
  cron: string
  timezone: string
  localTime: string
  enabled: boolean
  config: Record<string, unknown>
  verification?: Record<string, unknown>
}

interface SchedulesConfig {
  schedules: ScheduledWorkflow[]
  verificationRules: Record<string, unknown>
}

interface SchedulableItem {
  id: string
  type: 'collector' | 'team-member' | 'workflow' | 'db-task' | 'standup' | 'weekly-summary'
  name: string
  cron: string
  timezone: string
  enabled: boolean
  after?: string
  config: Record<string, unknown>
}

interface ItemState {
  lastRun: string
  lastStatus: 'pending' | 'running' | 'success' | 'failed'
  workflowId?: string
  error?: string
  duration?: number
}

interface LoopState {
  lastRun: string
  lastHeartbeat: string
  items: Record<string, ItemState>
  version: number
}

interface RunResult {
  success: boolean
  workflowId?: string
  error?: string
  duration?: number
}

// ============ Utilities ============

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
  const timestamp = new Date().toISOString()
  const prefix = { info: '📋', warn: '⚠️', error: '❌', debug: '🔍' }[level]
  console.log(`[${timestamp}] ${prefix} ${message}`)

  ensureDir(CONFIG.logDir)
  const logFile = path.join(CONFIG.logDir, `${new Date().toISOString().split('T')[0]}.log`)
  fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`)
}

function loadEnv(): void {
  // Load from .env file if exists
  const envPath = '/root/.claude/secrets/.env'
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      }
    }
  }

  // Load Telegram credentials from JSON
  const telegramPath = '/root/.claude/secrets/telegram.json'
  if (fs.existsSync(telegramPath)) {
    try {
      const telegram = JSON.parse(fs.readFileSync(telegramPath, 'utf-8'))
      if (telegram.bot_token) process.env.TELEGRAM_BOT_TOKEN = telegram.bot_token
      if (telegram.default_chat_id) process.env.TELEGRAM_CHAT_ID = telegram.default_chat_id
    } catch {}
  }

  // Load Supabase credentials from JSON
  const supabasePath = '/root/.claude/secrets/supabase.json'
  if (fs.existsSync(supabasePath)) {
    try {
      const supabase = JSON.parse(fs.readFileSync(supabasePath, 'utf-8'))
      if (supabase.url) process.env.SUPABASE_URL = supabase.url
      if (supabase.service_key) process.env.SUPABASE_SERVICE_KEY = supabase.service_key
    } catch {}
  }
}

function loadJson<T>(filepath: string, fallback: T): T {
  if (!fs.existsSync(filepath)) return fallback
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch (error) {
    log(`Failed to load ${filepath}: ${error}`, 'warn')
    return fallback
  }
}

function saveJson(filepath: string, data: unknown): void {
  ensureDir(path.dirname(filepath))
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

function sendTelegram(message: string): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    log('Telegram not configured', 'debug')
    return false
  }

  try {
    execSync(
      `curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" ` +
      `-d "chat_id=${chatId}" ` +
      `-d "text=${encodeURIComponent(message)}" ` +
      `-d "parse_mode=HTML"`,
      { timeout: 10000, stdio: 'ignore' }
    )
    return true
  } catch (error) {
    log(`Telegram failed: ${error}`, 'error')
    return false
  }
}

// ============ Schedule Checking ============

function shouldRunNow(cron: string, timezone: string, lastRun: string | undefined): boolean {
  try {
    const cronJob = new Cron(cron, { timezone })
    const now = new Date()
    const catchUpWindow = new Date(now.getTime() - CONFIG.catchUpWindowHours * 60 * 60 * 1000)

    // Get previous and next scheduled times
    let prev = cronJob.previousRun(now)
    const next = cronJob.nextRun(now)

    // Croner bug workaround: previousRun returns undefined right at/after scheduled time
    // Calculate what prev SHOULD be based on the cron pattern
    if (!prev && next) {
      // Determine the interval from the cron pattern
      // For daily: 24h, for weekly: 7*24h, for hourly: 1h, etc.
      const nextNext = cronJob.nextRun(new Date(next.getTime() + 1000))
      if (nextNext) {
        const intervalMs = nextNext.getTime() - next.getTime()
        const possiblePrev = new Date(next.getTime() - intervalMs)

        // Only use this if it's within our catch-up window
        if (possiblePrev > catchUpWindow && possiblePrev <= now) {
          prev = possiblePrev
        }
      }
    }

    // No previous scheduled time within catch-up window
    if (!prev) return false

    // Never ran before AND prev is within catch-up window - run now
    if (!lastRun) {
      return prev > catchUpWindow
    }

    const lastRunDate = new Date(lastRun)

    // Should run if: scheduled time is after our last run AND within catch-up window
    return prev > lastRunDate && prev > catchUpWindow
  } catch (error) {
    log(`Cron check error for "${cron}": ${error}`, 'error')
    return false
  }
}

function getNextRun(cron: string, timezone: string): Date | null {
  try {
    const cronJob = new Cron(cron, { timezone })
    return cronJob.nextRun() || null
  } catch {
    return null
  }
}

function timeToCron(time: string, dayOfWeek?: string): string {
  // Convert "HH:MM" to cron
  const [hours, minutes] = time.split(':').map(Number)
  if (dayOfWeek) {
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    }
    return `${minutes} ${hours} * * ${days[dayOfWeek.toLowerCase()] ?? 0}`
  }
  return `${minutes} ${hours} * * *`
}

// ============ Collect Schedulable Items ============

function collectItems(): SchedulableItem[] {
  const items: SchedulableItem[] = []

  // 1. Load team config
  const teamConfig = loadJson<TeamConfig>(CONFIG.teamConfig, {
    team: '', timezone: 'UTC', collectors: {}, members: {},
    standup: { enabled: false, time: '', channel: '', includeMembers: [] },
    weeklySummary: { enabled: false, day: '', time: '' }
  })
  const teamTz = teamConfig.timezone || CONFIG.defaultTimezone

  // 2. Collectors from team/config.json (run first)
  for (const [collectorId, collector] of Object.entries(teamConfig.collectors || {})) {
    if (collector.schedule?.cron) {
      items.push({
        id: `collector:${collectorId}`,
        type: 'collector',
        name: collector.name,
        cron: collector.schedule.cron,
        timezone: teamTz,
        enabled: collector.enabled,
        config: { collectorId, workflow: collector.workflow, ...collector }
      })
    }
  }

  // 3. Team members from team/config.json
  for (const [memberId, member] of Object.entries(teamConfig.members)) {
    if (member.schedule?.cron) {
      items.push({
        id: `team:${memberId}`,
        type: 'team-member',
        name: member.name,
        cron: member.schedule.cron,
        timezone: teamTz,
        enabled: member.enabled,
        after: member.schedule.after ?
          (member.schedule.after.startsWith('day-review') ? `collector:${member.schedule.after}` : `team:${member.schedule.after}`) :
          undefined,
        config: { memberId, ...member }
      })
    }
  }

  // 2. Standup
  if (teamConfig.standup?.enabled && teamConfig.standup.time) {
    items.push({
      id: 'standup:daily',
      type: 'standup',
      name: 'Daily Standup',
      cron: timeToCron(teamConfig.standup.time),
      timezone: teamTz,
      enabled: true,
      config: teamConfig.standup
    })
  }

  // 3. Weekly summary
  if (teamConfig.weeklySummary?.enabled && teamConfig.weeklySummary.time) {
    items.push({
      id: 'weekly:summary',
      type: 'weekly-summary',
      name: 'Weekly Summary',
      cron: timeToCron(teamConfig.weeklySummary.time, teamConfig.weeklySummary.day),
      timezone: teamTz,
      enabled: true,
      config: teamConfig.weeklySummary
    })
  }

  // 4. Scheduled workflows from config/schedules.json
  const schedulesConfig = loadJson<SchedulesConfig>(CONFIG.schedulesConfig, {
    schedules: [], verificationRules: {}
  })

  for (const schedule of schedulesConfig.schedules) {
    items.push({
      id: `workflow:${schedule.name}`,
      type: 'workflow',
      name: schedule.description || schedule.name,
      cron: schedule.cron,
      timezone: schedule.timezone || 'UTC',
      enabled: schedule.enabled,
      config: {
        workflow: schedule.workflow,
        ...schedule.config,
        verification: schedule.verification
      }
    })
  }

  // 5. TODO: Database scheduled_tasks (when MCP is available)
  // Would call: schedules_due via MCP or direct DB query

  return items
}

// ============ Execution ============

function buildTeamMemberPrompt(memberId: string): string {
  const rolePath = path.join(CONFIG.rolesDir, memberId, 'ROLE.md')

  if (!fs.existsSync(rolePath)) {
    throw new Error(`Role file not found: ${rolePath}`)
  }

  const roleContent = fs.readFileSync(rolePath, 'utf-8')
  const now = new Date()
  const date = now.toISOString().split('T')[0]

  // Chain reading - each agent reads output from previous agents
  let chainReadingInstructions = ''

  if (memberId === 'cto') {
    // CTO reads Day Collector output
    chainReadingInstructions = `
## IMPORTANT: Read Day Collector Data First

Before starting your review, READ the Day Collector summary:
\`/root/.claude/logs/daily/${date}/day-summary.json\`

This file contains:
- errors.total, errors.critical — how many errors today
- git.commits, git.lines_added — what changed in code
- workflows.succeeded, workflows.failed — what ran
- system.* — system health metrics
- api_health.* — API status

Use this data to inform your Health Check and Architecture Review stages.
If errors.total > 10, this triggers Multi-Model Review Decision.

## CRITICAL: Backlog Update Required

For EVERY issue you find that is NOT auto-fixed, you MUST call:
\`\`\`
elio_backlog_create({
  title: "Description of issue",
  type: "technical",
  priority: "high",  // critical | high | medium | low
  category: "architecture",  // architecture | security | observability | performance | tech-debt
  description: "Details...",
  effort: "m",  // xs | s | m | l | xl
  source: "cto_review",
  sync_to_notion: true
})
\`\`\`

At the end, sync backlog: \`elio_backlog_sync({ type: "technical" })\`
`
  } else if (memberId === 'cpo') {
    // CPO reads Day Collector + CTO report
    chainReadingInstructions = `
## IMPORTANT: Read Previous Reports First

Before starting your review, READ these files:

1. Day Collector summary (for conversations data):
   \`/root/.claude/logs/daily/${date}/day-summary.json\`
   - conversations.total_messages — how many interactions
   - conversations.corrections — user corrections (quality signal!)
   - conversations.requests — what users asked for
   - conversations.feedback — positive/negative signals

2. CTO Report (for technical context):
   \`/root/.claude/logs/team/cto/${date}.md\`
   - What technical issues were found
   - What was auto-fixed
   - System health status

Use this data to understand what happened today from user and technical perspectives.

## CRITICAL: Backlog Update Required

For EVERY improvement you propose, you MUST call:
\`\`\`
elio_backlog_create({
  title: "Improvement description",
  type: "product",
  priority: "high",  // critical | high | medium | low
  category: "quality",  // quality | eval | spec | feature | ux
  description: "Details...",
  effort: "m",  // xs | s | m | l | xl
  impact: "high",  // high | medium | low
  source: "cpo_review",
  source_quote: "Original user feedback if applicable",
  sync_to_notion: true
})
\`\`\`

At the end, sync backlog: \`elio_backlog_sync({ type: "product" })\`
`
  } else if (memberId === 'ceo') {
    // CEO reads CTO + CPO reports
    chainReadingInstructions = `
## IMPORTANT: Read Team Reports First

Before making decisions, READ these files:

1. CTO Report:
   \`/root/.claude/logs/team/cto/${date}.md\`
   - System health status
   - Technical issues and fixes
   - Security concerns
   - Items added to technical backlog

2. CPO Report:
   \`/root/.claude/logs/team/cpo/${date}.md\`
   - Quality metrics
   - User feedback summary
   - Failure analysis
   - Improvements proposed

3. Current Backlogs - CALL THESE TOOLS:
   \`\`\`
   elio_backlog_stats({})  // Get overview
   elio_backlog_list({ type: "technical", status: "backlog" })
   elio_backlog_list({ type: "product", status: "backlog" })
   elio_backlog_list({ status: "blocked" })  // What's stuck?
   \`\`\`

## CRITICAL: Backlog Management Required

For EVERY decision you make:

1. **Assign new task to CTO:**
   \`\`\`
   elio_backlog_create({
     title: "Task description",
     type: "technical",
     priority: "high",
     category: "architecture",
     description: "What to do and why",
     source: "manual",
     sync_to_notion: true
   })
   \`\`\`

2. **Assign new task to CPO:**
   \`\`\`
   elio_backlog_create({
     title: "Task description",
     type: "product",
     priority: "high",
     category: "quality",
     description: "What to do and why",
     source: "manual",
     sync_to_notion: true
   })
   \`\`\`

3. **Cut/deprioritize task:**
   \`\`\`
   elio_backlog_update({
     id: "task-uuid",
     status: "cancelled",  // or priority: "low"
     sync_to_notion: true
   })
   \`\`\`

At the end, sync all backlogs: \`elio_backlog_sync({})\`
`
  }

  return `You are the ${memberId.toUpperCase()} agent for Elio OS.

Read and follow your role definition below, then execute your scheduled review workflow.
${chainReadingInstructions}
${roleContent}

---

Execute your review now. Follow all stages in your workflow.

At the end, you MUST:
1. Add ALL issues/improvements to backlog (use elio_backlog_create)
2. Sync backlog with Notion (use elio_backlog_sync)
3. Generate your report in the specified format
4. Save it to Notion (use elio_notion_create_page with your database ID)
5. Send a summary via Telegram (use elio_telegram_notify)
6. Save locally to /root/.claude/logs/team/${memberId}/${date}.md

Current time: ${now.toISOString()}
Timezone: Asia/Tbilisi
Local time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' })}

Begin your review now.`
}

function buildCollectorPrompt(workflowName: string, _config: Record<string, unknown>): string {
  // Day Collector runs as a script, not as an agent prompt
  // This prompt is only used if script execution fails
  const date = new Date().toISOString().split('T')[0]

  return `You are executing the "${workflowName}" collector for Elio OS.

IMPORTANT: The Day Collector script should have already run.
Check if the output exists at: /root/.claude/logs/daily/${date}/day-summary.json

If the file exists and is recent (within last hour), your job is DONE.

If the file does NOT exist or is stale, collect data manually:

1. Errors: Read /root/.claude/logs/errors/${date}.jsonl and scan log files
2. Git: Run \`git log --since="24 hours ago"\` in /root/.claude
3. System: Check disk (df), memory (free), redis (redis-cli INFO)
4. APIs: Ping Telegram, Supabase, Redis

Save results to: /root/.claude/logs/daily/${date}/day-summary.json

Current time: ${new Date().toISOString()}`
}

function buildWorkflowPrompt(workflowName: string, config: Record<string, unknown>): string {
  const workflowPath = path.join(CONFIG.workflowsDir, workflowName, 'WORKFLOW.md')

  let workflowContent = ''
  if (fs.existsSync(workflowPath)) {
    workflowContent = fs.readFileSync(workflowPath, 'utf-8')
  }

  return `You are executing the "${workflowName}" workflow for Elio OS.

${workflowContent ? `Workflow definition:\n\n${workflowContent}\n\n---\n\n` : ''}

Configuration:
${JSON.stringify(config, null, 2)}

Execute this workflow now. Follow all stages.
Send notifications via Telegram when done.
Save results to appropriate location.

Current time: ${new Date().toISOString()}

Begin execution.`
}

function buildStandupPrompt(config: Record<string, unknown>): string {
  const members = (config.includeMembers as string[]) || []

  return `You are executing the Daily Standup for Elio OS.

Your task:
1. Read the latest reports from each team member:
${members.map(m => `   - /root/.claude/logs/team/${m}/`).join('\n')}

2. Consolidate into a single standup summary with sections for each member

3. Send the consolidated standup via Telegram

4. Save to /root/.claude/logs/standups/

Include for each member:
- Key accomplishments since last standup
- Current priorities
- Any blockers or issues

Current time: ${new Date().toISOString()}

Begin standup.`
}

function buildWeeklySummaryPrompt(_config: Record<string, unknown>): string {
  return `You are executing the Weekly Summary for Elio OS.

Your task:
1. Review all team reports from the past week
2. Review all workflow executions and their results
3. Compile key metrics and trends
4. Identify wins and areas for improvement

Create a comprehensive weekly summary and:
1. Save to Notion
2. Send highlights via Telegram
3. Save locally to /root/.claude/logs/weekly/

Current time: ${new Date().toISOString()}

Begin weekly summary.`
}

async function executeItem(item: SchedulableItem): Promise<RunResult> {
  const startTime = Date.now()
  log(`Executing: ${item.id} (${item.type})`)

  try {
    // Special handling for collectors - run script directly
    if (item.type === 'collector') {
      return await runCollectorScript(item)
    }

    let prompt: string

    switch (item.type) {
      case 'team-member': {
        const memberId = item.config.memberId as string
        prompt = buildTeamMemberPrompt(memberId)
        break
      }
      case 'workflow': {
        const workflowName = item.config.workflow as string
        prompt = buildWorkflowPrompt(workflowName, item.config)
        break
      }
      case 'standup': {
        prompt = buildStandupPrompt(item.config)
        break
      }
      case 'weekly-summary': {
        prompt = buildWeeklySummaryPrompt(item.config)
        break
      }
      default:
        throw new Error(`Unknown item type: ${item.type}`)
    }

    // Try BullMQ first
    let result = await runViaBullMQ(item.id, prompt)

    if (!result.success) {
      log(`BullMQ failed for ${item.id}, trying CLI`, 'warn')
      result = await runViaCLI(item.id, prompt)
    }

    result.duration = Date.now() - startTime
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Execution error for ${item.id}: ${errorMsg}`, 'error')
    return { success: false, error: errorMsg, duration: Date.now() - startTime }
  }
}

async function runCollectorScript(item: SchedulableItem): Promise<RunResult> {
  const startTime = Date.now()
  const workflowName = item.config.workflow as string

  // Map workflow name to script
  const scriptPath = `/root/.claude/scripts/${workflowName}.ts`

  if (!fs.existsSync(scriptPath)) {
    log(`Collector script not found: ${scriptPath}`, 'error')
    return { success: false, error: `Script not found: ${scriptPath}` }
  }

  try {
    log(`Running collector script: ${scriptPath}`)
    execSync(`npx tsx ${scriptPath}`, {
      cwd: '/root/.claude',
      timeout: 5 * 60 * 1000, // 5 minutes
      stdio: 'inherit'
    })

    return {
      success: true,
      workflowId: `script-${workflowName}`,
      duration: Date.now() - startTime
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Collector script failed: ${errorMsg}`, 'error')

    // Fallback to agent if script fails
    log('Falling back to agent for collection', 'warn')
    const prompt = buildCollectorPrompt(workflowName, item.config)
    return await runViaCLI(item.id, prompt)
  }
}

async function runViaBullMQ(itemId: string, prompt: string): Promise<RunResult> {
  // Try to connect to BullMQ via the workflow package
  try {
    // Check if Redis is available
    execSync('redis-cli ping', { timeout: 5000, stdio: 'pipe' })

    // Use the agents MCP tool via direct queue addition
    const { Queue } = await import('bullmq')
    const queue = new Queue('agent-queue', {
      connection: { host: 'localhost', port: 6379 }
    })

    const workflowId = `${itemId.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`

    await queue.add('agent-execution', {
      workflowId,
      params: {
        prompt,
        cwd: '/root/.claude',
        chatId: process.env.TELEGRAM_CHAT_ID,
      }
    }, { jobId: workflowId })

    await queue.close()

    log(`BullMQ job added: ${workflowId}`)
    return { success: true, workflowId }
  } catch (error) {
    return { success: false, error: `BullMQ error: ${error}` }
  }
}

async function runViaCLI(itemId: string, prompt: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const safeId = itemId.replace(/[^a-zA-Z0-9]/g, '-')
    const logFile = path.join(CONFIG.logDir, `${safeId}_${Date.now()}.log`)

    // Write prompt to temp file to avoid shell escaping issues
    const promptFile = `/tmp/system-loop-prompt-${Date.now()}.txt`
    fs.writeFileSync(promptFile, prompt)

    const proc = spawn('bash', ['-c', `claude -p "$(cat ${promptFile})"`], {
      cwd: '/root/.claude',
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: 'cli',
      },
      timeout: CONFIG.agentTimeoutMinutes * 60 * 1000,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const logStream = fs.createWriteStream(logFile)
    proc.stdout?.pipe(logStream)
    proc.stderr?.pipe(logStream)

    proc.unref()

    log(`CLI spawned for ${itemId}, PID: ${proc.pid}`)

    // Cleanup temp file after a delay
    setTimeout(() => {
      try { fs.unlinkSync(promptFile) } catch {}
    }, 60000)

    resolve({
      success: true,
      workflowId: `cli-${proc.pid}`
    })
  })
}

// ============ Main Loop ============

async function main(): Promise<void> {
  log('═══════════════════════════════════════════')
  log('  System Loop Started')
  log('═══════════════════════════════════════════')

  loadEnv()

  const now = new Date()
  const state = loadJson<LoopState>(CONFIG.stateFile, {
    lastRun: '',
    lastHeartbeat: '',
    items: {},
    version: 1
  })

  state.lastRun = now.toISOString()

  // Collect all schedulable items
  const items = collectItems()
  log(`Found ${items.length} schedulable items`)

  // Determine what to run
  const toRun: SchedulableItem[] = []
  const skipped: string[] = []

  for (const item of items) {
    if (!item.enabled) {
      skipped.push(`${item.id} (disabled)`)
      continue
    }

    const lastRun = state.items[item.id]?.lastRun
    const shouldRun = shouldRunNow(item.cron, item.timezone, lastRun)
    const nextRun = getNextRun(item.cron, item.timezone)

    log(`${item.id}: shouldRun=${shouldRun}, lastRun=${lastRun || 'never'}, next=${nextRun?.toISOString() || 'unknown'}`, 'debug')

    if (!shouldRun) {
      continue
    }

    // Check "after" dependency
    if (item.after) {
      const depState = state.items[item.after]
      if (!depState?.lastRun) {
        skipped.push(`${item.id} (waiting for ${item.after})`)
        continue
      }

      const depRunDate = new Date(depState.lastRun)
      const catchUp = new Date(now.getTime() - CONFIG.catchUpWindowHours * 60 * 60 * 1000)

      if (depRunDate < catchUp) {
        skipped.push(`${item.id} (${item.after} too old)`)
        continue
      }

      if (depState.lastStatus === 'failed') {
        skipped.push(`${item.id} (${item.after} failed)`)
        continue
      }
    }

    toRun.push(item)
  }

  if (skipped.length > 0) {
    log(`Skipped: ${skipped.join(', ')}`, 'debug')
  }

  // Sort: collectors first, then team members (CTO -> CPO -> CEO), then workflows
  toRun.sort((a, b) => {
    // Collectors always first
    if (a.type === 'collector' && b.type !== 'collector') return -1
    if (a.type !== 'collector' && b.type === 'collector') return 1

    // Team members second
    if (a.type === 'team-member' && b.type !== 'team-member') return -1
    if (a.type !== 'team-member' && b.type === 'team-member') return 1

    // Among team members: CTO -> CPO -> CEO (by cron time order)
    if (a.type === 'team-member' && b.type === 'team-member') {
      // CTO first (00:30)
      if (a.id === 'team:cto') return -1
      if (b.id === 'team:cto') return 1
      // CPO second (01:00)
      if (a.id === 'team:cpo') return -1
      if (b.id === 'team:cpo') return 1
      // CEO last (01:30)
    }

    return 0
  })

  // Execute
  if (toRun.length === 0) {
    log('Nothing scheduled to run now')
  } else {
    const names = toRun.map(i => i.name).join(', ')
    log(`Running ${toRun.length} item(s): ${names}`)

    sendTelegram(
      `🔄 <b>System Loop</b>\n\n` +
      `Starting: ${toRun.map(i => i.name).join(', ')}\n` +
      `Time: ${now.toLocaleString('en-US', { timeZone: CONFIG.defaultTimezone })}`
    )

    const results: Array<{ item: SchedulableItem; result: RunResult }> = []

    for (const item of toRun) {
      // Mark as running
      state.items[item.id] = {
        lastRun: now.toISOString(),
        lastStatus: 'running'
      }
      saveJson(CONFIG.stateFile, state)

      const result = await executeItem(item)
      results.push({ item, result })

      // Update state
      state.items[item.id] = {
        lastRun: now.toISOString(),
        lastStatus: result.success ? 'success' : 'failed',
        workflowId: result.workflowId,
        error: result.error,
        duration: result.duration
      }
      saveJson(CONFIG.stateFile, state)

      // Small delay between executions
      await new Promise(r => setTimeout(r, 3000))
    }

    // Send completion summary
    const summary = results.map(r => {
      const status = r.result.success ? '✅' : '❌'
      const duration = r.result.duration ? ` (${Math.round(r.result.duration / 1000)}s)` : ''
      return `${status} ${r.item.name}${duration}`
    }).join('\n')

    sendTelegram(
      `✅ <b>System Loop Complete</b>\n\n${summary}`
    )
  }

  // Hourly heartbeat
  const shouldHeartbeat = now.getMinutes() === 0 && (
    !state.lastHeartbeat ||
    new Date(state.lastHeartbeat).getTime() < now.getTime() - 3600000
  )

  if (shouldHeartbeat) {
    const enabledItems = items.filter(i => i.enabled)
    const statusLines = enabledItems.map(item => {
      const s = state.items[item.id]
      const icon = s?.lastStatus === 'success' ? '🟢' :
                   s?.lastStatus === 'failed' ? '🔴' :
                   s?.lastStatus === 'running' ? '🟡' : '⚪'
      const lastRun = s?.lastRun ?
        new Date(s.lastRun).toLocaleTimeString('en-US', { timeZone: CONFIG.defaultTimezone }) :
        'never'
      return `${icon} ${item.name}: ${lastRun}`
    }).slice(0, 10) // Limit to first 10

    sendTelegram(
      `💓 <b>System Loop Heartbeat</b>\n\n` +
      `${statusLines.join('\n')}\n\n` +
      `⏰ ${now.toLocaleString('en-US', { timeZone: CONFIG.defaultTimezone })}`
    )

    state.lastHeartbeat = now.toISOString()
    saveJson(CONFIG.stateFile, state)
  }

  log('═══════════════════════════════════════════')
  log('  System Loop Complete')
  log('═══════════════════════════════════════════')
}

// Entry point
main().catch(error => {
  log(`Fatal error: ${error}`, 'error')
  console.error(error)
  sendTelegram(`❌ <b>System Loop FAILED</b>\n\n${error}`)
  process.exit(1)
})
