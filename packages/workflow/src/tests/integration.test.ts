/**
 * Integration Tests for Elio Workflow System
 * Run after any architecture changes to verify system works
 *
 * Usage: pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getQueueConnection,
  getStreamConnection,
  getStateConnection,
  closeAllConnections,
  BullMQWorkflowClient,
  REDIS_KEYS,
} from '../index.js'
import { runHealthChecks, quickHealthCheck } from '../health/index.js'

describe('Redis Connections', () => {
  it('should connect to queue Redis (db 0)', async () => {
    const redis = getQueueConnection()
    const pong = await redis.ping()
    expect(pong).toBe('PONG')
  })

  it('should connect to stream Redis (db 1)', async () => {
    const redis = getStreamConnection()
    const pong = await redis.ping()
    expect(pong).toBe('PONG')
  })

  it('should connect to state Redis (db 2)', async () => {
    const redis = getStateConnection()
    const pong = await redis.ping()
    expect(pong).toBe('PONG')
  })

  it('should use separate databases', async () => {
    const queue = getQueueConnection()
    const stream = getStreamConnection()
    const state = getStateConnection()

    // Set unique keys in each
    const testId = `test-${Date.now()}`
    await queue.set(`queue:${testId}`, 'queue')
    await stream.set(`stream:${testId}`, 'stream')
    await state.set(`state:${testId}`, 'state')

    // Verify isolation - key from one db should not exist in another
    const queueInStream = await stream.get(`queue:${testId}`)
    const streamInState = await state.get(`stream:${testId}`)

    expect(queueInStream).toBeNull()
    expect(streamInState).toBeNull()

    // Cleanup
    await queue.del(`queue:${testId}`)
    await stream.del(`stream:${testId}`)
    await state.del(`state:${testId}`)
  })
})

describe('Health Checks', () => {
  it('should pass quick health check', async () => {
    const healthy = await quickHealthCheck()
    expect(healthy).toBe(true)
  })

  it('should return full health report', async () => {
    const health = await runHealthChecks()

    expect(health.status).toBeDefined()
    expect(health.checks.length).toBeGreaterThan(0)
    expect(health.summary.total).toBeGreaterThan(0)

    // All critical checks should pass
    const criticalChecks = health.checks.filter(c =>
      ['redis-queue', 'redis-stream', 'redis-state'].includes(c.component)
    )

    for (const check of criticalChecks) {
      expect(check.status).toBe('ok')
    }
  })
})

describe('Stream Operations', () => {
  const testStreamKey = `test:stream:${Date.now()}`

  afterAll(async () => {
    const redis = getStreamConnection()
    await redis.del(testStreamKey)
  })

  it('should write to stream', async () => {
    const redis = getStreamConnection()
    const id = await redis.xadd(
      testStreamKey,
      '*',
      'type', 'test',
      'content', 'hello',
      'timestamp', Date.now().toString()
    )
    expect(id).toBeTruthy()
  })

  it('should read from stream', async () => {
    const redis = getStreamConnection()

    // Write first
    await redis.xadd(testStreamKey, '*', 'type', 'read-test', 'value', '123')

    // Read
    const result = await redis.xread('STREAMS', testStreamKey, '0')
    expect(result).toBeTruthy()
    expect(result!.length).toBeGreaterThan(0)
  })

  it('should support MAXLEN trimming', async () => {
    const redis = getStreamConnection()
    const trimKey = `test:trim:${Date.now()}`

    // Add many entries
    for (let i = 0; i < 20; i++) {
      await redis.xadd(trimKey, 'MAXLEN', '~', '10', '*', 'i', i.toString())
    }

    const len = await redis.xlen(trimKey)
    // Should be approximately 10 (~ is approximate)
    expect(len).toBeLessThanOrEqual(15)

    await redis.del(trimKey)
  })
})

describe('State Operations', () => {
  const testStateKey = `test:state:${Date.now()}`

  afterAll(async () => {
    const redis = getStateConnection()
    await redis.del(testStateKey)
  })

  it('should write state hash', async () => {
    const redis = getStateConnection()
    await redis.hset(testStateKey, {
      status: 'running',
      startedAt: Date.now().toString(),
    })

    const status = await redis.hget(testStateKey, 'status')
    expect(status).toBe('running')
  })

  it('should read all state fields', async () => {
    const redis = getStateConnection()
    const state = await redis.hgetall(testStateKey)

    expect(state.status).toBe('running')
    expect(state.startedAt).toBeTruthy()
  })

  it('should support atomic updates', async () => {
    const redis = getStateConnection()

    // Use WATCH/MULTI for atomic update
    await redis.watch(testStateKey)
    const multi = redis.multi()
    multi.hset(testStateKey, 'status', 'completed')
    multi.hset(testStateKey, 'completedAt', Date.now().toString())
    const results = await multi.exec()

    expect(results).toBeTruthy()

    const status = await redis.hget(testStateKey, 'status')
    expect(status).toBe('completed')
  })
})

describe('Workflow Client', () => {
  let client: BullMQWorkflowClient

  beforeAll(() => {
    client = new BullMQWorkflowClient()
  })

  afterAll(async () => {
    await client.close()
  })

  it('should create workflow client', () => {
    expect(client).toBeTruthy()
  })

  it('should query non-existent workflow', async () => {
    const state = await client.query('non-existent-workflow', 'status')
    expect(state).toMatchObject({ status: 'unknown' })
  })
})

describe('REDIS_KEYS', () => {
  it('should generate correct key patterns', () => {
    const workflowId = 'test-123'

    expect(REDIS_KEYS.workflowState(workflowId)).toBe('workflow:test-123:state')
    expect(REDIS_KEYS.workflowOutput(workflowId)).toBe('workflow:test-123:output')
    expect(REDIS_KEYS.workflowSignals(workflowId)).toBe('workflow:test-123:signals')
  })
})

// Cleanup after all tests
afterAll(async () => {
  await closeAllConnections()
})
