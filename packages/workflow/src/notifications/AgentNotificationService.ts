/**
 * Agent Notification Service
 * Handles notifications from agents to users with batching and debouncing
 */

import type {
  NotificationChannel,
  NotificationServiceConfig,
  PendingNotification,
  ReplyOption,
} from './types.js'

const DEFAULT_CONFIG: Required<NotificationServiceConfig> = {
  debounceMs: 500,
  maxBatchSize: 5,
  retryAttempts: 3,
  retryDelayMs: 1000,
}

export class AgentNotificationService {
  private readonly config: Required<NotificationServiceConfig>
  private readonly pending = new Map<string, PendingNotification[]>()
  private readonly timers = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly channel: NotificationChannel,
    config?: NotificationServiceConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Queue notification for delivery (debounced)
   */
  notify(
    workflowId: string,
    chatId: number | string,
    message: string,
    options?: ReplyOption[]
  ): void {
    const key = String(chatId)

    // Get or create pending queue for this chat
    if (!this.pending.has(key)) {
      this.pending.set(key, [])
    }

    const queue = this.pending.get(key)!
    queue.push({
      workflowId,
      chatId,
      message,
      options,
      createdAt: Date.now(),
    })

    // Trim queue if too large
    if (queue.length > this.config.maxBatchSize * 2) {
      queue.splice(0, queue.length - this.config.maxBatchSize)
    }

    // Reset debounce timer
    this.resetTimer(key)
  }

  /**
   * Notify immediately without debouncing
   */
  async notifyImmediate(
    workflowId: string,
    chatId: number | string,
    message: string,
    options?: ReplyOption[]
  ): Promise<boolean> {
    console.log(`[NotificationService] Immediate notification to ${chatId}`)

    try {
      if (options && options.length > 0) {
        return await this.channel.sendWithOptions(chatId, message, options)
      }
      return await this.channel.send(chatId, message)
    } catch (error) {
      console.error('[NotificationService] Send error:', error)
      return false
    }
  }

  /**
   * Notify that agent needs user input
   */
  async notifyInputRequest(
    workflowId: string,
    chatId: number | string,
    prompt: string
  ): Promise<boolean> {
    const message = `🤖 *Agent needs input*\n\n${prompt}\n\n_Reply to this message to continue_`

    return this.notifyImmediate(workflowId, chatId, message, [
      { text: 'Cancel', callbackData: `agent:cancel:${workflowId}` },
    ])
  }

  /**
   * Notify that agent started
   */
  notifyAgentStarted(workflowId: string, chatId: number | string, taskDescription: string): void {
    const message = `🚀 *Agent started*\n\n${taskDescription}`
    this.notify(workflowId, chatId, message)
  }

  /**
   * Notify that agent completed
   */
  notifyAgentCompleted(workflowId: string, chatId: number | string, result: string): void {
    const message = `✅ *Agent completed*\n\n${result}`
    this.notify(workflowId, chatId, message)
  }

  /**
   * Notify that agent failed
   */
  notifyAgentFailed(workflowId: string, chatId: number | string, error: string): void {
    const message = `❌ *Agent failed*\n\n${error}`
    this.notify(workflowId, chatId, message)
  }

  /**
   * Notify progress update
   */
  notifyProgress(workflowId: string, chatId: number | string, progress: number, status: string): void {
    const progressBar = this.makeProgressBar(progress)
    const message = `⏳ *Progress*: ${progress}%\n${progressBar}\n\n${status}`
    this.notify(workflowId, chatId, message)
  }

  /**
   * Flush all pending notifications immediately
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = []

    for (const [key] of this.pending) {
      this.clearTimer(key)
      promises.push(this.deliverBatch(key))
    }

    await Promise.all(promises)
  }

  /**
   * Stop the service
   */
  stop(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.pending.clear()
  }

  private resetTimer(key: string): void {
    this.clearTimer(key)

    const timer = setTimeout(() => {
      this.deliverBatch(key)
    }, this.config.debounceMs)

    this.timers.set(key, timer)
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  private async deliverBatch(key: string): Promise<void> {
    const queue = this.pending.get(key)
    if (!queue || queue.length === 0) {
      return
    }

    // Take batch
    const batch = queue.splice(0, this.config.maxBatchSize)
    if (queue.length === 0) {
      this.pending.delete(key)
    }

    // Combine messages if multiple
    if (batch.length === 1) {
      const notification = batch[0]
      await this.sendWithRetry(notification)
    } else {
      // Combine into single message
      const combined = batch.map(n => n.message).join('\n\n---\n\n')
      const first = batch[0]
      await this.sendWithRetry({
        ...first,
        message: combined,
        options: undefined, // Don't include options in combined message
      })
    }
  }

  private async sendWithRetry(notification: PendingNotification): Promise<boolean> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        if (notification.options && notification.options.length > 0) {
          return await this.channel.sendWithOptions(
            notification.chatId,
            notification.message,
            notification.options
          )
        }
        return await this.channel.send(notification.chatId, notification.message, {
          parseMode: 'Markdown',
        })
      } catch (error) {
        console.error(
          `[NotificationService] Attempt ${attempt}/${this.config.retryAttempts} failed:`,
          error
        )

        if (attempt < this.config.retryAttempts) {
          await this.sleep(this.config.retryDelayMs * attempt)
        }
      }
    }

    console.error('[NotificationService] All retry attempts failed')
    return false
  }

  private makeProgressBar(percent: number): string {
    const filled = Math.round(percent / 10)
    const empty = 10 - filled
    return '▓'.repeat(filled) + '░'.repeat(empty)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
