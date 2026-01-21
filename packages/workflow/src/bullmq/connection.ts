/**
 * Redis Connection Factory
 * Provides connection config for BullMQ and raw Redis operations
 *
 * Architecture:
 * - REDIS_QUEUE: BullMQ jobs (default: db 0)
 * - REDIS_STREAM: Output streams (default: db 1)
 * - REDIS_STATE: Workflow state (default: db 2)
 *
 * For single Redis instance, all use db 0.
 * For production, use separate instances via env vars.
 */

import { Redis, RedisOptions } from 'ioredis'

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
  maxRetriesPerRequest?: number | null
  retryStrategy?: (times: number) => number | null
  enableReadyCheck?: boolean
  lazyConnect?: boolean
}

// Connection types for different workloads
export type ConnectionType = 'queue' | 'stream' | 'state' | 'default'

// Environment-based configuration
const ENV_CONFIG: Record<ConnectionType, RedisConfig> = {
  queue: {
    host: process.env.REDIS_QUEUE_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_QUEUE_PORT || process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_QUEUE_PASSWORD || process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_QUEUE_DB || '0', 10),
  },
  stream: {
    host: process.env.REDIS_STREAM_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_STREAM_PORT || process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_STREAM_PASSWORD || process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_STREAM_DB || '1', 10),
  },
  state: {
    host: process.env.REDIS_STATE_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_STATE_PORT || process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_STATE_PASSWORD || process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_STATE_DB || '2', 10),
  },
  default: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
}

// Shared connections pool
const connections: Map<string, Redis> = new Map()

// Reconnection strategy with exponential backoff
function createRetryStrategy(maxRetries = 10): (times: number) => number | null {
  return (times: number): number | null => {
    if (times > maxRetries) {
      console.error(`[Redis] Max retries (${maxRetries}) exceeded, giving up`)
      return null // Stop retrying
    }
    // Exponential backoff: 1s, 2s, 4s, 8s... max 30s
    const delay = Math.min(1000 * Math.pow(2, times - 1), 30000)
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times}/${maxRetries})`)
    return delay
  }
}

/**
 * Get connection key for caching
 */
function getConnectionKey(type: ConnectionType, config?: Partial<RedisConfig>): string {
  const cfg = { ...ENV_CONFIG[type], ...config }
  return `${cfg.host}:${cfg.port}:${cfg.db}`
}

/**
 * Create Redis connection with reconnection logic
 */
function createConnection(type: ConnectionType, config?: Partial<RedisConfig>): Redis {
  const finalConfig: RedisOptions = {
    ...ENV_CONFIG[type],
    ...config,
    maxRetriesPerRequest: null, // Required for BullMQ
    retryStrategy: createRetryStrategy(),
    enableReadyCheck: true,
    lazyConnect: false,
  }

  const redis = new Redis(finalConfig)
  const connId = `${type}:${finalConfig.host}:${finalConfig.port}:${finalConfig.db}`

  redis.on('error', (err) => {
    console.error(`[Redis:${type}] Connection error:`, err.message)
  })

  redis.on('connect', () => {
    console.log(`[Redis:${type}] Connected to ${finalConfig.host}:${finalConfig.port} db=${finalConfig.db}`)
  })

  redis.on('ready', () => {
    console.log(`[Redis:${type}] Ready`)
  })

  redis.on('close', () => {
    console.log(`[Redis:${type}] Connection closed`)
  })

  redis.on('reconnecting', (delay: number) => {
    console.log(`[Redis:${type}] Reconnecting in ${delay}ms...`)
  })

  return redis
}

/**
 * Get shared Redis connection by type (singleton per type)
 */
export function getRedisConnection(
  type: ConnectionType = 'default',
  config?: Partial<RedisConfig>
): Redis {
  const key = getConnectionKey(type, config)

  if (!connections.has(key)) {
    connections.set(key, createConnection(type, config))
  }

  return connections.get(key)!
}

/**
 * Get connection config for BullMQ (queue type)
 */
export function getBullMQConnection(config?: Partial<RedisConfig>): RedisConfig {
  return {
    ...ENV_CONFIG.queue,
    ...config,
    maxRetriesPerRequest: null,
  }
}

/**
 * Create a new Redis connection (for subscribers, pub/sub, etc.)
 * Always creates a new connection, not shared
 */
export function createRedisConnection(
  type: ConnectionType = 'default',
  config?: Partial<RedisConfig>
): Redis {
  return createConnection(type, config)
}

/**
 * Get connection for specific purpose
 */
export function getQueueConnection(config?: Partial<RedisConfig>): Redis {
  return getRedisConnection('queue', config)
}

export function getStreamConnection(config?: Partial<RedisConfig>): Redis {
  return getRedisConnection('stream', config)
}

export function getStateConnection(config?: Partial<RedisConfig>): Redis {
  return getRedisConnection('state', config)
}

/**
 * Close all shared connections
 */
export async function closeAllConnections(): Promise<void> {
  const closePromises: Promise<string>[] = []

  for (const [key, redis] of connections) {
    closePromises.push(
      redis.quit().then(() => {
        console.log(`[Redis] Closed connection: ${key}`)
        return key
      })
    )
  }

  await Promise.all(closePromises)
  connections.clear()
}

/**
 * Close shared connection (backwards compatibility)
 */
export async function closeRedisConnection(): Promise<void> {
  await closeAllConnections()
}

/**
 * Health check for specific connection type
 */
export async function checkRedisHealth(
  type: ConnectionType = 'default',
  redis?: Redis
): Promise<boolean> {
  const conn = redis || getRedisConnection(type)
  try {
    const pong = await conn.ping()
    return pong === 'PONG'
  } catch (err) {
    console.error(`[Redis:${type}] Health check failed:`, err)
    return false
  }
}

/**
 * Check health of all connection types
 */
export async function checkAllRedisHealth(): Promise<Record<ConnectionType, boolean>> {
  const results: Record<ConnectionType, boolean> = {
    queue: false,
    stream: false,
    state: false,
    default: false,
  }

  for (const type of Object.keys(results) as ConnectionType[]) {
    results[type] = await checkRedisHealth(type)
  }

  return results
}

/**
 * Get connection stats
 */
export function getConnectionStats(): { type: string; status: string }[] {
  const stats: { type: string; status: string }[] = []

  for (const [key, redis] of connections) {
    stats.push({
      type: key,
      status: redis.status,
    })
  }

  return stats
}
