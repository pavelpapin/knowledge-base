/**
 * BullMQ Workflow Client
 * Implements WorkflowClient interface using BullMQ for job queues
 * and Redis Streams for real-time output
 */

import { Queue, QueueEvents } from 'bullmq'
import { Redis } from 'ioredis'
import { nanoid } from 'nanoid'
import type {
  WorkflowClient,
  WorkflowHandle,
  WorkflowState,
  WorkflowResult,
  StartOptions,
  StreamUpdate,
  OutputCallback,
  Signal,
} from '../types.js'
import { REDIS_KEYS } from '../types.js'
import {
  getBullMQConnection,
  createRedisConnection,
  getStateConnection,
  getStreamConnection,
} from './connection.js'

export class BullMQWorkflowClient implements WorkflowClient {
  private queues = new Map<string, Queue>()
  private queueEvents = new Map<string, QueueEvents>()
  private stateRedis: Redis    // For workflow state (db 2)
  private streamRedis: Redis   // For output streams (db 1)
  private readonly connection: ReturnType<typeof getBullMQConnection>

  constructor(config?: { host?: string; port?: number }) {
    this.connection = getBullMQConnection(config)
    // Use typed connections for separation
    this.stateRedis = getStateConnection(config)
    this.streamRedis = getStreamConnection(config)
  }

  /**
   * Start a new workflow execution
   */
  async start<T>(
    workflowName: string,
    params: T,
    options: StartOptions = {}
  ): Promise<WorkflowHandle> {
    const workflowId = options.workflowId ?? `${workflowName}-${nanoid()}`
    const queue = this.getOrCreateQueue(workflowName)

    // Initialize state (using state connection - db 2)
    await this.stateRedis.hset(REDIS_KEYS.workflowState(workflowId), {
      status: 'pending',
      startedAt: Date.now().toString(),
    })

    // Build job options
    const jobOptions: Record<string, unknown> = {
      jobId: workflowId,
    }

    if (options.delay) {
      jobOptions.delay = options.delay
    }

    if (options.repeat) {
      jobOptions.repeat = {
        pattern: options.repeat.pattern,
        limit: options.repeat.limit,
      }
    }

    // Add job to queue
    await queue.add(
      workflowName,
      { workflowId, params },
      jobOptions
    )

    console.log(`[Workflow] Started ${workflowName} with ID: ${workflowId}`)

    return {
      workflowId,
      result: () => this.waitForResult(workflowId),
    }
  }

  /**
   * Send a signal to a running workflow
   */
  async signal(workflowId: string, signalName: string, data?: unknown): Promise<void> {
    const signal: Signal = {
      signal: signalName,
      data,
      timestamp: Date.now(),
    }

    // Signals go via state connection for pub/sub
    await this.stateRedis.publish(
      REDIS_KEYS.workflowSignals(workflowId),
      JSON.stringify(signal)
    )

    console.log(`[Workflow] Signal ${signalName} sent to ${workflowId}`)
  }

  /**
   * Query workflow state
   */
  async query<T>(workflowId: string, queryName: string): Promise<T> {
    if (queryName === 'status' || queryName === 'state') {
      // State queries use state connection (db 2)
      const state = await this.stateRedis.hgetall(REDIS_KEYS.workflowState(workflowId))
      return {
        status: state.status || 'unknown',
        startedAt: state.startedAt ? parseInt(state.startedAt, 10) : undefined,
        completedAt: state.completedAt ? parseInt(state.completedAt, 10) : undefined,
        lastActivity: state.lastActivity ? parseInt(state.lastActivity, 10) : undefined,
        error: state.error,
        progress: state.progress ? parseInt(state.progress, 10) : undefined,
      } as T
    }

    throw new Error(`Unknown query: ${queryName}`)
  }

  /**
   * Cancel a running workflow
   */
  async cancel(workflowId: string): Promise<void> {
    await this.signal(workflowId, 'cancel')
    await this.stateRedis.hset(REDIS_KEYS.workflowState(workflowId), 'status', 'cancelled')
  }

  /**
   * Get handle for existing workflow
   */
  getHandle(workflowId: string): WorkflowHandle {
    return {
      workflowId,
      result: () => this.waitForResult(workflowId),
    }
  }

  /**
   * Subscribe to workflow output stream
   * Returns unsubscribe function
   */
  async subscribeToOutput(workflowId: string, callback: OutputCallback): Promise<() => void> {
    // Create new stream connection for subscriber (db 1)
    const subscriber = createRedisConnection('stream')
    const streamKey = REDIS_KEYS.workflowOutput(workflowId)
    let lastId = '0'
    let running = true

    const readLoop = async () => {
      while (running) {
        try {
          const results = await subscriber.xread(
            'BLOCK', 2000,
            'STREAMS', streamKey, lastId
          )

          if (!results) continue

          for (const [, messages] of results) {
            for (const [id, fields] of messages as [string, string[]][]) {
              lastId = id

              // Parse fields array to object
              const update: StreamUpdate = {
                type: fields[1] as StreamUpdate['type'],
                content: fields[3] || '',
                timestamp: parseInt(fields[5] || Date.now().toString(), 10),
              }

              await callback(update)

              // Stop on completion
              if (update.type === 'completed') {
                running = false
                break
              }
            }
          }
        } catch (err) {
          if (running) {
            console.error('[Workflow] Stream read error:', err)
            await new Promise(r => setTimeout(r, 1000))
          }
        }
      }
    }

    // Start reading in background
    readLoop().catch(console.error)

    // Return unsubscribe function
    return () => {
      running = false
      subscriber.disconnect()
    }
  }

  /**
   * Update workflow state
   */
  async updateState(workflowId: string, state: Partial<WorkflowState>): Promise<void> {
    const updates: Record<string, string> = {}

    if (state.status) updates.status = state.status
    if (state.lastActivity) updates.lastActivity = state.lastActivity.toString()
    if (state.completedAt) updates.completedAt = state.completedAt.toString()
    if (state.error) updates.error = state.error
    if (state.progress !== undefined) updates.progress = state.progress.toString()

    // State updates go to state connection (db 2)
    await this.stateRedis.hset(REDIS_KEYS.workflowState(workflowId), updates)
  }

  /**
   * Push update to workflow output stream
   */
  async pushOutput(workflowId: string, update: StreamUpdate): Promise<void> {
    // Stream writes go to stream connection (db 1)
    await this.streamRedis.xadd(
      REDIS_KEYS.workflowOutput(workflowId),
      'MAXLEN', '~', '1000', // Auto-cleanup old entries
      '*',
      'type', update.type,
      'content', update.content,
      'timestamp', update.timestamp.toString()
    )

    // Update last activity on state connection (db 2)
    await this.stateRedis.hset(
      REDIS_KEYS.workflowState(workflowId),
      'lastActivity', Date.now().toString()
    )
  }

  /**
   * Wait for workflow completion
   */
  private async waitForResult(workflowId: string): Promise<WorkflowResult> {
    const maxWait = 10 * 60 * 1000 // 10 minutes
    const start = Date.now()

    while (Date.now() - start < maxWait) {
      const state = await this.query<WorkflowState>(workflowId, 'status')

      if (['completed', 'failed', 'cancelled'].includes(state.status)) {
        return {
          status: state.status,
          error: state.error,
        }
      }

      await new Promise(r => setTimeout(r, 1000))
    }

    return {
      status: 'failed',
      error: 'Timeout waiting for workflow completion',
    }
  }

  /**
   * Get or create queue for workflow type
   */
  private getOrCreateQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, { connection: this.connection })
      this.queues.set(name, queue)

      // Create queue events for monitoring
      const events = new QueueEvents(name, { connection: this.connection })
      this.queueEvents.set(name, events)
    }
    return this.queues.get(name)!
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close()
    }
    for (const events of this.queueEvents.values()) {
      await events.close()
    }
    // Note: shared connections are not closed here,
    // use closeAllConnections() for full cleanup
  }
}
