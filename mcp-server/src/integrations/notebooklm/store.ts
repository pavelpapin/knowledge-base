/**
 * NotebookLM Store Utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { paths } from '@elio/shared';
import type { NotebooksStore } from './types.js';

const NOTEBOOKS_PATH = path.join(paths.base, 'notebooklm/notebooks');
const SOURCES_PATH = paths.data.notebooklmSources;

export { NOTEBOOKS_PATH, SOURCES_PATH };

export function ensureDirs(): void {
  fs.mkdirSync(NOTEBOOKS_PATH, { recursive: true });
  fs.mkdirSync(SOURCES_PATH, { recursive: true });
}

export function loadStore(): NotebooksStore {
  ensureDirs();
  const storePath = path.join(NOTEBOOKS_PATH, 'store.json');
  if (fs.existsSync(storePath)) {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  }
  return { notebooks: [] };
}

export function saveStore(store: NotebooksStore): void {
  ensureDirs();
  const storePath = path.join(NOTEBOOKS_PATH, 'store.json');
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
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

Data is stored at: ${paths.base}/notebooklm/
`;
}
