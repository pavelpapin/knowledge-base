/**
 * System Loop - Prompt Builders
 */

import * as fs from 'fs'
import * as path from 'path'
import { CONFIG } from './config.js'

export function buildTeamMemberPrompt(memberId: string): string {
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

export function buildCollectorPrompt(workflowName: string, _config: Record<string, unknown>): string {
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

export function buildWorkflowPrompt(workflowName: string, config: Record<string, unknown>): string {
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

export function buildStandupPrompt(config: Record<string, unknown>): string {
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

export function buildWeeklySummaryPrompt(_config: Record<string, unknown>): string {
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
