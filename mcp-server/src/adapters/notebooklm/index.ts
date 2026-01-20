/**
 * NotebookLM Adapter
 * Exposes NotebookLM-like research notebooks as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as notebooklm from '../../integrations/notebooklm/index.js';

const createSchema = z.object({
  name: z.string().describe('Notebook name'),
  description: z.string().optional().describe('Notebook description')
});

const listSchema = z.object({});

const addTextSchema = z.object({
  notebookId: z.string().describe('Notebook ID'),
  title: z.string().describe('Source title'),
  content: z.string().describe('Text content')
});

const addUrlSchema = z.object({
  notebookId: z.string().describe('Notebook ID'),
  title: z.string().describe('Source title'),
  url: z.string().describe('URL to fetch')
});

const analyzeSchema = z.object({
  notebookId: z.string().describe('Notebook ID')
});

const exportSchema = z.object({
  notebookId: z.string().describe('Notebook ID')
});

const tools: AdapterTool[] = [
  {
    name: 'create',
    description: 'Create a research notebook',
    type: 'write',
    schema: createSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createSchema>;
      const notebook = notebooklm.createNotebook(p.name, p.description);
      return JSON.stringify(notebook);
    }
  },
  {
    name: 'list',
    description: 'List all notebooks',
    type: 'read',
    schema: listSchema,
    execute: async () => {
      const notebooks = notebooklm.listNotebooks();
      return JSON.stringify(notebooks, null, 2);
    }
  },
  {
    name: 'add_text',
    description: 'Add text source to notebook',
    type: 'write',
    schema: addTextSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof addTextSchema>;
      const source = notebooklm.addTextSource(p.notebookId, p.title, p.content);
      return JSON.stringify(source);
    }
  },
  {
    name: 'add_url',
    description: 'Add URL source to notebook',
    type: 'write',
    schema: addUrlSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof addUrlSchema>;
      const source = await notebooklm.addUrlSource(p.notebookId, p.title, p.url);
      return JSON.stringify(source);
    }
  },
  {
    name: 'analyze',
    description: 'Generate analysis prompt from notebook sources',
    type: 'read',
    schema: analyzeSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof analyzeSchema>;
      const prompt = notebooklm.generateAnalysisPrompt(p.notebookId);
      return prompt || 'Notebook not found';
    }
  },
  {
    name: 'export',
    description: 'Export notebook sources for NotebookLM import',
    type: 'read',
    schema: exportSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof exportSchema>;
      const exported = notebooklm.exportForNotebookLM(p.notebookId);
      return JSON.stringify(exported, null, 2);
    }
  }
];

export const notebooklmAdapter: Adapter = {
  name: 'notebook',
  isAuthenticated: () => true,  // Local storage, always available
  tools
};
