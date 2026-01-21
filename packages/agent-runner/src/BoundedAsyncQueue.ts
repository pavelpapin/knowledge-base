/**
 * Bounded Async Queue
 * Prevents memory overflow during agent execution
 * Based on MyAgent's implementation
 */

export interface QueueOptions {
  maxSize: number
  name?: string
  onOverflow?: 'drop' | 'block' | 'error'
}

export class BoundedAsyncQueue<T> {
  private queue: T[] = []
  private waiters: Array<{
    resolve: (value: T | null) => void
    reject: (error: Error) => void
  }> = []
  private closed = false
  private readonly maxSize: number
  private readonly name: string
  private readonly onOverflow: 'drop' | 'block' | 'error'

  constructor(options: QueueOptions) {
    this.maxSize = options.maxSize
    this.name = options.name || 'queue'
    this.onOverflow = options.onOverflow || 'drop'
  }

  /**
   * Push item to queue
   */
  push(item: T): boolean {
    if (this.closed) {
      console.warn(`[${this.name}] Attempted push to closed queue`)
      return false
    }

    // If someone is waiting, deliver directly
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter.resolve(item)
      return true
    }

    // Check overflow
    if (this.queue.length >= this.maxSize) {
      switch (this.onOverflow) {
        case 'drop':
          // Drop oldest item
          this.queue.shift()
          console.warn(`[${this.name}] Queue overflow, dropped oldest item`)
          break
        case 'error':
          throw new Error(`[${this.name}] Queue overflow (max: ${this.maxSize})`)
        case 'block':
          // In block mode, we should wait but that requires async
          // For simplicity, drop oldest
          this.queue.shift()
          break
      }
    }

    this.queue.push(item)
    return true
  }

  /**
   * Pop item from queue (async, waits if empty)
   */
  async pop(signal?: AbortSignal): Promise<T | null> {
    if (signal?.aborted) {
      return null
    }

    // If items available, return immediately
    const item = this.queue.shift()
    if (item !== undefined) {
      return item
    }

    // If closed and empty, return null
    if (this.closed) {
      return null
    }

    // Wait for item
    return new Promise<T | null>((resolve, reject) => {
      const cleanup = () => {
        const idx = this.waiters.findIndex(w => w.resolve === resolve)
        if (idx !== -1) {
          this.waiters.splice(idx, 1)
        }
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          cleanup()
          resolve(null)
        }, { once: true })
      }

      this.waiters.push({ resolve, reject })
    })
  }

  /**
   * Async iterator for consuming queue
   */
  async *iterate(signal?: AbortSignal): AsyncGenerator<T> {
    while (!this.closed || this.queue.length > 0) {
      if (signal?.aborted) {
        break
      }

      const item = await this.pop(signal)
      if (item === null) {
        break
      }

      yield item
    }
  }

  /**
   * Close the queue
   */
  close(): void {
    this.closed = true

    // Resolve all waiters with null
    for (const waiter of this.waiters) {
      waiter.resolve(null)
    }
    this.waiters = []
  }

  /**
   * Check if queue is closed
   */
  isClosed(): boolean {
    return this.closed
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.queue = []
  }
}
