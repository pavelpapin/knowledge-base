/**
 * Agent Execution Worker
 * Handles CLI agent process execution via BullMQ
 */

import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import {
  getBullMQConnection,
  createRedisConnection,
  getStateConnection,
  getStreamConnection,
  REDIS_KEYS,
  type StreamUpdate,
} from '@elio/workflow'
import { createClaudeRunner, type AgentRunner } from '@elio/agent-runner'

export interface AgentExecutionParams {
  workflowId: string
  params: {
    prompt: string
    cwd?: string
    chatId?: string | number
    sessionId?: string
  }
}

export interface AgentExecutionResult {
  exitCode: number
  status: 'completed' | 'failed' | 'cancelled'
  sessionId?: string
}

/**
 * Create agent execution worker
 */
// Worker configuration
const DEFAULT_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '4', 10)
const MIN_CONCURRENCY = 1
const MAX_CONCURRENCY = parseInt(process.env.WORKER_MAX_CONCURRENCY || '8', 10)
const STALE_JOB_CHECK_INTERVAL = 60000 // 1 minute
const STALE_JOB_THRESHOLD = 300000 // 5 minutes without activity
const CONCURRENCY_ADJUST_INTERVAL = 30000 // 30 seconds
const CPU_THRESHOLD_HIGH = 80 // Reduce concurrency when CPU > 80%
const CPU_THRESHOLD_LOW = 40 // Increase concurrency when CPU < 40%
const MEMORY_THRESHOLD = 85 // Reduce concurrency when memory > 85%

export interface WorkerWithConcurrency extends Worker {
  adjustConcurrency: (delta: number) => void
  getConcurrency: () => number
}

export function createAgentExecutionWorker(config?: { host?: string; port?: number }): WorkerWithConcurrency {
  const connection = getBullMQConnection(config)
  const runner = createClaudeRunner()

  let currentConcurrency = DEFAULT_CONCURRENCY

  const worker = new Worker<AgentExecutionParams, AgentExecutionResult>(
    'agent-execution',
    async (job) => processAgentJob(job, runner, config),
    {
      connection,
      concurrency: currentConcurrency,
      // Retry configuration for reliability
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          // Exponential backoff: 5s, 10s, 20s
          return Math.min(5000 * Math.pow(2, attemptsMade - 1), 60000)
        },
      },
    }
  ) as WorkerWithConcurrency

  // Add concurrency adjustment methods
  worker.adjustConcurrency = (delta: number) => {
    const newConcurrency = Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, currentConcurrency + delta))
    if (newConcurrency !== currentConcurrency) {
      currentConcurrency = newConcurrency
      // BullMQ Worker doesn't support runtime concurrency change directly,
      // but we track it for metrics and future restarts
      console.log(`[Worker] Concurrency adjusted to ${currentConcurrency}`)
    }
  }

  worker.getConcurrency = () => currentConcurrency

  // Set up stale job detection
  setupStaleJobDetector(config)

  // Set up dynamic concurrency adjustment
  setupDynamicConcurrency(worker)

  return worker
}

/**
 * Monitor system resources and adjust concurrency dynamically
 */
function setupDynamicConcurrency(worker: WorkerWithConcurrency): void {
  const os = require('os')

  setInterval(() => {
    try {
      // Get CPU usage (average across all cores)
      const cpus = os.cpus()
      let totalIdle = 0
      let totalTick = 0

      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times]
        }
        totalIdle += cpu.times.idle
      }

      const cpuUsage = 100 - (totalIdle / totalTick * 100)

      // Get memory usage
      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const memUsage = ((totalMem - freeMem) / totalMem) * 100

      // Adjust concurrency based on load
      const currentConcurrency = worker.getConcurrency()

      if (memUsage > MEMORY_THRESHOLD) {
        // Memory pressure - reduce aggressively
        worker.adjustConcurrency(-2)
        console.log(`[Worker] High memory (${memUsage.toFixed(1)}%), reducing concurrency`)
      } else if (cpuUsage > CPU_THRESHOLD_HIGH) {
        // High CPU - reduce by 1
        worker.adjustConcurrency(-1)
        console.log(`[Worker] High CPU (${cpuUsage.toFixed(1)}%), reducing concurrency`)
      } else if (cpuUsage < CPU_THRESHOLD_LOW && memUsage < 70) {
        // Low load - can increase
        worker.adjustConcurrency(1)
        console.log(`[Worker] Low load (CPU: ${cpuUsage.toFixed(1)}%, Mem: ${memUsage.toFixed(1)}%), increasing concurrency`)
      }

    } catch (err) {
      console.error('[Worker] Dynamic concurrency check error:', err)
    }
  }, CONCURRENCY_ADJUST_INTERVAL)
}

/**
 * Detect and handle stale jobs (no heartbeat for too long)
 */
function setupStaleJobDetector(config?: { host?: string; port?: number }): void {
  // Use state connection for stale job detection (db 2)
  const redis = getStateConnection(config)

  setInterval(async () => {
    try {
      // Find all running workflows
      const keys = await redis.keys('workflow:*:state')

      for (const key of keys) {
        const state = await redis.hgetall(key)

        if (state.status === 'running' && state.lastActivity) {
          const lastActivity = parseInt(state.lastActivity, 10)
          const now = Date.now()

          if (now - lastActivity > STALE_JOB_THRESHOLD) {
            const workflowId = key.replace('workflow:', '').replace(':state', '')
            console.warn(`[Worker] Stale job detected: ${workflowId}`)

            // Mark as stalled
            await redis.hset(key, 'status', 'stalled', 'stalledAt', now.toString())
          }
        }
      }
    } catch (err) {
      console.error('[Worker] Stale job check error:', err)
    }
  }, STALE_JOB_CHECK_INTERVAL)
}

/**
 * Process a single agent execution job
 */
async function processAgentJob(
  job: Job<AgentExecutionParams>,
  runner: AgentRunner,
  config?: { host?: string; port?: number }
): Promise<AgentExecutionResult> {
  const { workflowId, params } = job.data
  const { prompt, cwd = '/root/.claude', sessionId } = params

  // Use typed connections for separation
  const stateRedis = getStateConnection(config)    // db 2 - workflow state
  const streamRedis = getStreamConnection(config)  // db 1 - output streams

  const stateKey = REDIS_KEYS.workflowState(workflowId)
  const outputStream = REDIS_KEYS.workflowOutput(workflowId)
  const signalChannel = REDIS_KEYS.workflowSignals(workflowId)

  console.log(`[Worker] Starting agent execution`, { workflowId, cwd })

  // Update state to running with initial heartbeat (state connection)
  const now = Date.now()
  await stateRedis.hset(stateKey, {
    status: 'running',
    lastActivity: now.toString(),
    startedAt: now.toString(),
  })

  // Heartbeat interval - update lastActivity every 5 seconds (state connection)
  const HEARTBEAT_INTERVAL = 5000
  const heartbeatTimer = setInterval(async () => {
    try {
      await stateRedis.hset(stateKey, 'lastActivity', Date.now().toString())
    } catch (err) {
      console.error('[Worker] Heartbeat error:', err)
    }
  }, HEARTBEAT_INTERVAL)

  // Subscribe to signals (for user input) - new connection for pub/sub
  const subscriber = createRedisConnection('state', config)
  await subscriber.subscribe(signalChannel)

  // Start agent process
  const result = runner.run({
    runId: workflowId,
    prompt,
    cwd,
    sessionId,
  })

  let resultSessionId: string | undefined
  let exitStatus: 'completed' | 'failed' | 'cancelled' = 'completed'

  // Handle signals from user
  subscriber.on('message', async (channel, message) => {
    try {
      const { signal, data } = JSON.parse(message)
      console.log(`[Worker] Received signal: ${signal}`, { workflowId, data })

      switch (signal) {
        case 'userInput':
          result.write(String(data))
          await pushOutput(streamRedis, outputStream, {
            type: 'input_echo',
            content: `> ${data}`,
            timestamp: Date.now(),
          })
          await stateRedis.hset(stateKey, 'status', 'running')
          break

        case 'interrupt':
        case 'cancel':
          runner.kill(workflowId)
          exitStatus = 'cancelled'
          break
      }
    } catch (err) {
      console.error('[Worker] Error processing signal:', err)
    }
  })

  // Process output stream
  try {
    for await (const update of result.stream) {
      // Push to Redis stream (stream connection - db 1)
      await pushOutput(streamRedis, outputStream, update)

      // Track session ID
      if (update.sessionId) {
        resultSessionId = update.sessionId
      }

      // Update state on input request (state connection - db 2)
      if (update.type === 'input_request') {
        await stateRedis.hset(stateKey, {
          status: 'awaiting_input',
          lastInputRequest: update.content,
        })
      }

      // Handle completion
      if (update.type === 'completed') {
        break
      }

      // Handle error
      if (update.type === 'error') {
        exitStatus = 'failed'
        await stateRedis.hset(stateKey, 'error', update.content)
      }
    }
  } catch (err) {
    console.error('[Worker] Error processing stream:', err)
    exitStatus = 'failed'
    await stateRedis.hset(stateKey, 'error', String(err))
  }

  // Cleanup
  clearInterval(heartbeatTimer) // Stop heartbeat
  await subscriber.unsubscribe()
  subscriber.disconnect()
  result.cleanup()

  // Final state update (state connection - db 2)
  await stateRedis.hset(stateKey, {
    status: exitStatus,
    completedAt: Date.now().toString(),
    ...(resultSessionId && { sessionId: resultSessionId }),
  })

  // Note: shared connections are not disconnected here
  // They persist for other jobs

  console.log(`[Worker] Agent execution complete`, { workflowId, exitStatus, sessionId: resultSessionId })

  return {
    exitCode: exitStatus === 'completed' ? 0 : 1,
    status: exitStatus,
    sessionId: resultSessionId,
  }
}

/**
 * Push update to Redis stream
 */
async function pushOutput(
  redis: Redis,
  streamKey: string,
  update: StreamUpdate
): Promise<void> {
  await redis.xadd(
    streamKey,
    'MAXLEN', '~', '1000',
    '*',
    'type', update.type,
    'content', update.content,
    'timestamp', update.timestamp.toString()
  )
}
