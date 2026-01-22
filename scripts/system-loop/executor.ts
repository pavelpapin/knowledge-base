/**
 * System Loop - Execution Engine
 */

import * as fs from 'fs'
import * as path from 'path'
import { spawn, execSync } from 'child_process'
import { CONFIG } from './config.js'
import { log } from './utils.js'
import {
  buildTeamMemberPrompt,
  buildCollectorPrompt,
  buildWorkflowPrompt,
  buildStandupPrompt,
  buildWeeklySummaryPrompt
} from './prompts.js'
import type { SchedulableItem, RunResult } from './types.js'

export async function executeItem(item: SchedulableItem): Promise<RunResult> {
  const startTime = Date.now()
  log(`Executing: ${item.id} (${item.type})`)

  try {
    // Special handling for collectors - run script directly
    if (item.type === 'collector') {
      return await runCollectorScript(item)
    }

    let prompt: string

    switch (item.type) {
      case 'team-member': {
        const memberId = item.config.memberId as string
        prompt = buildTeamMemberPrompt(memberId)
        break
      }
      case 'workflow': {
        const workflowName = item.config.workflow as string
        prompt = buildWorkflowPrompt(workflowName, item.config)
        break
      }
      case 'standup': {
        prompt = buildStandupPrompt(item.config)
        break
      }
      case 'weekly-summary': {
        prompt = buildWeeklySummaryPrompt(item.config)
        break
      }
      default:
        throw new Error(`Unknown item type: ${item.type}`)
    }

    // Try BullMQ first
    let result = await runViaBullMQ(item.id, prompt)

    if (!result.success) {
      log(`BullMQ failed for ${item.id}, trying CLI`, 'warn')
      result = await runViaCLI(item.id, prompt)
    }

    result.duration = Date.now() - startTime
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Execution error for ${item.id}: ${errorMsg}`, 'error')
    return { success: false, error: errorMsg, duration: Date.now() - startTime }
  }
}

export async function runCollectorScript(item: SchedulableItem): Promise<RunResult> {
  const startTime = Date.now()
  const workflowName = item.config.workflow as string

  // Map workflow name to script
  const scriptPath = `/root/.claude/scripts/${workflowName}.ts`

  if (!fs.existsSync(scriptPath)) {
    log(`Collector script not found: ${scriptPath}`, 'error')
    return { success: false, error: `Script not found: ${scriptPath}` }
  }

  try {
    log(`Running collector script: ${scriptPath}`)
    execSync(`npx tsx ${scriptPath}`, {
      cwd: '/root/.claude',
      timeout: 5 * 60 * 1000, // 5 minutes
      stdio: 'inherit'
    })

    return {
      success: true,
      workflowId: `script-${workflowName}`,
      duration: Date.now() - startTime
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log(`Collector script failed: ${errorMsg}`, 'error')

    // Fallback to agent if script fails
    log('Falling back to agent for collection', 'warn')
    const prompt = buildCollectorPrompt(workflowName, item.config)
    return await runViaCLI(item.id, prompt)
  }
}

export async function runViaBullMQ(itemId: string, prompt: string): Promise<RunResult> {
  // Try to connect to BullMQ via the workflow package
  try {
    // Check if Redis is available
    execSync('redis-cli ping', { timeout: 5000, stdio: 'pipe' })

    // Use the agents MCP tool via direct queue addition
    const { Queue } = await import('bullmq')
    const queue = new Queue('agent-queue', {
      connection: { host: 'localhost', port: 6379 }
    })

    const workflowId = `${itemId.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`

    await queue.add('agent-execution', {
      workflowId,
      params: {
        prompt,
        cwd: '/root/.claude',
        chatId: process.env.TELEGRAM_CHAT_ID,
      }
    }, { jobId: workflowId })

    await queue.close()

    log(`BullMQ job added: ${workflowId}`)
    return { success: true, workflowId }
  } catch (error) {
    return { success: false, error: `BullMQ error: ${error}` }
  }
}

export async function runViaCLI(itemId: string, prompt: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const safeId = itemId.replace(/[^a-zA-Z0-9]/g, '-')
    const logFile = path.join(CONFIG.logDir, `${safeId}_${Date.now()}.log`)

    // Write prompt to temp file to avoid shell escaping issues
    const promptFile = `/tmp/system-loop-prompt-${Date.now()}.txt`
    fs.writeFileSync(promptFile, prompt)

    const proc = spawn('bash', ['-c', `claude -p "$(cat ${promptFile})"`], {
      cwd: '/root/.claude',
      env: {
        ...process.env,
        CLAUDE_CODE_ENTRYPOINT: 'cli',
      },
      timeout: CONFIG.agentTimeoutMinutes * 60 * 1000,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const logStream = fs.createWriteStream(logFile)
    proc.stdout?.pipe(logStream)
    proc.stderr?.pipe(logStream)

    proc.unref()

    log(`CLI spawned for ${itemId}, PID: ${proc.pid}`)

    // Cleanup temp file after a delay
    setTimeout(() => {
      try { fs.unlinkSync(promptFile) } catch {}
    }, 60000)

    resolve({
      success: true,
      workflowId: `cli-${proc.pid}`
    })
  })
}
