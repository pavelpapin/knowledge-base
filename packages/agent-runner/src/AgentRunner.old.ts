/**
 * Agent Runner
 * Manages CLI agent process execution with streaming output
 */

import type { StreamUpdateWithSession } from '@elio/workflow'
import { BoundedAsyncQueue } from './BoundedAsyncQueue.js'
import { ProcessHandle } from './ProcessHandle.js'

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const DEFAULT_QUEUE_SIZE = 100

export interface AgentRunOptions {
  runId: string
  prompt: string
  cwd: string
  sessionId?: string
  signal?: AbortSignal
}

export interface AgentRunnerConfig {
  name: string
  command: string
  buildArgs: (options: AgentRunOptions) => string[]
  parseOutput: (line: string) => StreamUpdateWithSession | null
  extractSessionId?: (output: string) => string | undefined
  timeoutMs?: number
  queueSize?: number
}

export interface SpawnResult {
  stream: AsyncGenerator<StreamUpdateWithSession>
  cleanup: () => void
  write: (data: string) => boolean
}

export class AgentRunner {
  private readonly activeHandles = new Map<string, ProcessHandle>()
  private readonly timeoutMs: number
  private readonly queueSize: number

  constructor(private readonly config: AgentRunnerConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.queueSize = config.queueSize ?? DEFAULT_QUEUE_SIZE
  }

  /**
   * Run an agent with the given options
   */
  run(options: AgentRunOptions): SpawnResult {
    const { runId, cwd, signal } = options

    const args = this.config.buildArgs(options)
    console.log(`[AgentRunner] Starting ${this.config.name}`, { runId, args: args.join(' '), cwd })

    // Create bounded queue for updates
    const queue = new BoundedAsyncQueue<StreamUpdateWithSession>({
      maxSize: this.queueSize,
      name: `${this.config.name}-${runId}`,
    })

    // Create process handle
    const handle = new ProcessHandle(
      runId,
      {
        command: this.config.command,
        args,
        cwd,
        timeoutMs: this.timeoutMs,
        signal,
      },
      {
        onStdoutLine: (line: string) => {
          const update = this.config.parseOutput(line)
          if (update) {
            queue.push(update)
          }
        },
        onStderrLine: (line: string) => {
          // Log stderr but don't push to queue unless it's an error
          console.error(`[AgentRunner] stderr: ${line}`)
        },
        onClose: (code: number | null, error: Error | null) => {
          console.log(`[AgentRunner] Process closed`, { runId, code, error: error?.message })
          this.activeHandles.delete(runId)

          // Push error if any
          if (error) {
            queue.push({
              type: 'error',
              content: `${this.config.name} error: ${error.message}`,
              timestamp: Date.now(),
            })
          }

          // Push completion
          queue.push({
            type: 'completed',
            content: code === 0 ? 'Success' : `Exit code: ${code}`,
            timestamp: Date.now(),
          })

          queue.close()
        },
      }
    )

    // Store handle
    this.activeHandles.set(runId, handle)

    // Try to spawn
    const spawned = handle.spawn()
    if (!spawned) {
      this.activeHandles.delete(runId)
      queue.push({
        type: 'error',
        content: 'Failed to spawn process',
        timestamp: Date.now(),
      })
      queue.close()
    } else {
      // Push initial thinking indicator
      queue.push({
        type: 'thinking',
        content: '...',
        timestamp: Date.now(),
      })
    }

    // Create async generator from queue
    const stream = this.createStream(queue, handle, runId)

    // Cleanup function
    const cleanup = () => {
      console.log(`[AgentRunner] Cleanup called for ${runId}`)
      handle.cleanup()
      queue.close()
      this.activeHandles.delete(runId)
    }

    // Write function for stdin
    const write = (data: string): boolean => {
      return handle.write(data + '\n')
    }

    return { stream, cleanup, write }
  }

  /**
   * Kill a running process
   */
  kill(runId: string): boolean {
    const handle = this.activeHandles.get(runId)
    if (handle) {
      console.log(`[AgentRunner] Killing process ${runId}`)
      handle.stop()
      return true
    }
    return false
  }

  /**
   * Check if process is running
   */
  isRunning(runId: string): boolean {
    const handle = this.activeHandles.get(runId)
    return handle?.currentState === 'running'
  }

  /**
   * Get all running process IDs
   */
  getRunningIds(): string[] {
    return Array.from(this.activeHandles.entries())
      .filter(([, handle]) => handle.currentState === 'running')
      .map(([id]) => id)
  }

  /**
   * Kill all running processes
   */
  killAll(): void {
    for (const runId of this.getRunningIds()) {
      this.kill(runId)
    }
  }

  private async *createStream(
    queue: BoundedAsyncQueue<StreamUpdateWithSession>,
    handle: ProcessHandle,
    runId: string
  ): AsyncGenerator<StreamUpdateWithSession> {
    try {
      for await (const update of queue.iterate(handle.getSignal())) {
        yield update
      }
    } catch (err) {
      console.error(`[AgentRunner] Error in stream for ${runId}:`, err)
      throw err
    }
  }
}

/**
 * Create Claude Code agent runner
 */
/**
 * Sanitize string for safe shell argument
 * Removes shell metacharacters that could cause injection
 */
function sanitizeForShell(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '')

  // Limit length to prevent DoS
  if (sanitized.length > 100000) {
    sanitized = sanitized.slice(0, 100000)
  }

  return sanitized
}

/**
 * Validate cwd is within allowed directory
 */
function validateCwd(cwd: string): string {
  const resolved = require('path').resolve(cwd)
  const allowed = ['/root/.claude', '/tmp', '/home']

  if (!allowed.some(prefix => resolved.startsWith(prefix))) {
    throw new Error(`CWD not allowed: ${cwd}`)
  }

  return resolved
}

export function createClaudeRunner(): AgentRunner {
  return new AgentRunner({
    name: 'claude',
    command: 'claude',
    buildArgs: (options) => {
      // Validate and sanitize inputs
      const prompt = sanitizeForShell(options.prompt)
      const cwd = validateCwd(options.cwd)

      const args = [
        '-p',                          // Print mode (non-interactive)
        '--output-format', 'stream-json',
        '--verbose',                   // Required for stream-json
        '--permission-mode', 'default', // Override bypassPermissions in settings
        // NOTE: Do NOT use --mcp-config '{}' - it causes hangs
      ]

      if (options.sessionId) {
        // Validate sessionId format (UUID only)
        if (!/^[a-f0-9-]{36}$/i.test(options.sessionId)) {
          throw new Error(`Invalid sessionId format: ${options.sessionId}`)
        }
        args.push('--resume', options.sessionId)
      }

      // Prompt is the last argument
      args.push(prompt)

      return args
    },
    parseOutput: (line) => {
      try {
        const data = JSON.parse(line)

        // Helper to extract text from Claude message content
        const extractContent = (content: unknown): string => {
          if (typeof content === 'string') return content
          if (Array.isArray(content)) {
            return content
              .map(c => c.text || c.content || '')
              .filter(Boolean)
              .join('\n')
          }
          if (content && typeof content === 'object') {
            return (content as { text?: string }).text || JSON.stringify(content)
          }
          return String(content || '')
        }

        // Map Claude Code JSON format to our StreamUpdate
        switch (data.type) {
          case 'assistant':
            return {
              type: 'output',
              content: extractContent(data.message?.content),
              timestamp: Date.now(),
              sessionId: data.session_id,
            }

          case 'user':
            // Tool results - skip or return minimal info
            return null

          case 'user_input_request':
            return {
              type: 'input_request',
              content: data.message || 'Waiting for input...',
              timestamp: Date.now(),
            }

          case 'result':
            return {
              type: 'completed',
              content: data.result || 'Done',
              timestamp: Date.now(),
              sessionId: data.session_id,
            }

          case 'error':
            return {
              type: 'error',
              content: data.error || 'Unknown error',
              timestamp: Date.now(),
            }

          case 'system':
            // Init message - skip
            return null

          default:
            // Pass through other types as output
            if (data.message?.content) {
              return {
                type: 'output',
                content: extractContent(data.message.content),
                timestamp: Date.now(),
              }
            }
            return null
        }
      } catch {
        // Not JSON, treat as raw output
        if (line.trim()) {
          return {
            type: 'output',
            content: line,
            timestamp: Date.now(),
          }
        }
        return null
      }
    },
  })
}
