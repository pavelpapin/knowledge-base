/**
 * Google Docs Adapter
 * Exposes Docs API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as docs from '../../integrations/docs.js';

const getSchema = z.object({
  documentId: z.string().describe('Document ID')
});

const createSchema = z.object({
  title: z.string().describe('Document title')
});

const appendSchema = z.object({
  documentId: z.string().describe('Document ID'),
  text: z.string().describe('Text to append')
});

const searchSchema = z.object({
  query: z.string().describe('Search query'),
  maxResults: z.number().optional().default(10).describe('Maximum results')
});

const replaceSchema = z.object({
  documentId: z.string().describe('Document ID'),
  searchText: z.string().describe('Text to find'),
  replaceText: z.string().describe('Replacement text')
});

const tools: AdapterTool[] = [
  {
    name: 'get',
    description: 'Get Google Doc content by ID',
    type: 'read',
    schema: getSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof getSchema>;
      const content = await docs.getDocument(p.documentId);
      return content || 'Document not found';
    }
  },
  {
    name: 'create',
    description: 'Create a new Google Doc',
    type: 'write',
    schema: createSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createSchema>;
      const result = await docs.createDocument(p.title);
      return JSON.stringify(result);
    }
  },
  {
    name: 'append',
    description: 'Append text to Google Doc',
    type: 'write',
    schema: appendSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof appendSchema>;
      const result = await docs.appendText(p.documentId, p.text);
      return JSON.stringify(result);
    }
  },
  {
    name: 'search',
    description: 'Search Google Docs',
    type: 'read',
    schema: searchSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof searchSchema>;
      const results = await docs.searchDocuments(p.query, p.maxResults);
      return JSON.stringify(results, null, 2);
    }
  },
  {
    name: 'replace',
    description: 'Replace text in Google Doc',
    type: 'write',
    schema: replaceSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof replaceSchema>;
      const result = await docs.replaceText(p.documentId, p.searchText, p.replaceText);
      return JSON.stringify(result);
    }
  }
];

export const docsAdapter: Adapter = {
  name: 'docs',
  isAuthenticated: docs.isAuthenticated,
  tools
};
