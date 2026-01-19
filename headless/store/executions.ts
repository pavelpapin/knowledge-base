/**
 * Execution tracking
 */

import * as crypto from 'crypto';
import { loadStore, saveStore } from './base.js';
import { HeadlessTask, TaskExecution, TaskStatus } from '../types.js';

export function startExecution(taskId: string): TaskExecution {
  const store = loadStore();
  const now = new Date().toISOString();

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
