/**
 * GTD Store - Persistence layer
 * Uses @elio/shared for storage
 */

import * as crypto from 'crypto';
import { createStore, paths } from '@elio/shared';
import { GTDStore, Task, Project, TaskStatus, TaskContext } from './types.js';

const DEFAULT_STORE: GTDStore = {
  tasks: [],
  projects: []
};

const store = createStore<GTDStore>(paths.data.gtd, DEFAULT_STORE);

export function addTask(
  title: string,
  options: Partial<Omit<Task, 'id' | 'title' | 'createdAt' | 'updatedAt'>> = {}
): Task {
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

  store.update(current => ({
    ...current,
    tasks: [...current.tasks, task]
  }));

  return task;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
  let updatedTask: Task | null = null;

  store.update(current => {
    const index = current.tasks.findIndex(t => t.id === id);
    if (index === -1) return current;

    const task = {
      ...current.tasks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (updates.status === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
    }

    updatedTask = task;
    const tasks = [...current.tasks];
    tasks[index] = task;
    return { ...current, tasks };
  });

  return updatedTask;
}

export function getTasksByStatus(status: TaskStatus): Task[] {
  return store.load().tasks.filter(t => t.status === status);
}

export function getTasksByContext(context: TaskContext): Task[] {
  return store.load().tasks.filter(t => t.context === context && t.status === 'next');
}

export function getTasksByProject(projectId: string): Task[] {
  return store.load().tasks.filter(t => t.project === projectId);
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
  const cutoff = beforeDate || new Date().toISOString().split('T')[0];
  return store.load().tasks.filter(t =>
    t.status !== 'done' &&
    t.dueDate &&
    t.dueDate <= cutoff
  );
}

export function addProject(name: string, outcome: string, description?: string): Project {
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

  store.update(current => ({
    ...current,
    projects: [...current.projects, project]
  }));

  return project;
}

export function getActiveProjects(): Project[] {
  return store.load().projects.filter(p => p.status === 'active');
}

export function getAllTasks(): Task[] {
  return store.load().tasks;
}

export function getAllProjects(): Project[] {
  return store.load().projects;
}

export function deleteTask(id: string): boolean {
  let found = false;

  store.update(current => {
    const index = current.tasks.findIndex(t => t.id === id);
    if (index === -1) return current;
    found = true;
    const tasks = current.tasks.filter(t => t.id !== id);
    return { ...current, tasks };
  });

  return found;
}

export function getStats(): { inbox: number; next: number; waiting: number; projects: number; overdue: number } {
  const data = store.load();
  const today = new Date().toISOString().split('T')[0];

  return {
    inbox: data.tasks.filter(t => t.status === 'inbox').length,
    next: data.tasks.filter(t => t.status === 'next').length,
    waiting: data.tasks.filter(t => t.status === 'waiting').length,
    projects: data.projects.filter(p => p.status === 'active').length,
    overdue: data.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length
  };
}
