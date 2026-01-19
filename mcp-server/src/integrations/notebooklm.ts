/**
 * NotebookLM Integration
 * Interact with Google NotebookLM for research and summarization
 *
 * Note: NotebookLM doesn't have a public API yet.
 * This integration uses web automation / unofficial methods.
 * For now, we provide utilities to prepare content for NotebookLM
 * and parse its outputs.
 */

import * as fs from 'fs';
import * as path from 'path';

const NOTEBOOKS_PATH = '/root/.claude/notebooklm/notebooks';
const SOURCES_PATH = '/root/.claude/notebooklm/sources';

interface NotebookSource {
  id: string;
  type: 'text' | 'url' | 'pdf' | 'gdoc';
  title: string;
  content?: string;
  url?: string;
  filePath?: string;
  addedAt: string;
}

interface Notebook {
  id: string;
  name: string;
  description?: string;
  sources: NotebookSource[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

interface NotebooksStore {
  notebooks: Notebook[];
}

function ensureDirs(): void {
  fs.mkdirSync(NOTEBOOKS_PATH, { recursive: true });
  fs.mkdirSync(SOURCES_PATH, { recursive: true });
}

function loadStore(): NotebooksStore {
  ensureDirs();
  const storePath = path.join(NOTEBOOKS_PATH, 'store.json');
  if (fs.existsSync(storePath)) {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  }
  return { notebooks: [] };
}

function saveStore(store: NotebooksStore): void {
  ensureDirs();
  const storePath = path.join(NOTEBOOKS_PATH, 'store.json');
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

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

export function addTextSource(
  notebookId: string,
  title: string,
  content: string
): NotebookSource | null {
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

  // Save content to file
  const filePath = path.join(SOURCES_PATH, `${source.id}.txt`);
  fs.writeFileSync(filePath, content);
  source.filePath = filePath;

  notebook.sources.push(source);
  notebook.updatedAt = new Date().toISOString();
  saveStore(store);

  return source;
}

export function addUrlSource(
  notebookId: string,
  title: string,
  url: string
): NotebookSource | null {
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

export function addGoogleDocSource(
  notebookId: string,
  title: string,
  docId: string
): NotebookSource | null {
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

export function exportForNotebookLM(notebookId: string): {
  urls: string[];
  texts: Array<{ title: string; content: string }>;
  googleDocs: string[];
} {
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

export function getStats(): {
  totalNotebooks: number;
  totalSources: number;
  totalNotes: number;
} {
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

export function isConfigured(): boolean {
  ensureDirs();
  return true;
}

export function getInstructions(): string {
  return `
NotebookLM Integration:

This is a local notebook management system that mimics NotebookLM functionality.
It helps organize sources and generate prompts for AI analysis.

Note: Google NotebookLM doesn't have a public API yet.
This integration provides:
- Local notebook/source management
- Export functionality for manual import to NotebookLM
- Prompt generation for similar AI analysis

Usage:
1. Create notebooks to organize research
2. Add sources (text, URLs, Google Docs)
3. Add notes as you research
4. Export sources for NotebookLM import
5. Generate analysis prompts for Claude

Data is stored at: /root/.claude/notebooklm/
`;
}
