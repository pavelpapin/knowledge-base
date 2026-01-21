/**
 * Workflow Types
 * Temporal-like API for workflow orchestration
 */

export interface WorkflowClient {
  /**
   * Start a new workflow execution
   */
  start<T>(workflowName: string, params: T, options?: StartOptions): Promise<WorkflowHandle>

  /**
   * Send a signal to a running workflow
   */
  signal(workflowId: string, signalName: string, data?: unknown): Promise<void>

  /**
   * Query workflow state
   */
  query<T>(workflowId: string, queryName: string): Promise<T>

  /**
   * Cancel a running workflow
   */
  cancel(workflowId: string): Promise<void>

  /**
   * Get handle for existing workflow
   */
  getHandle(workflowId: string): WorkflowHandle

  /**
   * Subscribe to workflow output stream
   */
  subscribeToOutput(workflowId: string, callback: OutputCallback): Promise<() => void>
}

export interface WorkflowHandle {
  workflowId: string
  result(): Promise<WorkflowResult>
}

export interface StartOptions {
  /** Delay before starting (ms) */
  delay?: number
  /** Custom workflow ID (default: auto-generated) */
  workflowId?: string
  /** Cron expression for repeatable jobs */
  repeat?: {
    pattern: string
    limit?: number
  }
}

export interface WorkflowState {
  status: WorkflowStatus
  startedAt?: number
  completedAt?: number
  lastActivity?: number
  error?: string
  progress?: number
}

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'stalled'

export interface WorkflowResult {
  status: WorkflowStatus
  exitCode?: number
  output?: string
  error?: string
}

export interface StreamUpdate {
  type: 'output' | 'error' | 'input_request' | 'input_echo' | 'thinking' | 'completed' | 'progress'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface StreamUpdateWithSession extends StreamUpdate {
  sessionId?: string
}

export type OutputCallback = (update: StreamUpdate) => void | Promise<void>

export interface Signal {
  signal: string
  data?: unknown
  timestamp: number
}

// Redis key patterns
export const REDIS_KEYS = {
  workflowState: (id: string) => `workflow:${id}:state`,
  workflowOutput: (id: string) => `workflow:${id}:output`,
  workflowSignals: (id: string) => `workflow:${id}:signals`,
} as const
