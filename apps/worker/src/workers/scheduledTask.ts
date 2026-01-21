/**
 * Scheduled Task Worker
 * Handles reminders, cron jobs, and scheduled agent triggers
 */

import { Worker, Job, Queue } from 'bullmq'
import { getBullMQConnection } from '@elio/workflow'

export interface ScheduledTaskParams {
  workflowId: string
  params: {
    chatId: number
    type: 'reminder' | 'agent_trigger' | 'workflow' | 'notification'
    message?: string
    agentName?: string
    agentInput?: string
    notifyTelegram?: boolean
  }
}

export interface ScheduledTaskResult {
  success: boolean
  message?: string
}

// Telegram notification function (will be injected)
type NotifyFunction = (chatId: number, message: string) => Promise<void>

/**
 * Create scheduled task worker
 */
export function createScheduledTaskWorker(
  notify: NotifyFunction,
  config?: { host?: string; port?: number }
): Worker {
  const connection = getBullMQConnection(config)

  return new Worker<ScheduledTaskParams, ScheduledTaskResult>(
    'scheduled-tasks',
    async (job) => processScheduledTask(job, notify, config),
    {
      connection,
      concurrency: 2,
    }
  )
}

/**
 * Process a scheduled task
 */
async function processScheduledTask(
  job: Job<ScheduledTaskParams>,
  notify: NotifyFunction,
  config?: { host?: string; port?: number }
): Promise<ScheduledTaskResult> {
  const { workflowId, params } = job.data
  const { chatId, type } = params

  console.log(`[ScheduledWorker] Processing task`, { workflowId, type, chatId })

  try {
    switch (type) {
      case 'reminder':
        await notify(chatId, `🔔 Reminder: ${params.message}`)
        return { success: true, message: 'Reminder sent' }

      case 'agent_trigger':
        // Trigger agent execution via agent-execution queue
        const connection = getBullMQConnection(config)
        const agentQueue = new Queue('agent-execution', { connection })

        await agentQueue.add('agent-execution', {
          workflowId: `agent-${Date.now()}`,
          params: {
            agentId: params.agentName,
            prompt: params.agentInput || 'Continue your work',
            config: {
              repo: '/root/.claude', // Default repo, should be from DB
            },
          },
        })

        await notify(chatId, `🚀 Started agent "${params.agentName}"`)
        await agentQueue.close()

        return { success: true, message: `Agent ${params.agentName} triggered` }

      case 'notification':
        if (params.message) {
          await notify(chatId, params.message)
        }
        return { success: true, message: 'Notification sent' }

      case 'workflow':
        // For complex workflows, we might trigger multiple steps
        console.log(`[ScheduledWorker] Workflow type not fully implemented`, { workflowId })
        return { success: true, message: 'Workflow placeholder' }

      default:
        console.warn(`[ScheduledWorker] Unknown task type: ${type}`)
        return { success: false, message: `Unknown type: ${type}` }
    }
  } catch (err) {
    console.error(`[ScheduledWorker] Error processing task:`, err)
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * Schedule a reminder
 */
export async function scheduleReminder(
  queue: Queue,
  chatId: number,
  message: string,
  executeAt: Date
): Promise<string> {
  const delay = executeAt.getTime() - Date.now()
  if (delay < 0) {
    throw new Error('Cannot schedule in the past')
  }

  const workflowId = `reminder-${Date.now()}`

  await queue.add(
    'scheduled-tasks',
    {
      workflowId,
      params: {
        chatId,
        type: 'reminder',
        message,
      },
    },
    { delay, jobId: workflowId }
  )

  return workflowId
}

/**
 * Schedule an agent trigger
 */
export async function scheduleAgentTrigger(
  queue: Queue,
  chatId: number,
  agentName: string,
  input: string,
  executeAt: Date
): Promise<string> {
  const delay = executeAt.getTime() - Date.now()
  if (delay < 0) {
    throw new Error('Cannot schedule in the past')
  }

  const workflowId = `agent-trigger-${Date.now()}`

  await queue.add(
    'scheduled-tasks',
    {
      workflowId,
      params: {
        chatId,
        type: 'agent_trigger',
        agentName,
        agentInput: input,
      },
    },
    { delay, jobId: workflowId }
  )

  return workflowId
}

/**
 * Schedule a repeating task (cron)
 */
export async function scheduleCronTask(
  queue: Queue,
  chatId: number,
  type: 'reminder' | 'agent_trigger',
  cronPattern: string,
  params: { message?: string; agentName?: string; agentInput?: string }
): Promise<string> {
  const workflowId = `cron-${type}-${Date.now()}`

  await queue.add(
    'scheduled-tasks',
    {
      workflowId,
      params: {
        chatId,
        type,
        ...params,
      },
    },
    {
      repeat: { pattern: cronPattern },
      jobId: workflowId,
    }
  )

  return workflowId
}
