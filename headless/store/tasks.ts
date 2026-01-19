/**
 * Task CRUD operations
 */

import * as crypto from 'crypto';
import { loadStore, saveStore } from './base.js';
import { HeadlessTask, TaskType } from '../types.js';

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

  store.tasks[index] = { ...store.tasks[index], ...updates };
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
