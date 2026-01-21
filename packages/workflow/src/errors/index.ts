/**
 * Structured Error Hierarchy
 * Based on MyAgent patterns for consistent error handling
 */

/**
 * Base error for all workflow errors
 */
export class WorkflowError extends Error {
  readonly code: string
  readonly retryable: boolean
  readonly metadata: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    options?: {
      retryable?: boolean
      cause?: Error
      metadata?: Record<string, unknown>
    }
  ) {
    super(message, { cause: options?.cause })
    this.name = 'WorkflowError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.metadata = options?.metadata ?? {}
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      metadata: this.metadata,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    }
  }
}

/**
 * Connection errors (Redis, network)
 */
export class ConnectionError extends WorkflowError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super(message, 'CONNECTION_ERROR', { retryable: true, ...options })
    this.name = 'ConnectionError'
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends WorkflowError {
  readonly timeoutMs: number

  constructor(
    message: string,
    timeoutMs: number,
    options?: { cause?: Error; metadata?: Record<string, unknown> }
  ) {
    super(message, 'TIMEOUT', { retryable: true, ...options })
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
    this.metadata.timeoutMs = timeoutMs
  }
}

/**
 * Agent execution errors
 */
export class AgentExecutionError extends WorkflowError {
  readonly exitCode: number | null
  readonly stderr: string

  constructor(
    message: string,
    exitCode: number | null,
    stderr: string,
    options?: { cause?: Error; metadata?: Record<string, unknown> }
  ) {
    super(message, 'AGENT_EXECUTION_ERROR', { retryable: false, ...options })
    this.name = 'AgentExecutionError'
    this.exitCode = exitCode
    this.stderr = stderr
    this.metadata.exitCode = exitCode
    this.metadata.stderr = stderr.slice(0, 500)
  }
}

/**
 * Workflow not found
 */
export class WorkflowNotFoundError extends WorkflowError {
  readonly workflowId: string

  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`, 'WORKFLOW_NOT_FOUND', { retryable: false })
    this.name = 'WorkflowNotFoundError'
    this.workflowId = workflowId
    this.metadata.workflowId = workflowId
  }
}

/**
 * Invalid workflow state for operation
 */
export class InvalidStateError extends WorkflowError {
  readonly currentState: string
  readonly expectedStates: string[]

  constructor(currentState: string, expectedStates: string[], operation: string) {
    super(
      `Cannot ${operation}: workflow is ${currentState}, expected one of: ${expectedStates.join(', ')}`,
      'INVALID_STATE',
      { retryable: false }
    )
    this.name = 'InvalidStateError'
    this.currentState = currentState
    this.expectedStates = expectedStates
    this.metadata.currentState = currentState
    this.metadata.expectedStates = expectedStates
    this.metadata.operation = operation
  }
}

/**
 * Cancelled by user or system
 */
export class CancellationError extends WorkflowError {
  readonly reason: 'user' | 'timeout' | 'system'

  constructor(reason: 'user' | 'timeout' | 'system', message?: string) {
    super(message ?? `Workflow cancelled: ${reason}`, 'CANCELLED', { retryable: false })
    this.name = 'CancellationError'
    this.reason = reason
    this.metadata.reason = reason
  }
}

/**
 * Queue full, cannot accept more items
 */
export class QueueOverflowError extends WorkflowError {
  readonly queueSize: number
  readonly maxSize: number

  constructor(queueSize: number, maxSize: number) {
    super(`Queue overflow: ${queueSize}/${maxSize}`, 'QUEUE_OVERFLOW', { retryable: false })
    this.name = 'QueueOverflowError'
    this.queueSize = queueSize
    this.maxSize = maxSize
    this.metadata.queueSize = queueSize
    this.metadata.maxSize = maxSize
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends WorkflowError {
  readonly retryAfterMs: number

  constructor(retryAfterMs: number, service?: string) {
    super(
      `Rate limit exceeded${service ? ` for ${service}` : ''}, retry after ${retryAfterMs}ms`,
      'RATE_LIMIT',
      { retryable: true }
    )
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
    this.metadata.retryAfterMs = retryAfterMs
    if (service) {
      this.metadata.service = service
    }
  }
}

/**
 * Validation error
 */
export class ValidationError extends WorkflowError {
  readonly field?: string
  readonly value?: unknown

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', { retryable: false })
    this.name = 'ValidationError'
    this.field = field
    this.value = value
    if (field) {
      this.metadata.field = field
    }
  }
}

/**
 * Helper to check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof WorkflowError) {
    return error.retryable
  }
  return false
}

/**
 * Helper to wrap unknown errors
 */
export function wrapError(error: unknown, code = 'UNKNOWN_ERROR'): WorkflowError {
  if (error instanceof WorkflowError) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)
  const cause = error instanceof Error ? error : undefined

  return new WorkflowError(message, code, { retryable: false, cause })
}
