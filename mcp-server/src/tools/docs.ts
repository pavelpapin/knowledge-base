/**
 * Google Docs tools
 */

import * as docs from '../integrations/docs.js';
import { Tool, paramString, paramNumber } from './types.js';

export const docsTools: Tool[] = [
  {
    name: 'docs_get',
    description: 'Get Google Doc content by ID',
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string' } },
      required: ['documentId']
    },
    handler: async (params) => {
      const doc = await docs.getDocument(paramString(params.documentId));
      return `Title: ${doc.title}\n\n${doc.content}`;
    }
  },
  {
    name: 'docs_create',
    description: 'Create a new Google Doc',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title']
    },
    handler: async (params) => {
      const doc = await docs.createDocument(paramString(params.title));
      return `Created: ${doc.title}\nURL: ${doc.url}`;
    }
  },
  {
    name: 'docs_append',
    description: 'Append text to Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['documentId', 'text']
    },
    handler: async (params) => {
      await docs.appendText(paramString(params.documentId), paramString(params.text));
      return 'Text appended successfully';
    }
  },
  {
    name: 'docs_search',
    description: 'Search Google Docs',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number', default: 10 }
      },
      required: ['query']
    },
    handler: async (params) => {
      const results = await docs.searchDocuments(
        paramString(params.query),
        paramNumber(params.maxResults, 10)
      );
      if (!results.length) return 'No documents found';
      return results.map(r => `${r.name}\n${r.url}`).join('\n\n');
    }
  },
  {
    name: 'docs_replace',
    description: 'Replace text in Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        searchText: { type: 'string' },
        replaceText: { type: 'string' }
      },
      required: ['documentId', 'searchText', 'replaceText']
    },
    handler: async (params) => {
      const count = await docs.replaceText(
        paramString(params.documentId),
        paramString(params.searchText),
        paramString(params.replaceText)
      );
      return `Replaced ${count} occurrences`;
    }
  }
];
