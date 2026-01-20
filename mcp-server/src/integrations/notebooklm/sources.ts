/**
 * NotebookLM - Source Management
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadStore, saveStore, generateId, SOURCES_PATH } from './store.js';
import type { NotebookSource } from './types.js';

export function addTextSource(notebookId: string, title: string, content: string): NotebookSource | null {
  const store = loadStore();
  const notebook = store.notebooks.find(n => n.id === notebookId);
  if (!notebook) return null;

  const source: NotebookSource = {
    id: generateId(),
    type: 'text',
    title,
    content,
    addedAt: new Date().toISOString()
  };

  const filePath = path.join(SOURCES_PATH, `${source.id}.txt`);
  fs.writeFileSync(filePath, content);
  source.filePath = filePath;

  notebook.sources.push(source);
  notebook.updatedAt = new Date().toISOString();
  saveStore(store);

  return source;
}

export function addUrlSource(notebookId: string, title: string, url: string): NotebookSource | null {
  const store = loadStore();
  const notebook = store.notebooks.find(n => n.id === notebookId);
  if (!notebook) return null;

  const source: NotebookSource = {
    id: generateId(),
    type: 'url',
    title,
    url,
    addedAt: new Date().toISOString()
  };

  notebook.sources.push(source);
  notebook.updatedAt = new Date().toISOString();
  saveStore(store);

  return source;
}

export function addGoogleDocSource(notebookId: string, title: string, docId: string): NotebookSource | null {
  const store = loadStore();
  const notebook = store.notebooks.find(n => n.id === notebookId);
  if (!notebook) return null;

  const source: NotebookSource = {
    id: generateId(),
    type: 'gdoc',
    title,
    url: `https://docs.google.com/document/d/${docId}`,
    addedAt: new Date().toISOString()
  };

  notebook.sources.push(source);
  notebook.updatedAt = new Date().toISOString();
  saveStore(store);

  return source;
}

export function removeSource(notebookId: string, sourceId: string): boolean {
  const store = loadStore();
  const notebook = store.notebooks.find(n => n.id === notebookId);
  if (!notebook) return false;

  const index = notebook.sources.findIndex(s => s.id === sourceId);
  if (index === -1) return false;

  const source = notebook.sources[index];
  if (source.filePath && fs.existsSync(source.filePath)) {
    fs.unlinkSync(source.filePath);
  }

  notebook.sources.splice(index, 1);
  notebook.updatedAt = new Date().toISOString();
  saveStore(store);

  return true;
}
