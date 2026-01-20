/**
 * NotebookLM - Notebook Management
 */

import { loadStore, saveStore, generateId } from './store.js';
import type { Notebook } from './types.js';

export function createNotebook(name: string, description?: string): Notebook {
  const store = loadStore();
  const now = new Date().toISOString();

  const notebook: Notebook = {
    id: generateId(),
    name,
    description,
    sources: [],
    notes: [],
    createdAt: now,
    updatedAt: now
  };

  store.notebooks.push(notebook);
  saveStore(store);
  return notebook;
}

export function getNotebook(notebookId: string): Notebook | null {
  const store = loadStore();
  return store.notebooks.find(n => n.id === notebookId) || null;
}

export function listNotebooks(): Notebook[] {
  return loadStore().notebooks;
}

export function deleteNotebook(notebookId: string): boolean {
  const store = loadStore();
  const index = store.notebooks.findIndex(n => n.id === notebookId);
  if (index === -1) return false;

  store.notebooks.splice(index, 1);
  saveStore(store);
  return true;
}

export function addNote(notebookId: string, note: string): boolean {
  const store = loadStore();
  const notebook = store.notebooks.find(n => n.id === notebookId);
  if (!notebook) return false;

  notebook.notes.push(note);
  notebook.updatedAt = new Date().toISOString();
  saveStore(store);
  return true;
}

export function getNotes(notebookId: string): string[] {
  const notebook = getNotebook(notebookId);
  return notebook?.notes || [];
}
