/**
 * NotebookLM - Export and Analysis
 */

import * as fs from 'fs';
import { loadStore } from './store.js';
import { getNotebook } from './notebooks.js';
import type { ExportData, NotebookStats } from './types.js';

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
