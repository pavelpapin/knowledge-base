/**
 * System Loop - Collect Schedulable Items
 */

import { CONFIG } from './config.js'
import { loadJson } from './utils.js'
import { timeToCron } from './schedule.js'
import type { SchedulableItem, TeamConfig, SchedulesConfig } from './types.js'

export function collectItems(): SchedulableItem[] {
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

  // 4. Standup
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

  // 5. Weekly summary
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

  // 6. Scheduled workflows from config/schedules.json
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

  // 7. TODO: Database scheduled_tasks (when MCP is available)
  // Would call: schedules_due via MCP or direct DB query

  return items
}
