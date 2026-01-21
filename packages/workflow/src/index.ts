/**
 * Workflow Package Exports
 *
 * Provides a Temporal-like API for workflow orchestration.
 * Currently implemented with BullMQ, can be migrated to Temporal later.
 */

export type {
  WorkflowClient,
  WorkflowHandle,
  WorkflowState,
  WorkflowStatus,
  WorkflowResult,
  StartOptions,
  StreamUpdate,
  StreamUpdateWithSession,
  OutputCallback,
  Signal,
} from './types.js'

export { REDIS_KEYS } from './types.js'

// Default export is BullMQ implementation
export { BullMQWorkflowClient } from './bullmq/client.js'
export {
  getRedisConnection,
  getBullMQConnection,
  createRedisConnection,
  closeRedisConnection,
  closeAllConnections,
  checkRedisHealth,
  checkAllRedisHealth,
  getQueueConnection,
  getStreamConnection,
  getStateConnection,
  getConnectionStats,
} from './bullmq/connection.js'
export type { RedisConfig, ConnectionType } from './bullmq/connection.js'

// Notifications
export type {
  NotificationChannel,
  NotificationOptions,
  ReplyOption,
  PendingNotification,
  NotificationServiceConfig,
} from './notifications/index.js'

export { AgentNotificationService } from './notifications/index.js'

// Cleanup utilities
export {
  cleanupOldWorkflows,
  trimActiveStreams,
  getCleanupStats,
  startPeriodicCleanup,
} from './bullmq/cleanup.js'
export type { CleanupStats } from './bullmq/cleanup.js'

// Batched stream writer
export {
  BatchedStreamWriter,
  getStreamWriter,
  closeStreamWriter,
} from './bullmq/stream-writer.js'
export type { StreamWriterOptions } from './bullmq/stream-writer.js'

// State management with transactions
export {
  WorkflowStateManager,
  getStateManager,
  isValidTransition,
} from './bullmq/state-manager.js'
export type { StateUpdate, TransitionRule } from './bullmq/state-manager.js'

// Health checks
export {
  runHealthChecks,
  quickHealthCheck,
  printHealthReport,
} from './health/index.js'
export type { HealthCheckResult, SystemHealth } from './health/index.js'

// Errors
export {
  WorkflowError,
  ConnectionError,
  TimeoutError,
  AgentExecutionError,
  WorkflowNotFoundError,
  InvalidStateError,
  CancellationError,
  QueueOverflowError,
  RateLimitError,
  ValidationError,
  isRetryable,
  wrapError,
} from './errors/index.js'

// Factory function
import { BullMQWorkflowClient } from './bullmq/client.js'

export function createWorkflowClient(config?: { host?: string; port?: number }): BullMQWorkflowClient {
  return new BullMQWorkflowClient(config)
}
