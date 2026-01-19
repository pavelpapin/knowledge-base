/**
 * Headless Store
 * Persistence layer for autonomous task execution
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  HeadlessStore,
  HeadlessTask,
  TaskExecution,
  TaskType,
  TaskStatus,
  HeadlessSettings
} from './types.js';

const STORE_PATH = '/root/.claude/headless/store.json';

function loadStore(): HeadlessStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return {
    tasks: [],
    executions: [],
    settings: {
      maxConcurrent: 3,
      defaultTimeout: 300000, // 5 minutes
      notifyOnComplete: true,
      notifyOnError: true
    }
  };
}

function saveStore(store: HeadlessStore): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Task CRUD

export function createTask(
  type: TaskType,
  name: string,
  command: string,
  options: Partial<Omit<HeadlessTask, 'id' | 'type' | 'name' | 'command' | 'status' | 'createdAt'>> = {}
): HeadlessTask {
  const store = loadStore();
  const now = new Date().toISOString();

  const task: HeadlessTask = {
    id: crypto.randomUUID(),
    type,
    name,
    description: options.description || '',
    command,
    args: options.args || [],
    schedule: options.schedule,
    timeout: options.timeout || store.settings.defaultTimeout,
    retries: options.retries || 0,
    status: 'pending',
    createdAt: now,
    scheduledAt: options.scheduledAt
  };

  store.tasks.push(task);
  saveStore(store);
  return task;
}

export function getTask(id: string): HeadlessTask | null {
  return loadStore().tasks.find((t: HeadlessTask) => t.id === id) || null;
}

export function updateTask(id: string, updates: Partial<HeadlessTask>): HeadlessTask | null {
  const store = loadStore();
  const index = store.tasks.findIndex((t: HeadlessTask) => t.id === id);

  if (index === -1) return null;

  store.tasks[index] = {
    ...store.tasks[index],
    ...updates
  };

  saveStore(store);
  return store.tasks[index];
}

export function deleteTask(id: string): boolean {
  const store = loadStore();
  const index = store.tasks.findIndex((t: HeadlessTask) => t.id === id);
  if (index === -1) return false;

  store.tasks.splice(index, 1);
  saveStore(store);
  return true;
}

export function getPendingTasks(): HeadlessTask[] {
  return loadStore().tasks.filter((t: HeadlessTask) => t.status === 'pending');
}

export function getRunningTasks(): HeadlessTask[] {
  return loadStore().tasks.filter((t: HeadlessTask) => t.status === 'running');
}

export function getScheduledTasks(): HeadlessTask[] {
  return loadStore().tasks.filter((t: HeadlessTask) => t.schedule);
}

export function getAllTasks(): HeadlessTask[] {
  return loadStore().tasks;
}

// Execution tracking

export function startExecution(taskId: string): TaskExecution {
  const store = loadStore();
  const now = new Date().toISOString();

  // Update task status
  const taskIndex = store.tasks.findIndex((t: HeadlessTask) => t.id === taskId);
  if (taskIndex !== -1) {
    store.tasks[taskIndex].status = 'running';
    store.tasks[taskIndex].startedAt = now;
  }

  const execution: TaskExecution = {
    taskId,
    executionId: crypto.randomUUID(),
    status: 'running',
    startedAt: now
  };

  store.executions.push(execution);
  saveStore(store);
  return execution;
}

export function completeExecution(
  executionId: string,
  output: string,
  exitCode: number
): TaskExecution | null {
  const store = loadStore();
  const execIndex = store.executions.findIndex((e: TaskExecution) => e.executionId === executionId);

  if (execIndex === -1) return null;

  const now = new Date().toISOString();
  const status = exitCode === 0 ? 'completed' : 'failed';

  store.executions[execIndex] = {
    ...store.executions[execIndex],
    status,
    completedAt: now,
    output,
    exitCode
  };

  // Update task
  const taskId = store.executions[execIndex].taskId;
  const taskIndex = store.tasks.findIndex((t: HeadlessTask) => t.id === taskId);
  if (taskIndex !== -1) {
    store.tasks[taskIndex].status = status as TaskStatus;
    store.tasks[taskIndex].completedAt = now;
    store.tasks[taskIndex].result = output;
    if (exitCode !== 0) {
      store.tasks[taskIndex].error = output;
    }
  }

  saveStore(store);
  return store.executions[execIndex];
}

export function failExecution(executionId: string, error: string): TaskExecution | null {
  const store = loadStore();
  const execIndex = store.executions.findIndex((e: TaskExecution) => e.executionId === executionId);

  if (execIndex === -1) return null;

  const now = new Date().toISOString();

  store.executions[execIndex] = {
    ...store.executions[execIndex],
    status: 'failed',
    completedAt: now,
    error
  };

  // Update task
  const taskId = store.executions[execIndex].taskId;
  const taskIndex = store.tasks.findIndex((t: HeadlessTask) => t.id === taskId);
  if (taskIndex !== -1) {
    store.tasks[taskIndex].status = 'failed';
    store.tasks[taskIndex].completedAt = now;
    store.tasks[taskIndex].error = error;
  }

  saveStore(store);
  return store.executions[execIndex];
}

export function getExecutions(taskId?: string): TaskExecution[] {
  const store = loadStore();
  if (taskId) {
    return store.executions.filter((e: TaskExecution) => e.taskId === taskId);
  }
  return store.executions;
}

export function getRecentExecutions(limit = 10): TaskExecution[] {
  return loadStore().executions.slice(-limit);
}

// Settings

export function getSettings(): HeadlessSettings {
  return loadStore().settings;
}

export function updateSettings(updates: Partial<HeadlessSettings>): HeadlessSettings {
  const store = loadStore();
  store.settings = { ...store.settings, ...updates };
  saveStore(store);
  return store.settings;
}

// Stats

export function getStats(): {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  scheduled: number;
} {
  const tasks = loadStore().tasks;

  return {
    total: tasks.length,
    pending: tasks.filter((t: HeadlessTask) => t.status === 'pending').length,
    running: tasks.filter((t: HeadlessTask) => t.status === 'running').length,
    completed: tasks.filter((t: HeadlessTask) => t.status === 'completed').length,
    failed: tasks.filter((t: HeadlessTask) => t.status === 'failed').length,
    scheduled: tasks.filter((t: HeadlessTask) => t.schedule).length
  };
}
