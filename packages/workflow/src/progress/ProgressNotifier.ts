/**
 * Progress Notification System
 * Handles debounced Telegram notifications
 */

import type { NotificationChannel } from '../notifications/types.js'

export interface NotifierConfig {
  chatId?: number | string
  channel?: NotificationChannel
  debounceMs: number
  enabled: boolean
}

export class ProgressNotifier {
  private notificationTimer?: NodeJS.Timeout
  private pendingNotification?: string
  private lastNotificationTime = 0

  constructor(private readonly config: NotifierConfig) {}

  queue(message: string): void {
    if (!this.config.enabled || !this.config.chatId) return

    this.pendingNotification = message

    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
    }

    this.notificationTimer = setTimeout(() => {
      if (this.pendingNotification) {
        void this.sendImmediate(this.pendingNotification)
        this.pendingNotification = undefined
      }
    }, this.config.debounceMs)
  }

  async sendImmediate(message: string): Promise<boolean> {
    if (!this.config.channel || !this.config.chatId) {
      return false
    }

    try {
      this.lastNotificationTime = Date.now()
      return await this.config.channel.send(this.config.chatId, message, {
        parseMode: 'Markdown',
      })
    } catch (error) {
      console.error('[ProgressNotifier] Send failed:', error)
      return false
    }
  }

  async flush(): Promise<void> {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
      this.notificationTimer = undefined
    }

    if (this.pendingNotification) {
      await this.sendImmediate(this.pendingNotification)
      this.pendingNotification = undefined
    }
  }

  static makeProgressBar(percent: number): string {
    const filled = Math.round(percent / 10)
    const empty = 10 - filled
    return '▓'.repeat(filled) + '░'.repeat(empty)
  }
}
