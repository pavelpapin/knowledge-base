/**
 * NotebookLM Integration
 * Interact with Google NotebookLM for research and summarization
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadStore, saveStore, generateId, SOURCES_PATH, isConfigured, getInstructions } from './store.js';
import type { Notebook, NotebookSource, ExportData, NotebookStats } from './types.js';

export type { Notebook, NotebookSource, ExportData, NotebookStats } from './types.js';
export { isConfigured, getInstructions } from './store.js';

// Notebook management

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

// Source management

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

// Notes management

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

// Export for NotebookLM import

export function exportForNotebookLM(notebookId: string): ExportData {
  const notebook = getNotebook(notebookId);
  if (!notebook) {
    return { urls: [], texts: [], googleDocs: [] };
  }

  const urls: string[] = [];
  const texts: Array<{ title: string; content: string }> = [];
  const googleDocs: string[] = [];

  for (const source of notebook.sources) {
    switch (source.type) {
      case 'url':
        if (source.url) urls.push(source.url);
        break;
      case 'text':
        if (source.content || source.filePath) {
          const content = source.content ||
            (source.filePath && fs.existsSync(source.filePath)
              ? fs.readFileSync(source.filePath, 'utf-8')
              : '');
          texts.push({ title: source.title, content });
        }
        break;
      case 'gdoc':
        if (source.url) googleDocs.push(source.url);
        break;
    }
  }

  return { urls, texts, googleDocs };
}

// Generate prompt for NotebookLM-style analysis

export function generateAnalysisPrompt(notebookId: string): string {
  const notebook = getNotebook(notebookId);
  if (!notebook) return '';

  const exportData = exportForNotebookLM(notebookId);
  let prompt = `Analyze the following sources for the notebook "${notebook.name}":\n\n`;

  if (notebook.description) {
    prompt += `Context: ${notebook.description}\n\n`;
  }

  if (exportData.texts.length > 0) {
    prompt += '## Text Sources\n\n';
    for (const text of exportData.texts) {
      prompt += `### ${text.title}\n${text.content}\n\n`;
    }
  }

  if (exportData.urls.length > 0) {
    prompt += '## URLs to analyze\n';
    prompt += exportData.urls.map(u => `- ${u}`).join('\n');
    prompt += '\n\n';
  }

  if (exportData.googleDocs.length > 0) {
    prompt += '## Google Docs\n';
    prompt += exportData.googleDocs.map(u => `- ${u}`).join('\n');
    prompt += '\n\n';
  }

  if (notebook.notes.length > 0) {
    prompt += '## Notes\n';
    prompt += notebook.notes.map((n, i) => `${i + 1}. ${n}`).join('\n');
    prompt += '\n\n';
  }

  prompt += `
Please provide:
1. A comprehensive summary of all sources
2. Key themes and connections between sources
3. Important facts and insights
4. Questions that could be explored further
5. A suggested outline for a document based on these sources
`;

  return prompt;
}

// Stats

export function getStats(): NotebookStats {
  const store = loadStore();
  let totalSources = 0;
  let totalNotes = 0;

  for (const notebook of store.notebooks) {
    totalSources += notebook.sources.length;
    totalNotes += notebook.notes.length;
  }

  return {
    totalNotebooks: store.notebooks.length,
    totalSources,
    totalNotes
  };
}
