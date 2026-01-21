/**
 * Agents Adapter
 * Allows starting and managing background agent workflows
 */

import { z } from 'zod'
import { createWorkflowClient, type BullMQWorkflowClient } from '@elio/workflow'
import type { Adapter, AdapterTool } from '../../gateway/types.js'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('agents')

// Lazy-initialized workflow client
let workflowClient: BullMQWorkflowClient | null = null
let redisAvailable = true

function getClient(): BullMQWorkflowClient {
  if (!workflowClient) {
    workflowClient = createWorkflowClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    })
  }
  return workflowClient
}

// Check if Redis is available
function isAuthenticated(): boolean {
  // Return true - Redis defaults to localhost:6379
  return redisAvailable
}

// Schemas
const startAgentSchema = z.object({
  prompt: z.string().describe('The prompt/task for the agent'),
  cwd: z.string().optional().describe('Working directory (default: /root/.claude)'),
  chatId: z.union([z.string(), z.number()]).optional().describe('Telegram chat ID for notifications'),
  sessionId: z.string().optional().describe('Resume existing session'),
})

const queryAgentSchema = z.object({
  workflowId: z.string().describe('The workflow ID to query'),
})

const signalAgentSchema = z.object({
  workflowId: z.string().describe('The workflow ID to signal'),
  signal: z.string().describe('Signal name (userInput, cancel, interrupt)'),
  data: z.unknown().optional().describe('Signal data'),
})

const tools: AdapterTool[] = [
  {
    name: 'elio_agent_start',
    description: 'Start a background Claude agent to work on a task. Returns workflow ID for tracking.',
    type: 'write',
    schema: startAgentSchema,
    execute: async (params) => {
      const args = params as z.infer<typeof startAgentSchema>
      logger.info('Starting agent', { prompt: args.prompt.slice(0, 100) })

      try {
        const client = getClient()
        const handle = await client.start('agent-execution', {
          prompt: args.prompt,
          cwd: args.cwd || '/root/.claude',
          chatId: args.chatId,
          sessionId: args.sessionId,
        })

        logger.info('Agent started', { workflowId: handle.workflowId })

        return JSON.stringify({
          success: true,
          workflowId: handle.workflowId,
          message: `Agent started with ID: ${handle.workflowId}`,
        })
      } catch (error) {
        logger.error('Failed to start agent', { error })
        throw error
      }
    },
  },

  {
    name: 'elio_agent_status',
    description: 'Get the status of a running agent workflow',
    type: 'read',
    schema: queryAgentSchema,
    execute: async (params) => {
      const { workflowId } = params as z.infer<typeof queryAgentSchema>
      logger.info('Querying agent status', { workflowId })

      try {
        const client = getClient()
        const state = await client.query<{
          status: string
          startedAt?: number
          lastActivity?: number
          progress?: number
          error?: string
        }>(workflowId, 'status')

        return JSON.stringify({
          workflowId,
          ...state,
          startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : undefined,
          lastActivity: state.lastActivity ? new Date(state.lastActivity).toISOString() : undefined,
        }, null, 2)
      } catch (error) {
        logger.error('Failed to query agent', { workflowId, error })
        throw error
      }
    },
  },

  {
    name: 'elio_agent_signal',
    description: 'Send a signal to a running agent (userInput, cancel, interrupt)',
    type: 'write',
    schema: signalAgentSchema,
    execute: async (params) => {
      const { workflowId, signal, data } = params as z.infer<typeof signalAgentSchema>
      logger.info('Sending signal to agent', { workflowId, signal })

      try {
        const client = getClient()
        await client.signal(workflowId, signal, data)

        return JSON.stringify({
          success: true,
          message: `Signal '${signal}' sent to ${workflowId}`,
        })
      } catch (error) {
        logger.error('Failed to signal agent', { workflowId, signal, error })
        throw error
      }
    },
  },

  {
    name: 'elio_agent_cancel',
    description: 'Cancel a running agent workflow',
    type: 'write',
    schema: queryAgentSchema,
    execute: async (params) => {
      const { workflowId } = params as z.infer<typeof queryAgentSchema>
      logger.info('Cancelling agent', { workflowId })

      try {
        const client = getClient()
        await client.cancel(workflowId)

        return JSON.stringify({
          success: true,
          message: `Agent ${workflowId} cancelled`,
        })
      } catch (error) {
        logger.error('Failed to cancel agent', { workflowId, error })
        throw error
      }
    },
  },
]

export const agentsAdapter: Adapter = {
  name: 'agents',
  isAuthenticated,
  tools,
}
