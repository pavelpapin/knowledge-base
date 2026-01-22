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
 * Run hourly via cron: 0 * * * * /root/.claude/scripts/system-loop/index.ts
 */

import { execSync } from 'child_process'
import { CONFIG } from './config.js'
import { log, loadEnv, loadJson, saveJson, sendTelegram } from './utils.js'
import { shouldRunNow, getNextRun } from './schedule.js'
import { collectItems } from './collector.js'
import { executeItem } from './executor.js'
import type { LoopState, SchedulableItem, RunResult } from './types.js'

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

    // Run backlog sync and save reports if team members were executed
    const hasTeamMembers = results.some(r => r.item.type === 'team-member')
    if (hasTeamMembers) {
      const today = now.toISOString().split('T')[0]

      // Sync backlog items to Notion
      log('Running backlog sync to Notion...')
      try {
        execSync('npx tsx /root/.claude/scripts/sync-backlog-to-notion.ts', {
          cwd: '/root/.claude',
          timeout: 120000,
          encoding: 'utf-8'
        })
        log('Backlog sync complete')
      } catch (err) {
        log(`Backlog sync failed: ${err}`, 'error')
      }

      // Save team reports to Notion
      log('Saving team reports to Notion...')
      for (const reportType of ['cto', 'cpo', 'ceo']) {
        try {
          execSync(`npx tsx /root/.claude/scripts/save-report-to-notion.ts ${reportType} ${today}`, {
            cwd: '/root/.claude',
            timeout: 60000,
            encoding: 'utf-8'
          })
          log(`${reportType.toUpperCase()} report saved to Notion`)
        } catch (err) {
          log(`Failed to save ${reportType} report: ${err}`, 'error')
        }
      }
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
