/**
 * Stream Cleanup Utilities
 * Handles automatic cleanup of old streams and state
 */

import { getStreamConnection, getStateConnection } from './connection.js'

// Default retention: 24 hours
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000
const CLEANUP_BATCH_SIZE = 100

export interface CleanupStats {
  streamsDeleted: number
  statesDeleted: number
  errorsCount: number
}

/**
 * Cleanup old workflow streams and state
 * @param retentionMs - How long to keep data (default: 24h)
 */
export async function cleanupOldWorkflows(retentionMs = DEFAULT_RETENTION_MS): Promise<CleanupStats> {
  const streamRedis = getStreamConnection()
  const stateRedis = getStateConnection()

  const stats: CleanupStats = {
    streamsDeleted: 0,
    statesDeleted: 0,
    errorsCount: 0,
  }

  const cutoffTime = Date.now() - retentionMs
  console.log(`[Cleanup] Starting cleanup, cutoff: ${new Date(cutoffTime).toISOString()}`)

  try {
    // Find all workflow states
    let cursor = '0'

    do {
      const [nextCursor, keys] = await stateRedis.scan(
        cursor,
        'MATCH', 'workflow:*:state',
        'COUNT', CLEANUP_BATCH_SIZE
      )
      cursor = nextCursor

      for (const stateKey of keys) {
        try {
          const state = await stateRedis.hgetall(stateKey)

          // Check if workflow is old enough to delete
          const completedAt = state.completedAt ? parseInt(state.completedAt, 10) : 0
          const startedAt = state.startedAt ? parseInt(state.startedAt, 10) : 0
          const timestamp = completedAt || startedAt

          // Skip running workflows
          if (state.status === 'running' || state.status === 'awaiting_input') {
            continue
          }

          // Delete if older than retention period
          if (timestamp && timestamp < cutoffTime) {
            const workflowId = stateKey.replace('workflow:', '').replace(':state', '')

            // Delete stream
            const streamKey = `workflow:${workflowId}:output`
            const streamDeleted = await streamRedis.del(streamKey)
            if (streamDeleted) stats.streamsDeleted++

            // Delete state
            const stateDeleted = await stateRedis.del(stateKey)
            if (stateDeleted) stats.statesDeleted++

            // Delete signals channel key (if exists)
            await stateRedis.del(`workflow:${workflowId}:signals`)

            console.log(`[Cleanup] Deleted workflow: ${workflowId}`)
          }
        } catch (err) {
          console.error(`[Cleanup] Error processing ${stateKey}:`, err)
          stats.errorsCount++
        }
      }
    } while (cursor !== '0')

  } catch (err) {
    console.error('[Cleanup] Fatal error:', err)
    stats.errorsCount++
  }

  console.log(`[Cleanup] Complete:`, stats)
  return stats
}

/**
 * Trim all active streams to max length
 * Prevents unbounded growth of stream entries
 */
export async function trimActiveStreams(maxLen = 1000): Promise<number> {
  const streamRedis = getStreamConnection()
  let trimmedCount = 0

  try {
    let cursor = '0'

    do {
      const [nextCursor, keys] = await streamRedis.scan(
        cursor,
        'MATCH', 'workflow:*:output',
        'COUNT', CLEANUP_BATCH_SIZE
      )
      cursor = nextCursor

      for (const streamKey of keys) {
        try {
          // XTRIM with ~ for approximate trimming (faster)
          await streamRedis.xtrim(streamKey, 'MAXLEN', '~', maxLen)
          trimmedCount++
        } catch (err) {
          console.error(`[Cleanup] Error trimming ${streamKey}:`, err)
        }
      }
    } while (cursor !== '0')

  } catch (err) {
    console.error('[Cleanup] Error during trim:', err)
  }

  return trimmedCount
}

/**
 * Get cleanup statistics
 */
export async function getCleanupStats(): Promise<{
  totalStreams: number
  totalStates: number
  oldestWorkflow: string | null
}> {
  const streamRedis = getStreamConnection()
  const stateRedis = getStateConnection()

  let totalStreams = 0
  let totalStates = 0
  let oldestTimestamp = Date.now()
  let oldestWorkflow: string | null = null

  // Count streams
  let cursor = '0'
  do {
    const [nextCursor, keys] = await streamRedis.scan(cursor, 'MATCH', 'workflow:*:output', 'COUNT', 100)
    cursor = nextCursor
    totalStreams += keys.length
  } while (cursor !== '0')

  // Count states and find oldest
  cursor = '0'
  do {
    const [nextCursor, keys] = await stateRedis.scan(cursor, 'MATCH', 'workflow:*:state', 'COUNT', 100)
    cursor = nextCursor
    totalStates += keys.length

    for (const key of keys) {
      const state = await stateRedis.hgetall(key)
      const timestamp = parseInt(state.startedAt || '0', 10)
      if (timestamp && timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp
        oldestWorkflow = key.replace('workflow:', '').replace(':state', '')
      }
    }
  } while (cursor !== '0')

  return {
    totalStreams,
    totalStates,
    oldestWorkflow,
  }
}

/**
 * Start periodic cleanup (for long-running processes)
 */
export function startPeriodicCleanup(intervalMs = 60 * 60 * 1000): () => void {
  console.log(`[Cleanup] Starting periodic cleanup every ${intervalMs / 1000}s`)

  const timer = setInterval(async () => {
    try {
      await cleanupOldWorkflows()
      await trimActiveStreams()
    } catch (err) {
      console.error('[Cleanup] Periodic cleanup error:', err)
    }
  }, intervalMs)

  // Return stop function
  return () => {
    clearInterval(timer)
    console.log('[Cleanup] Periodic cleanup stopped')
  }
}
