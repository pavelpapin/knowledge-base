/**
 * State Manager with Transaction Support
 * Ensures consistency for workflow state updates
 */

import { Redis, ChainableCommander } from 'ioredis'
import { getStateConnection } from './connection.js'
import type { WorkflowState, WorkflowStatus } from '../types.js'
import { REDIS_KEYS } from '../types.js'

export interface StateUpdate {
  status?: WorkflowStatus
  lastActivity?: number
  completedAt?: number
  startedAt?: number
  error?: string
  progress?: number
  sessionId?: string
  metadata?: Record<string, string>
}

export interface TransitionRule {
  from: WorkflowStatus[]
  to: WorkflowStatus
}

// Valid state transitions
const VALID_TRANSITIONS: TransitionRule[] = [
  { from: ['pending'], to: 'running' },
  { from: ['running'], to: 'awaiting_input' },
  { from: ['awaiting_input'], to: 'running' },
  { from: ['running', 'awaiting_input'], to: 'completed' },
  { from: ['running', 'awaiting_input'], to: 'failed' },
  { from: ['running', 'awaiting_input', 'pending'], to: 'cancelled' },
  { from: ['running'], to: 'stalled' },
  { from: ['stalled'], to: 'running' }, // Recovery
  { from: ['stalled'], to: 'failed' },
]

/**
 * Check if state transition is valid
 */
export function isValidTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  // Same state is always valid
  if (from === to) return true

  return VALID_TRANSITIONS.some(
    rule => rule.from.includes(from) && rule.to === to
  )
}

/**
 * State manager with transaction support
 */
export class WorkflowStateManager {
  private readonly redis: Redis

  constructor(redis?: Redis) {
    this.redis = redis || getStateConnection()
  }

  /**
   * Get current workflow state
   */
  async getState(workflowId: string): Promise<WorkflowState | null> {
    const stateKey = REDIS_KEYS.workflowState(workflowId)
    const data = await this.redis.hgetall(stateKey)

    if (!data.status) {
      return null
    }

    return {
      status: data.status as WorkflowStatus,
      startedAt: data.startedAt ? parseInt(data.startedAt, 10) : undefined,
      completedAt: data.completedAt ? parseInt(data.completedAt, 10) : undefined,
      lastActivity: data.lastActivity ? parseInt(data.lastActivity, 10) : undefined,
      error: data.error,
      progress: data.progress ? parseInt(data.progress, 10) : undefined,
    }
  }

  /**
   * Update state with optimistic locking
   * Uses WATCH/MULTI/EXEC for consistency
   */
  async updateStateAtomic(
    workflowId: string,
    update: StateUpdate,
    validateTransition = true
  ): Promise<boolean> {
    const stateKey = REDIS_KEYS.workflowState(workflowId)
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Watch the key for changes
        await this.redis.watch(stateKey)

        // Get current state
        const current = await this.redis.hgetall(stateKey)
        const currentStatus = (current.status || 'pending') as WorkflowStatus

        // Validate transition if status is being updated
        if (validateTransition && update.status && update.status !== currentStatus) {
          if (!isValidTransition(currentStatus, update.status)) {
            await this.redis.unwatch()
            throw new Error(
              `Invalid state transition: ${currentStatus} -> ${update.status}`
            )
          }
        }

        // Build update fields
        const fields: Record<string, string> = {}
        if (update.status) fields.status = update.status
        if (update.lastActivity) fields.lastActivity = update.lastActivity.toString()
        if (update.completedAt) fields.completedAt = update.completedAt.toString()
        if (update.startedAt) fields.startedAt = update.startedAt.toString()
        if (update.error !== undefined) fields.error = update.error
        if (update.progress !== undefined) fields.progress = update.progress.toString()
        if (update.sessionId) fields.sessionId = update.sessionId
        if (update.metadata) {
          for (const [key, value] of Object.entries(update.metadata)) {
            fields[`meta:${key}`] = value
          }
        }

        // Execute transaction
        const multi = this.redis.multi()
        multi.hset(stateKey, fields)

        const results = await multi.exec()

        // Check if transaction succeeded
        if (results === null) {
          // Key was modified by another client, retry
          console.log(`[StateManager] Retry ${attempt + 1} for ${workflowId}`)
          continue
        }

        return true
      } catch (err) {
        await this.redis.unwatch()
        throw err
      }
    }

    throw new Error(`Failed to update state after ${maxRetries} retries`)
  }

  /**
   * Transition to a new state with validation
   */
  async transitionTo(
    workflowId: string,
    newStatus: WorkflowStatus,
    additionalFields?: Partial<StateUpdate>
  ): Promise<boolean> {
    return this.updateStateAtomic(workflowId, {
      status: newStatus,
      lastActivity: Date.now(),
      ...additionalFields,
    })
  }

  /**
   * Complete a workflow (success)
   */
  async complete(workflowId: string, sessionId?: string): Promise<boolean> {
    return this.transitionTo(workflowId, 'completed', {
      completedAt: Date.now(),
      sessionId,
    })
  }

  /**
   * Fail a workflow
   */
  async fail(workflowId: string, error: string): Promise<boolean> {
    return this.transitionTo(workflowId, 'failed', {
      completedAt: Date.now(),
      error,
    })
  }

  /**
   * Cancel a workflow
   */
  async cancel(workflowId: string): Promise<boolean> {
    return this.transitionTo(workflowId, 'cancelled', {
      completedAt: Date.now(),
    })
  }

  /**
   * Mark workflow as stalled
   */
  async markStalled(workflowId: string): Promise<boolean> {
    return this.transitionTo(workflowId, 'stalled', {
      metadata: { stalledAt: Date.now().toString() },
    })
  }

  /**
   * Recover stalled workflow
   */
  async recoverStalled(workflowId: string): Promise<boolean> {
    return this.transitionTo(workflowId, 'running', {
      metadata: { recoveredAt: Date.now().toString() },
    })
  }

  /**
   * Update heartbeat (lastActivity)
   */
  async heartbeat(workflowId: string): Promise<void> {
    const stateKey = REDIS_KEYS.workflowState(workflowId)
    await this.redis.hset(stateKey, 'lastActivity', Date.now().toString())
  }

  /**
   * Batch update multiple workflows
   */
  async batchUpdate(
    updates: Array<{ workflowId: string; update: StateUpdate }>
  ): Promise<void> {
    const pipeline = this.redis.pipeline()

    for (const { workflowId, update } of updates) {
      const stateKey = REDIS_KEYS.workflowState(workflowId)
      const fields: Record<string, string> = {}

      if (update.status) fields.status = update.status
      if (update.lastActivity) fields.lastActivity = update.lastActivity.toString()
      if (update.completedAt) fields.completedAt = update.completedAt.toString()
      if (update.error) fields.error = update.error

      pipeline.hset(stateKey, fields)
    }

    await pipeline.exec()
  }
}

// Shared instance
let sharedManager: WorkflowStateManager | null = null

/**
 * Get shared state manager
 */
export function getStateManager(): WorkflowStateManager {
  if (!sharedManager) {
    sharedManager = new WorkflowStateManager()
  }
  return sharedManager
}
