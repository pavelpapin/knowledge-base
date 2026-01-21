/**
 * Process Handle
 * Manages CLI process lifecycle with proper cleanup
 */

import { spawn, ChildProcess } from 'child_process'

export type ProcessState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error'

export interface ProcessOptions {
  command: string
  args: string[]
  cwd: string
  timeoutMs?: number
  signal?: AbortSignal
  env?: Record<string, string>
}

export interface ProcessCallbacks {
  onStdoutLine: (line: string) => void
  onStderrLine?: (line: string) => void
  onClose: (code: number | null, error: Error | null) => void
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export class ProcessHandle {
  private process: ChildProcess | null = null
  private state: ProcessState = 'idle'
  private stderrBuffer: string[] = []
  private abortController: AbortController
  private timeoutId: NodeJS.Timeout | null = null

  readonly runId: string
  readonly options: ProcessOptions
  readonly callbacks: ProcessCallbacks

  constructor(
    runId: string,
    options: ProcessOptions,
    callbacks: ProcessCallbacks
  ) {
    this.runId = runId
    this.options = options
    this.callbacks = callbacks
    this.abortController = new AbortController()

    // Link external abort signal
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        this.stop()
      }, { once: true })
    }
  }

  /**
   * Spawn the process
   */
  spawn(): boolean {
    if (this.state !== 'idle') {
      console.warn(`[ProcessHandle] Cannot spawn in state: ${this.state}`)
      return false
    }

    this.state = 'starting'

    try {
      // Use script to create PTY for proper stdout streaming
      // Without PTY, Node.js pipes buffer stdout and we don't get realtime output
      //
      // SECURITY: Args are escaped using POSIX single-quote escaping
      // Single quotes protect against most injection, and we escape embedded quotes
      const escapeShellArg = (arg: string): string => {
        // Remove any null bytes (security)
        const clean = arg.replace(/\0/g, '')
        // POSIX single-quote escaping: replace ' with '\''
        return `'${clean.replace(/'/g, "'\\''")}'`
      }

      const quotedArgs = this.options.args.map(escapeShellArg).join(' ')
      const innerCommand = `${this.options.command} ${quotedArgs}`

      // Log command without full prompt (may contain sensitive data)
      const logCommand = `${this.options.command} [${this.options.args.length} args]`
      console.log(`[ProcessHandle] Command: ${logCommand}`)

      this.process = spawn('script', ['-q', '-c', innerCommand, '/dev/null'], {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...this.options.env,
          TERM: 'dumb', // Disable color codes
        },
      })

      if (!this.process.pid) {
        throw new Error('Failed to get process PID')
      }

      this.state = 'running'
      this.setupProcessHandlers()
      this.startTimeout()

      console.log(`[ProcessHandle] Spawned ${this.options.command} (PID: ${this.process.pid})`, {
        args: this.options.args,
        cwd: this.options.cwd,
      })
      return true
    } catch (error) {
      this.state = 'error'
      const err = error instanceof Error ? error : new Error(String(error))
      this.callbacks.onClose(null, err)
      return false
    }
  }

  /**
   * Write to process stdin
   */
  write(data: string): boolean {
    if (this.state !== 'running' || !this.process?.stdin) {
      return false
    }

    try {
      this.process.stdin.write(data)
      return true
    } catch (error) {
      console.error('[ProcessHandle] Write error:', error)
      return false
    }
  }

  /**
   * Stop the process
   */
  stop(): void {
    if (this.state === 'stopped' || this.state === 'stopping') {
      return
    }

    this.state = 'stopping'
    this.clearTimeout()
    this.abortController.abort()

    if (this.process) {
      // Try graceful shutdown first
      this.process.kill('SIGTERM')

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process && this.state !== 'stopped') {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stop()
    this.clearTimeout()
  }

  /**
   * Get abort signal
   */
  getSignal(): AbortSignal {
    return this.abortController.signal
  }

  /**
   * Get current state
   */
  get currentState(): ProcessState {
    return this.state
  }

  /**
   * Get process PID
   */
  get pid(): number | undefined {
    return this.process?.pid
  }

  /**
   * Get collected stderr
   */
  get stderr(): string {
    return this.stderrBuffer.join('\n')
  }

  private setupProcessHandlers(): void {
    if (!this.process) return

    let stdoutBuffer = ''
    let stderrBuffer = ''

    // Handle stdout
    this.process.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()

      // Process complete lines
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim()) {
          this.callbacks.onStdoutLine(line)
        }
      }
    })

    // Handle stderr
    this.process.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString()
      this.stderrBuffer.push(chunk.toString())

      // Limit stderr buffer
      if (this.stderrBuffer.length > 100) {
        this.stderrBuffer.shift()
      }

      // Process complete lines
      const lines = stderrBuffer.split('\n')
      stderrBuffer = lines.pop() || ''

      for (const line of lines) {
        if (line.trim()) {
          this.callbacks.onStderrLine?.(line)
        }
      }
    })

    // Handle close
    this.process.on('close', (code) => {
      this.state = 'stopped'
      this.clearTimeout()

      // Process remaining buffers
      if (stdoutBuffer.trim()) {
        this.callbacks.onStdoutLine(stdoutBuffer)
      }

      this.callbacks.onClose(code, null)
    })

    // Handle error
    this.process.on('error', (error) => {
      this.state = 'error'
      this.clearTimeout()
      this.callbacks.onClose(null, error)
    })
  }

  private startTimeout(): void {
    const timeoutMs = this.options.timeoutMs || DEFAULT_TIMEOUT_MS

    this.timeoutId = setTimeout(() => {
      console.warn(`[ProcessHandle] Process timeout (${timeoutMs}ms), killing...`)
      this.stop()
    }, timeoutMs)
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}
