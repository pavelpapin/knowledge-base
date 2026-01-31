/**
 * Unified Progress Reporter
 * Orchestrates state management, streaming, and notifications
 */

import type { Redis } from 'ioredis'
import { getStreamConnection, getStateConnection } from '../bullmq/connection.js'
import { REDIS_KEYS, type StreamUpdate } from '../types.js'
import type { NotificationChannel } from '../notifications/types.js'
import { StateManager } from './ProgressState.js'
import { ProgressNotifier } from './ProgressNotifier.js'

export type { ProgressStage, ProgressState } from './ProgressState.js'

export interface ProgressReporterConfig {
  chatId?: number | string
  notificationChannel?: NotificationChannel
  notificationDebounceMs?: number
  enableNotifications?: boolean
  maxStreamEntries?: number
}

const DEFAULT_CONFIG = {
  notificationDebounceMs: 500,
  enableNotifications: true,
  maxStreamEntries: 1000,
}

export class ProgressReporter {
  private readonly streamRedis: Redis
  private readonly stateManager: StateManager
  private readonly notifier: ProgressNotifier
  private readonly maxStreamEntries: number

  constructor(
    workflowId: string,
    stages: string[],
    config?: ProgressReporterConfig
  ) {
    this.streamRedis = getStreamConnection()
    const stateRedis = getStateConnection()

    const finalConfig = { ...DEFAULT_CONFIG, ...config }
    this.maxStreamEntries = finalConfig.maxStreamEntries

    this.stateManager = new StateManager(stateRedis, workflowId, stages)
    this.notifier = new ProgressNotifier({
      chatId: finalConfig.chatId,
      channel: finalConfig.notificationChannel,
      debounceMs: finalConfig.notificationDebounceMs,
      enabled: finalConfig.enableNotifications,
    })
  }

  async start(description?: string): Promise<void> {
    this.stateManager.updateStatus('running')
    await this.stateManager.syncToRedis()
    await this.pushStream('output', `🚀 Started: ${description || 'Workflow'}`)
    await this.notifier.sendImmediate(`🚀 *Started*\n${description || 'Workflow'}`)
  }

  async startStage(stageName: string, details?: string): Promise<void> {
    this.stateManager.updateStage(stageName, { status: 'running', startedAt: Date.now() })
    this.stateManager.setCurrentStage(stageName)
    this.stateManager.calculateProgress()
    await this.stateManager.syncToRedis()
    await this.pushStream('progress', `📋 ${stageName}${details ? `: ${details}` : ''}`)
    this.notifier.queue(`📋 *${stageName}*${details ? `\n${details}` : ''}`)
  }

  async completeStage(stageName: string, result?: string): Promise<void> {
    this.stateManager.updateStage(stageName, { status: 'completed', completedAt: Date.now() })
    this.stateManager.calculateProgress()
    await this.stateManager.syncToRedis()
    await this.pushStream('progress', `✅ ${stageName} completed${result ? `: ${result}` : ''}`)
  }

  async failStage(stageName: string, error: string): Promise<void> {
    this.stateManager.updateStage(stageName, { status: 'failed', completedAt: Date.now(), error })
    await this.stateManager.syncToRedis()
    await this.pushStream('error', `❌ ${stageName} failed: ${error}`)
    await this.notifier.sendImmediate(`❌ *${stageName} failed*\n${error}`)
  }

  async skipStage(stageName: string, reason?: string): Promise<void> {
    this.stateManager.updateStage(stageName, { status: 'skipped' })
    this.stateManager.calculateProgress()
    await this.stateManager.syncToRedis()
    await this.pushStream('output', `⏭️ ${stageName} skipped${reason ? `: ${reason}` : ''}`)
  }

  async log(message: string): Promise<void> {
    await this.pushStream('output', message)
  }

  async thinking(message: string): Promise<void> {
    await this.pushStream('thinking', message)
  }

  async reportProgress(percent: number, status?: string): Promise<void> {
    this.stateManager.updateProgress(percent)
    await this.stateManager.syncToRedis()
    const bar = ProgressNotifier.makeProgressBar(percent)
    await this.pushStream('progress', `${bar} ${percent}%${status ? ` - ${status}` : ''}`)
    this.notifier.queue(`⏳ *Progress: ${percent}%*\n${bar}${status ? `\n${status}` : ''}`)
  }

  async requestInput(prompt: string): Promise<void> {
    this.stateManager.updateStatus('awaiting_input')
    await this.stateManager.syncToRedis()
    await this.pushStream('input_request', prompt)
    await this.notifier.sendImmediate(`🤖 *Input required*\n\n${prompt}\n\n_Reply to continue_`)
  }

  async resumeFromInput(): Promise<void> {
    this.stateManager.updateStatus('running')
    await this.stateManager.syncToRedis()
  }

  async complete(result?: string): Promise<void> {
    this.stateManager.updateStatus('completed')
    this.stateManager.updateProgress(100)
    this.stateManager.setCompleted()
    this.stateManager.markRemainingAsSkipped()
    await this.stateManager.syncToRedis()
    await this.pushStream('completed', result || 'Workflow completed')
    await this.notifier.flush()
    await this.notifier.sendImmediate(`✅ *Completed*\n${result || 'Workflow finished successfully'}`)
  }

  async fail(error: string): Promise<void> {
    this.stateManager.updateStatus('failed')
    this.stateManager.setError(error)
    this.stateManager.setCompleted()
    await this.stateManager.syncToRedis()
    await this.pushStream('error', error)
    await this.notifier.flush()
    await this.notifier.sendImmediate(`❌ *Failed*\n${error}`)
  }

  async setMetadata(key: string, value: unknown): Promise<void> {
    this.stateManager.setMetadata(key, value)
    await this.stateManager.syncToRedis()
  }

  getState() {
    return this.stateManager.getState()
  }

  async flushNotifications(): Promise<void> {
    await this.notifier.flush()
  }

  async cleanup(): Promise<void> {
    await this.notifier.flush()
  }

  private async pushStream(type: StreamUpdate['type'], content: string): Promise<void> {
    const state = this.stateManager.getState()
    const streamKey = REDIS_KEYS.workflowOutput(state.workflowId)

    await this.streamRedis.xadd(
      streamKey,
      'MAXLEN', '~', this.maxStreamEntries.toString(),
      '*',
      'type', type,
      'content', content,
      'timestamp', Date.now().toString()
    )
  }
}

export function createProgressReporter(
  workflowId: string,
  stages: string[],
  config?: ProgressReporterConfig
): ProgressReporter {
  return new ProgressReporter(workflowId, stages, config)
}
