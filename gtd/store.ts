/**
 * GTD Store - Persistence layer
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { GTDStore, Task, Project, TaskStatus, TaskPriority, TaskContext } from './types.js';

const STORE_PATH = '/root/.claude/gtd/store.json';

function loadStore(): GTDStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return { tasks: [], projects: [] };
}

function saveStore(store: GTDStore): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function addTask(
  title: string,
  options: Partial<Omit<Task, 'id' | 'title' | 'createdAt' | 'updatedAt'>> = {}
): Task {
  const store = loadStore();
  const now = new Date().toISOString();

  const task: Task = {
    id: crypto.randomUUID(),
    title,
    status: options.status || 'inbox',
    priority: options.priority || 'medium',
    tags: options.tags || [],
    createdAt: now,
    updatedAt: now,
    ...options
  };

  store.tasks.push(task);
  saveStore(store);
  return task;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  const store = loadStore();
  const index = store.tasks.findIndex(t => t.id === id);

  if (index === -1) return null;

  store.tasks[index] = {
    ...store.tasks[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (updates.status === 'done' && !store.tasks[index].completedAt) {
    store.tasks[index].completedAt = new Date().toISOString();
  }

  saveStore(store);
  return store.tasks[index];
}

export function getTasksByStatus(status: TaskStatus): Task[] {
  return loadStore().tasks.filter(t => t.status === status);
}

export function getTasksByContext(context: TaskContext): Task[] {
  return loadStore().tasks.filter(t => t.context === context && t.status === 'next');
}

export function getTasksByProject(projectId: string): Task[] {
  return loadStore().tasks.filter(t => t.project === projectId);
}

export function getInbox(): Task[] {
  return getTasksByStatus('inbox');
}

export function getNextActions(): Task[] {
  return getTasksByStatus('next');
}

export function getWaiting(): Task[] {
  return getTasksByStatus('waiting');
}

export function getDueTasks(beforeDate?: string): Task[] {
  const store = loadStore();
  const cutoff = beforeDate || new Date().toISOString().split('T')[0];

  return store.tasks.filter(t =>
    t.status !== 'done' &&
    t.dueDate &&
    t.dueDate <= cutoff
  );
}

export function addProject(name: string, outcome: string, description?: string): Project {
  const store = loadStore();
  const now = new Date().toISOString();

  const project: Project = {
    id: crypto.randomUUID(),
    name,
    outcome,
    description,
    status: 'active',
    tasks: [],
    createdAt: now,
    updatedAt: now
  };

  store.projects.push(project);
  saveStore(store);
  return project;
}

export function getActiveProjects(): Project[] {
  return loadStore().projects.filter(p => p.status === 'active');
}

export function getAllTasks(): Task[] {
  return loadStore().tasks;
}

export function getAllProjects(): Project[] {
  return loadStore().projects;
}

export function deleteTask(id: string): boolean {
  const store = loadStore();
  const index = store.tasks.findIndex(t => t.id === id);
  if (index === -1) return false;
  store.tasks.splice(index, 1);
  saveStore(store);
  return true;
}

export function getStats(): { inbox: number; next: number; waiting: number; projects: number; overdue: number } {
  const store = loadStore();
  const today = new Date().toISOString().split('T')[0];

  return {
    inbox: store.tasks.filter(t => t.status === 'inbox').length,
    next: store.tasks.filter(t => t.status === 'next').length,
    waiting: store.tasks.filter(t => t.status === 'waiting').length,
    projects: store.projects.filter(p => p.status === 'active').length,
    overdue: store.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length
  };
}
