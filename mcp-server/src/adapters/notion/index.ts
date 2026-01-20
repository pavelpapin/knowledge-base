/**
 * Notion Adapter
 * Exposes Notion API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as notion from '../../integrations/notion/index.js';

const searchSchema = z.object({
  query: z.string().describe('Search query'),
  filter: z.enum(['page', 'database']).optional().describe('Filter by type')
});

const databasesSchema = z.object({});

const querySchema = z.object({
  databaseId: z.string().describe('Database ID')
});

const createPageSchema = z.object({
  databaseId: z.string().describe('Database ID'),
  title: z.string().describe('Page title'),
  properties: z.string().optional().describe('JSON properties')
});

const tools: AdapterTool[] = [
  {
    name: 'search',
    description: 'Search Notion pages and databases',
    type: 'read',
    schema: searchSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof searchSchema>;
      const results = await notion.search(p.query, p.filter as 'page' | 'database' | undefined);
      return JSON.stringify(results, null, 2);
    }
  },
  {
    name: 'databases',
    description: 'List all Notion databases',
    type: 'read',
    schema: databasesSchema,
    execute: async () => {
      const dbs = await notion.listDatabases();
      return JSON.stringify(dbs, null, 2);
    }
  },
  {
    name: 'query',
    description: 'Query a Notion database',
    type: 'read',
    schema: querySchema,
    execute: async (params) => {
      const p = params as z.infer<typeof querySchema>;
      const results = await notion.queryDatabase(p.databaseId);
      return JSON.stringify(results, null, 2);
    }
  },
  {
    name: 'create_page',
    description: 'Create a page in Notion database',
    type: 'write',
    schema: createPageSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createPageSchema>;
      const props = p.properties ? JSON.parse(p.properties) : {};
      // Use propertyHelpers to set title
      const properties = { ...props, ...notion.propertyHelpers.title(p.title) };
      const result = await notion.createPage(p.databaseId, properties);
      return JSON.stringify(result);
    }
  }
];

export const notionAdapter: Adapter = {
  name: 'notion',
  isAuthenticated: notion.isAuthenticated,
  tools
};
