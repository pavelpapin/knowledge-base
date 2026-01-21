/**
 * Batched Stream Writer
 * Reduces Redis round-trips by batching stream writes
 */

import { Redis } from 'ioredis'
import { getStreamConnection, getStateConnection } from './connection.js'
import type { StreamUpdate } from '../types.js'
import { REDIS_KEYS } from '../types.js'

export interface StreamWriterOptions {
  /** Max number of updates to batch before flushing */
  batchSize?: number
  /** Max time to wait before flushing (ms) */
  flushIntervalMs?: number
  /** Max stream length (for XTRIM) */
  maxStreamLen?: number
}

const DEFAULT_OPTIONS: Required<StreamWriterOptions> = {
  batchSize: 10,
  flushIntervalMs: 100,
  maxStreamLen: 1000,
}

interface PendingWrite {
  streamKey: string
  update: StreamUpdate
  stateKey?: string
}

/**
 * Batched stream writer for efficient Redis operations
 */
export class BatchedStreamWriter {
  private readonly streamRedis: Redis
  private readonly stateRedis: Redis
  private readonly options: Required<StreamWriterOptions>

  private pendingWrites: PendingWrite[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private closed = false

  constructor(options: StreamWriterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.streamRedis = getStreamConnection()
    this.stateRedis = getStateConnection()
  }

  /**
   * Queue a stream update for batched writing
   */
  async write(workflowId: string, update: StreamUpdate): Promise<void> {
    if (this.closed) {
      throw new Error('StreamWriter is closed')
    }

    const streamKey = REDIS_KEYS.workflowOutput(workflowId)
    const stateKey = REDIS_KEYS.workflowState(workflowId)

    this.pendingWrites.push({
      streamKey,
      update,
      stateKey,
    })

    // Flush if batch is full
    if (this.pendingWrites.length >= this.options.batchSize) {
      await this.flush()
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush()
    }
  }

  /**
   * Flush all pending writes using pipeline
   */
  async flush(): Promise<void> {
    if (this.pendingWrites.length === 0) {
      return
    }

    // Clear timer if scheduled
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    // Take all pending writes
    const writes = this.pendingWrites
    this.pendingWrites = []

    // Use pipeline for batched writes
    const streamPipeline = this.streamRedis.pipeline()
    const statePipeline = this.stateRedis.pipeline()

    const now = Date.now()
    const stateKeys = new Set<string>()

    for (const { streamKey, update, stateKey } of writes) {
      // Add to stream
      streamPipeline.xadd(
        streamKey,
        'MAXLEN', '~', String(this.options.maxStreamLen),
        '*',
        'type', update.type,
        'content', update.content,
        'timestamp', update.timestamp.toString()
      )

      // Track unique state keys for lastActivity update
      if (stateKey) {
        stateKeys.add(stateKey)
      }
    }

    // Update lastActivity for all affected workflows
    for (const stateKey of stateKeys) {
      statePipeline.hset(stateKey, 'lastActivity', now.toString())
    }

    // Execute both pipelines in parallel
    try {
      await Promise.all([
        streamPipeline.exec(),
        statePipeline.exec(),
      ])
    } catch (err) {
      console.error('[StreamWriter] Pipeline error:', err)
      throw err
    }
  }

  /**
   * Schedule a flush if not already scheduled
   */
  private scheduleFlush(): void {
    if (this.flushTimer === null) {
      this.flushTimer = setTimeout(async () => {
        this.flushTimer = null
        await this.flush().catch(err => {
          console.error('[StreamWriter] Scheduled flush error:', err)
        })
      }, this.options.flushIntervalMs)
    }
  }

  /**
   * Close the writer, flushing any pending writes
   */
  async close(): Promise<void> {
    this.closed = true

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    await this.flush()
  }

  /**
   * Get pending write count
   */
  get pendingCount(): number {
    return this.pendingWrites.length
  }
}

// Global shared writer instance
let sharedWriter: BatchedStreamWriter | null = null

/**
 * Get shared batched stream writer
 */
export function getStreamWriter(options?: StreamWriterOptions): BatchedStreamWriter {
  if (!sharedWriter) {
    sharedWriter = new BatchedStreamWriter(options)
  }
  return sharedWriter
}

/**
 * Close shared writer
 */
export async function closeStreamWriter(): Promise<void> {
  if (sharedWriter) {
    await sharedWriter.close()
    sharedWriter = null
  }
}
