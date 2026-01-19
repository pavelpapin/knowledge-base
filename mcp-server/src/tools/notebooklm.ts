/**
 * NotebookLM tools
 */

import * as notebooklm from '../integrations/notebooklm.js';
import { Tool, paramString } from './types.js';

export const notebookTools: Tool[] = [
  {
    name: 'notebook_create',
    description: 'Create a research notebook',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['name']
    },
    handler: async (params) => {
      const desc = params.description ? paramString(params.description) : undefined;
      const nb = notebooklm.createNotebook(paramString(params.name), desc);
      return `Created notebook: ${nb.name} (${nb.id})`;
    }
  },
  {
    name: 'notebook_list',
    description: 'List all notebooks',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const notebooks = notebooklm.listNotebooks();
      if (!notebooks.length) return 'No notebooks';
      return notebooks
        .map(n => `${n.name} (${n.id}) - ${n.sources.length} sources`)
        .join('\n');
    }
  },
  {
    name: 'notebook_add_text',
    description: 'Add text source to notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['notebookId', 'title', 'content']
    },
    handler: async (params) => {
      const source = notebooklm.addTextSource(
        paramString(params.notebookId),
        paramString(params.title),
        paramString(params.content)
      );
      return source ? `Added source: ${source.title}` : 'Notebook not found';
    }
  },
  {
    name: 'notebook_add_url',
    description: 'Add URL source to notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string' },
        title: { type: 'string' },
        url: { type: 'string' }
      },
      required: ['notebookId', 'title', 'url']
    },
    handler: async (params) => {
      const source = notebooklm.addUrlSource(
        paramString(params.notebookId),
        paramString(params.title),
        paramString(params.url)
      );
      return source ? `Added URL source: ${source.title}` : 'Notebook not found';
    }
  },
  {
    name: 'notebook_analyze',
    description: 'Generate analysis prompt from notebook sources',
    inputSchema: {
      type: 'object',
      properties: { notebookId: { type: 'string' } },
      required: ['notebookId']
    },
    handler: async (params) => {
      const prompt = notebooklm.generateAnalysisPrompt(paramString(params.notebookId));
      return prompt || 'Notebook not found';
    }
  },
  {
    name: 'notebook_export',
    description: 'Export notebook sources for NotebookLM import',
    inputSchema: {
      type: 'object',
      properties: { notebookId: { type: 'string' } },
      required: ['notebookId']
    },
    handler: async (params) => {
      const data = notebooklm.exportForNotebookLM(paramString(params.notebookId));
      return JSON.stringify(data, null, 2);
    }
  }
];
