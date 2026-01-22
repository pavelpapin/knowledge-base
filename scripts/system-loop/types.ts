/**
 * System Loop Types
 */

export interface TeamMember {
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

export interface Collector {
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

export interface TeamConfig {
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

export interface ScheduledWorkflow {
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

export interface SchedulesConfig {
  schedules: ScheduledWorkflow[]
  verificationRules: Record<string, unknown>
}

export interface SchedulableItem {
  id: string
  type: 'collector' | 'team-member' | 'workflow' | 'db-task' | 'standup' | 'weekly-summary'
  name: string
  cron: string
  timezone: string
  enabled: boolean
  after?: string
  config: Record<string, unknown>
}

export interface ItemState {
  lastRun: string
  lastStatus: 'pending' | 'running' | 'success' | 'failed'
  workflowId?: string
  error?: string
  duration?: number
}

export interface LoopState {
  lastRun: string
  lastHeartbeat: string
  items: Record<string, ItemState>
  version: number
}

export interface RunResult {
  success: boolean
  workflowId?: string
  error?: string
  duration?: number
}
