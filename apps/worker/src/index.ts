/**
 * Elio Worker
 * Background agent execution and scheduled tasks
 */

import { createAgentExecutionWorker } from './workers/agentExecution.js'
import { createScheduledTaskWorker } from './workers/scheduledTask.js'
import { createSkillExecutionWorker } from './workers/skillExecution.js'
import {
  checkRedisHealth,
  checkAllRedisHealth,
  closeAllConnections,
  cleanupOrphanedWorkflows,
} from '@elio/workflow'

// Environment config
const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
}

// Telegram notification placeholder (will be replaced with actual implementation)
const notifyTelegram = async (chatId: number, message: string): Promise<void> => {
  // TODO: Integrate with actual Telegram bot
  // For now, use MCP tool or direct API call
  console.log(`[Telegram] Would send to ${chatId}: ${message}`)

  // Could call via fetch to a bot webhook or use grammy
  // const bot = new Bot(process.env.TELEGRAM_BOT_API_KEY)
  // await bot.api.sendMessage(chatId, message)
}

async function main(): Promise<void> {
  console.log('[Worker] Starting Elio Worker...')
  console.log(`[Worker] Redis: ${config.host}:${config.port}`)

  // Check Redis connections (all types)
  const healthStatus = await checkAllRedisHealth()
  console.log('[Worker] Redis health:', healthStatus)

  if (!healthStatus.queue) {
    console.error('[Worker] Redis queue connection not available, exiting...')
    process.exit(1)
  }
  console.log('[Worker] Redis connections OK')

  // Create workers
  const workers = [
    createAgentExecutionWorker(config),
    createScheduledTaskWorker(notifyTelegram, config),
    createSkillExecutionWorker(config),
  ]

  console.log(`[Worker] Started ${workers.length} workers:`)
  console.log('  - agent-execution (concurrency: 4)')
  console.log('  - scheduled-tasks (concurrency: 2)')
  console.log('  - skill-execution (concurrency: 4)')

  // Run initial cleanup and start periodic cleanup
  console.log('[Worker] Running initial stream cleanup...')
  await cleanupOrphanedWorkflows().catch(err => {
    console.warn('[Worker] Initial cleanup failed:', err.message)
  })

  // Start periodic cleanup (every hour)
  const cleanupInterval = setInterval(async () => {
    try {
      const result = await cleanupOrphanedWorkflows()
      if (result.cleaned > 0) {
        console.log(`[Worker] Periodic cleanup: removed ${result.cleaned} orphaned workflows`)
      }
    } catch (err) {
      console.warn('[Worker] Periodic cleanup failed:', err)
    }
  }, 60 * 60 * 1000)
  console.log('[Worker] Periodic cleanup scheduled (hourly)')

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Worker] Received ${signal}, shutting down...`)

    // Stop periodic cleanup
    clearInterval(cleanupInterval)

    // Close all workers
    await Promise.all(workers.map(w => w.close()))
    console.log('[Worker] Workers closed')

    // Close all Redis connections
    await closeAllConnections()
    console.log('[Worker] Redis connections closed')

    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Keep process alive
  console.log('[Worker] Ready and waiting for jobs...')
}

main().catch((err) => {
  console.error('[Worker] Fatal error:', err)
  process.exit(1)
})
