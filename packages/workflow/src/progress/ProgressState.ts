/**
 * Progress State Management
 * Handles workflow state and Redis synchronization
 */

import type { Redis } from 'ioredis'
import { REDIS_KEYS, type WorkflowStatus } from '../types.js'

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

export class StateManager {
  private state: ProgressState

  constructor(
    private readonly stateRedis: Redis,
    workflowId: string,
    stages: string[]
  ) {
    this.state = {
      workflowId,
      status: 'pending',
      progress: 0,
      stages: stages.map(name => ({ name, status: 'pending' })),
      startedAt: Date.now(),
      lastActivity: Date.now(),
    }
  }

  getState(): Readonly<ProgressState> {
    return { ...this.state }
  }

  updateStatus(status: WorkflowStatus): void {
    this.state.status = status
    this.state.lastActivity = Date.now()
  }

  updateProgress(progress: number): void {
    this.state.progress = Math.min(100, Math.max(0, progress))
    this.state.lastActivity = Date.now()
  }

  setError(error: string): void {
    this.state.error = error
  }

  setCompleted(): void {
    this.state.completedAt = Date.now()
  }

  setCurrentStage(stageName: string): void {
    this.state.currentStage = stageName
  }

  setMetadata(key: string, value: unknown): void {
    if (!this.state.metadata) {
      this.state.metadata = {}
    }
    this.state.metadata[key] = value
  }

  findStage(name: string): ProgressStage | undefined {
    return this.state.stages.find(s => s.name === name)
  }

  updateStage(name: string, updates: Partial<ProgressStage>): void {
    const stage = this.findStage(name)
    if (stage) {
      Object.assign(stage, updates)
      this.state.lastActivity = Date.now()
    }
  }

  calculateProgress(): void {
    const total = this.state.stages.length
    if (total === 0) return

    const completed = this.state.stages.filter(
      s => s.status === 'completed' || s.status === 'skipped'
    ).length

    const running = this.state.stages.filter(s => s.status === 'running').length

    this.state.progress = Math.round(((completed + running * 0.5) / total) * 100)
  }

  async syncToRedis(): Promise<void> {
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

  markRemainingAsSkipped(): void {
    for (const stage of this.state.stages) {
      if (stage.status === 'pending') {
        stage.status = 'skipped'
      }
    }
  }
}
