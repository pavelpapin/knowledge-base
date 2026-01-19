/**
 * Headless Mode Types
 * Autonomous task execution system
 */

export type TaskType =
  | 'research'      // Deep research on a topic
  | 'report'        // Generate a report
  | 'monitor'       // Monitor something
  | 'scrape'        // Web scraping
  | 'analyze'       // Data analysis
  | 'notify'        // Send notification
  | 'backup'        // Backup operation
  | 'custom';       // Custom task

export type TaskStatus =
  | 'pending'       // Waiting to run
  | 'running'       // Currently executing
  | 'completed'     // Successfully finished
  | 'failed'        // Failed with error
  | 'cancelled';    // Manually cancelled

export interface HeadlessTask {
  id: string;
  type: TaskType;
  name: string;
  description: string;
  command: string;          // Command to execute
  args: string[];           // Arguments
  schedule?: string;        // Cron expression
  timeout: number;          // Timeout in ms
  retries: number;          // Max retries on failure
  status: TaskStatus;
  result?: string;          // Output/result
  error?: string;           // Error message
  createdAt: string;
  scheduledAt?: string;     // When to run
  startedAt?: string;       // When execution started
  completedAt?: string;     // When execution finished
  nextRunAt?: string;       // For recurring tasks
}

export interface TaskExecution {
  taskId: string;
  executionId: string;
  status: TaskStatus;
  startedAt: string;
  completedAt?: string;
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface HeadlessStore {
  tasks: HeadlessTask[];
  executions: TaskExecution[];
  settings: HeadlessSettings;
}

export interface HeadlessSettings {
  maxConcurrent: number;
  defaultTimeout: number;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  telegramChatId?: string;
}
