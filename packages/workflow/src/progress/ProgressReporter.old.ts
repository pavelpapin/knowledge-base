/**
 * Unified Progress Reporter
 * Single source of truth for workflow progress reporting via Redis Streams
 */

import type { Redis } from 'ioredis'
import { getStreamConnection, getStateConnection } from '../bullmq/connection.js'
import { REDIS_KEYS, type StreamUpdate, type WorkflowStatus } from '../types.js'
import type { NotificationChannel } from '../notifications/types.js'

export interface ProgressStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface ProgressState {
  workflowId: string
  status: WorkflowStatus
  progress: number
  currentStage?: string
  stages: ProgressStage[]
  startedAt: number
  lastActivity: number
  completedAt?: number
  error?: string
  metadata?: Record<string, unknown>
}

export interface ProgressReporterConfig {
  /** Telegram chat ID for notifications */
  chatId?: number | string
  /** Notification channel (Telegram, etc.) */
  notificationChannel?: NotificationChannel
  /** Debounce interval for notifications (ms) */
  notificationDebounceMs?: number
  /** Whether to send Telegram notifications */
  enableNotifications?: boolean
  /** Max stream entries before cleanup */
  maxStreamEntries?: number
}

const DEFAULT_CONFIG: Required<Omit<ProgressReporterConfig, 'chatId' | 'notificationChannel'>> = {
  notificationDebounceMs: 500,
  enableNotifications: true,
  maxStreamEntries: 1000,
}

export class ProgressReporter {
  private readonly streamRedis: Redis
  private readonly stateRedis: Redis
  private readonly config: Required<Omit<ProgressReporterConfig, 'chatId' | 'notificationChannel'>> &
    Pick<ProgressReporterConfig, 'chatId' | 'notificationChannel'>

  private state: ProgressState
  private notificationTimer?: NodeJS.Timeout
  private pendingNotification?: string
  private lastNotificationTime = 0

  constructor(
    workflowId: string,
    stages: string[],
    config?: ProgressReporterConfig
  ) {
    this.streamRedis = getStreamConnection()
    this.stateRedis = getStateConnection()
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.state = {
      workflowId,
      status: 'pending',
      progress: 0,
      stages: stages.map(name => ({ name, status: 'pending' })),
      startedAt: Date.now(),
      lastActivity: Date.now(),
    }
  }

  /**
   * Start the workflow
   */
  async start(description?: string): Promise<void> {
    this.state.status = 'running'
    this.state.startedAt = Date.now()
    this.state.lastActivity = Date.now()

    await this.syncState()
    await this.pushStream('output', `🚀 Started: ${description || 'Workflow'}`)

    if (this.config.enableNotifications && this.config.chatId) {
      await this.sendNotification(`🚀 *Started*\n${description || 'Workflow'}`)
    }
  }

  /**
   * Start a stage
   */
  async startStage(stageName: string, details?: string): Promise<void> {
    const stage = this.findStage(stageName)
    if (!stage) {
      console.warn(`[ProgressReporter] Stage not found: ${stageName}`)
      return
    }

    stage.status = 'running'
    stage.startedAt = Date.now()
    this.state.currentStage = stageName
    this.state.lastActivity = Date.now()
    this.updateProgress()

    await this.syncState()
    await this.pushStream('progress', `📋 ${stageName}${details ? `: ${details}` : ''}`)

    this.queueNotification(`📋 *${stageName}*${details ? `\n${details}` : ''}`)
  }

  /**
   * Complete a stage
   */
  async completeStage(stageName: string, result?: string): Promise<void> {
    const stage = this.findStage(stageName)
    if (!stage) return

    stage.status = 'completed'
    stage.completedAt = Date.now()
    this.state.lastActivity = Date.now()
    this.updateProgress()

    await this.syncState()
    await this.pushStream('progress', `✅ ${stageName} completed${result ? `: ${result}` : ''}`)
  }

  /**
   * Fail a stage
   */
  async failStage(stageName: string, error: string): Promise<void> {
    const stage = this.findStage(stageName)
    if (!stage) return

    stage.status = 'failed'
    stage.completedAt = Date.now()
    stage.error = error
    this.state.lastActivity = Date.now()

    await this.syncState()
    await this.pushStream('error', `❌ ${stageName} failed: ${error}`)

    if (this.config.enableNotifications && this.config.chatId) {
      await this.sendNotificationImmediate(`❌ *${stageName} failed*\n${error}`)
    }
  }

  /**
   * Skip a stage
   */
  async skipStage(stageName: string, reason?: string): Promise<void> {
    const stage = this.findStage(stageName)
    if (!stage) return

    stage.status = 'skipped'
    this.state.lastActivity = Date.now()
    this.updateProgress()

    await this.syncState()
    await this.pushStream('output', `⏭️ ${stageName} skipped${reason ? `: ${reason}` : ''}`)
  }

  /**
   * Log output
   */
  async log(message: string): Promise<void> {
    this.state.lastActivity = Date.now()
    await this.pushStream('output', message)
  }

  /**
   * Log thinking/processing
   */
  async thinking(message: string): Promise<void> {
    this.state.lastActivity = Date.now()
    await this.pushStream('thinking', message)
  }

  /**
   * Report progress percentage
   */
  async reportProgress(percent: number, status?: string): Promise<void> {
    this.state.progress = Math.min(100, Math.max(0, percent))
    this.state.lastActivity = Date.now()

    await this.syncState()

    const progressBar = this.makeProgressBar(percent)
    await this.pushStream('progress', `${progressBar} ${percent}%${status ? ` - ${status}` : ''}`)

    this.queueNotification(`⏳ *Progress: ${percent}%*\n${progressBar}${status ? `\n${status}` : ''}`)
  }

  /**
   * Request user input
   */
  async requestInput(prompt: string): Promise<void> {
    this.state.status = 'awaiting_input'
    this.state.lastActivity = Date.now()

    await this.syncState()
    await this.pushStream('input_request', prompt)

    if (this.config.enableNotifications && this.config.chatId) {
      await this.sendNotificationImmediate(`🤖 *Input required*\n\n${prompt}\n\n_Reply to continue_`)
    }
  }

  /**
   * Resume after input
   */
  async resumeFromInput(): Promise<void> {
    this.state.status = 'running'
    this.state.lastActivity = Date.now()
    await this.syncState()
  }

  /**
   * Complete the workflow
   */
  async complete(result?: string): Promise<void> {
    this.state.status = 'completed'
    this.state.progress = 100
    this.state.completedAt = Date.now()
    this.state.lastActivity = Date.now()

    // Mark all remaining stages as skipped
    for (const stage of this.state.stages) {
      if (stage.status === 'pending') {
        stage.status = 'skipped'
      }
    }

    await this.syncState()
    await this.pushStream('completed', result || 'Workflow completed')

    await this.flushNotifications()
    if (this.config.enableNotifications && this.config.chatId) {
      await this.sendNotificationImmediate(`✅ *Completed*\n${result || 'Workflow finished successfully'}`)
    }
  }

  /**
   * Fail the workflow
   */
  async fail(error: string): Promise<void> {
    this.state.status = 'failed'
    this.state.error = error
    this.state.completedAt = Date.now()
    this.state.lastActivity = Date.now()

    await this.syncState()
    await this.pushStream('error', error)

    await this.flushNotifications()
    if (this.config.enableNotifications && this.config.chatId) {
      await this.sendNotificationImmediate(`❌ *Failed*\n${error}`)
    }
  }

  /**
   * Set metadata
   */
  async setMetadata(key: string, value: unknown): Promise<void> {
    if (!this.state.metadata) {
      this.state.metadata = {}
    }
    this.state.metadata[key] = value
    await this.syncState()
  }

  /**
   * Get current state
   */
  getState(): Readonly<ProgressState> {
    return { ...this.state }
  }

  /**
   * Flush pending notifications
   */
  async flushNotifications(): Promise<void> {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
      this.notificationTimer = undefined
    }

    if (this.pendingNotification) {
      await this.sendNotificationImmediate(this.pendingNotification)
      this.pendingNotification = undefined
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.flushNotifications()
  }

  // Private methods

  private findStage(name: string): ProgressStage | undefined {
    return this.state.stages.find(s => s.name === name)
  }

  private updateProgress(): void {
    const total = this.state.stages.length
    if (total === 0) return

    const completed = this.state.stages.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length

    const running = this.state.stages.filter(s => s.status === 'running').length

    this.state.progress = Math.round(((completed + running * 0.5) / total) * 100)
  }

  private async syncState(): Promise<void> {
    const stateKey = REDIS_KEYS.workflowState(this.state.workflowId)

    await this.stateRedis.hset(stateKey, {
      status: this.state.status,
      progress: this.state.progress.toString(),
      currentStage: this.state.currentStage || '',
      startedAt: this.state.startedAt.toString(),
      lastActivity: this.state.lastActivity.toString(),
      completedAt: this.state.completedAt?.toString() || '',
      error: this.state.error || '',
      stages: JSON.stringify(this.state.stages),
      metadata: JSON.stringify(this.state.metadata || {}),
    })
  }

  private async pushStream(type: StreamUpdate['type'], content: string): Promise<void> {
    const streamKey = REDIS_KEYS.workflowOutput(this.state.workflowId)

    await this.streamRedis.xadd(
      streamKey,
      'MAXLEN', '~', this.config.maxStreamEntries.toString(),
      '*',
      'type', type,
      'content', content,
      'timestamp', Date.now().toString()
    )
  }

  private queueNotification(message: string): void {
    if (!this.config.enableNotifications || !this.config.chatId) return

    this.pendingNotification = message

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
    }

    this.notificationTimer = setTimeout(() => {
      if (this.pendingNotification) {
        this.sendNotificationImmediate(this.pendingNotification)
        this.pendingNotification = undefined
      }
    }, this.config.notificationDebounceMs)
  }

  private async sendNotification(message: string): Promise<void> {
    this.queueNotification(message)
  }

  private async sendNotificationImmediate(message: string): Promise<boolean> {
    if (!this.config.notificationChannel || !this.config.chatId) {
      return false
    }

    try {
      return await this.config.notificationChannel.send(this.config.chatId, message, {
        parseMode: 'Markdown',
      })
    } catch (error) {
      console.error('[ProgressReporter] Notification failed:', error)
      return false
    }
  }

  private makeProgressBar(percent: number): string {
    const filled = Math.round(percent / 10)
    const empty = 10 - filled
    return '▓'.repeat(filled) + '░'.repeat(empty)
  }
}

/**
 * Create a progress reporter for a workflow
 */
export function createProgressReporter(
  workflowId: string,
  stages: string[],
  config?: ProgressReporterConfig
): ProgressReporter {
  return new ProgressReporter(workflowId, stages, config)
}
