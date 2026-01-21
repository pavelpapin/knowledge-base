/**
 * Notification Types
 * For agent-to-user communication
 */

export interface NotificationChannel {
  /**
   * Send notification to user
   */
  send(chatId: number | string, message: string, options?: NotificationOptions): Promise<boolean>

  /**
   * Send notification with inline reply keyboard
   */
  sendWithOptions(
    chatId: number | string,
    message: string,
    replyOptions: ReplyOption[]
  ): Promise<boolean>
}

export interface NotificationOptions {
  /** Parse mode: markdown, html */
  parseMode?: 'Markdown' | 'HTML'
  /** Disable link previews */
  disablePreview?: boolean
  /** Silent notification */
  silent?: boolean
}

export interface ReplyOption {
  text: string
  callbackData: string
}

export interface PendingNotification {
  workflowId: string
  chatId: number | string
  message: string
  options?: ReplyOption[]
  createdAt: number
  sentAt?: number
}

export interface NotificationServiceConfig {
  /** Debounce time in ms (default: 500) */
  debounceMs?: number
  /** Max batch size (default: 5) */
  maxBatchSize?: number
  /** Retry attempts (default: 3) */
  retryAttempts?: number
  /** Retry delay in ms (default: 1000) */
  retryDelayMs?: number
}
