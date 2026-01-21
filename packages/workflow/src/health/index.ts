/**
 * Health Check System
 * Validates all Elio OS components are working
 */

import { getQueueConnection, getStreamConnection, getStateConnection, getBullMQConnection } from '../bullmq/connection.js'

export interface HealthCheckResult {
  component: string
  status: 'ok' | 'error' | 'warn'
  latencyMs?: number
  message?: string
  details?: Record<string, unknown>
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: HealthCheckResult[]
  summary: {
    total: number
    ok: number
    warn: number
    error: number
  }
}

/**
 * Check Redis Queue connection
 */
async function checkRedisQueue(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const redis = getQueueConnection()
    const pong = await redis.ping()
    return {
      component: 'redis-queue',
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      details: { db: 0 },
    }
  } catch (err) {
    return {
      component: 'redis-queue',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Check Redis Stream connection
 */
async function checkRedisStream(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const redis = getStreamConnection()
    const pong = await redis.ping()
    return {
      component: 'redis-stream',
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      details: { db: 1 },
    }
  } catch (err) {
    return {
      component: 'redis-stream',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Check Redis State connection
 */
async function checkRedisState(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const redis = getStateConnection()
    const pong = await redis.ping()
    return {
      component: 'redis-state',
      status: pong === 'PONG' ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      details: { db: 2 },
    }
  } catch (err) {
    return {
      component: 'redis-state',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Check BullMQ queue is accessible
 */
async function checkBullMQQueue(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const { Queue } = await import('bullmq')
    const connection = getBullMQConnection()
    const queue = new Queue('health-check', { connection })

    // Try to get queue info
    const counts = await queue.getJobCounts()
    await queue.close()

    return {
      component: 'bullmq-queue',
      status: 'ok',
      latencyMs: Date.now() - start,
      details: { jobCounts: counts },
    }
  } catch (err) {
    return {
      component: 'bullmq-queue',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Check agent-execution queue specifically
 */
async function checkAgentQueue(): Promise<HealthCheckResult> {
  const start = Date.now()
  try {
    const { Queue } = await import('bullmq')
    const connection = getBullMQConnection()
    const queue = new Queue('agent-execution', { connection })

    const counts = await queue.getJobCounts()
    const workers = await queue.getWorkers()
    await queue.close()

    const hasWorkers = workers.length > 0

    return {
      component: 'agent-queue',
      status: hasWorkers ? 'ok' : 'warn',
      latencyMs: Date.now() - start,
      message: hasWorkers ? undefined : 'No workers connected',
      details: {
        jobCounts: counts,
        workerCount: workers.length,
      },
    }
  } catch (err) {
    return {
      component: 'agent-queue',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Check stream write/read capability
 */
async function checkStreamIO(): Promise<HealthCheckResult> {
  const start = Date.now()
  const testKey = `health:stream:${Date.now()}`

  try {
    const redis = getStreamConnection()

    // Write test entry
    const id = await redis.xadd(testKey, '*', 'test', 'value')

    // Read it back
    const result = await redis.xread('STREAMS', testKey, '0')

    // Cleanup
    await redis.del(testKey)

    const success = result !== null && id !== null

    return {
      component: 'stream-io',
      status: success ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      message: success ? undefined : 'Stream read/write failed',
    }
  } catch (err) {
    return {
      component: 'stream-io',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Check state write/read capability
 */
async function checkStateIO(): Promise<HealthCheckResult> {
  const start = Date.now()
  const testKey = `health:state:${Date.now()}`

  try {
    const redis = getStateConnection()

    // Write test state
    await redis.hset(testKey, 'test', 'value')

    // Read it back
    const value = await redis.hget(testKey, 'test')

    // Cleanup
    await redis.del(testKey)

    const success = value === 'value'

    return {
      component: 'state-io',
      status: success ? 'ok' : 'error',
      latencyMs: Date.now() - start,
      message: success ? undefined : 'State read/write failed',
    }
  } catch (err) {
    return {
      component: 'state-io',
      status: 'error',
      latencyMs: Date.now() - start,
      message: String(err),
    }
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<SystemHealth> {
  const checks = await Promise.all([
    checkRedisQueue(),
    checkRedisStream(),
    checkRedisState(),
    checkBullMQQueue(),
    checkAgentQueue(),
    checkStreamIO(),
    checkStateIO(),
  ])

  const summary = {
    total: checks.length,
    ok: checks.filter(c => c.status === 'ok').length,
    warn: checks.filter(c => c.status === 'warn').length,
    error: checks.filter(c => c.status === 'error').length,
  }

  let status: SystemHealth['status'] = 'healthy'
  if (summary.error > 0) {
    status = 'unhealthy'
  } else if (summary.warn > 0) {
    status = 'degraded'
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
    summary,
  }
}

/**
 * Quick health check (just Redis connectivity)
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    const [queue, stream, state] = await Promise.all([
      checkRedisQueue(),
      checkRedisStream(),
      checkRedisState(),
    ])

    return queue.status === 'ok' &&
           stream.status === 'ok' &&
           state.status === 'ok'
  } catch {
    return false
  }
}

/**
 * Print health check results to console
 */
export function printHealthReport(health: SystemHealth): void {
  console.log('\n=== ELIO HEALTH CHECK ===')
  console.log(`Status: ${health.status.toUpperCase()}`)
  console.log(`Time: ${health.timestamp}`)
  console.log(`Summary: ${health.summary.ok}/${health.summary.total} OK`)

  if (health.summary.warn > 0) {
    console.log(`Warnings: ${health.summary.warn}`)
  }
  if (health.summary.error > 0) {
    console.log(`Errors: ${health.summary.error}`)
  }

  console.log('\nComponents:')
  for (const check of health.checks) {
    const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '⚠' : '✗'
    const latency = check.latencyMs ? ` (${check.latencyMs}ms)` : ''
    const msg = check.message ? ` - ${check.message}` : ''
    console.log(`  ${icon} ${check.component}${latency}${msg}`)
  }
  console.log('')
}
