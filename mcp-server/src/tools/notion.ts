/**
 * Notion tools
 */

import * as notion from '../integrations/notion.js';
import { Tool, paramString, safeJsonParse } from './types.js';

export const notionTools: Tool[] = [
  {
    name: 'notion_search',
    description: 'Search Notion pages and databases',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filter: { type: 'string', description: 'page or database' }
      },
      required: ['query']
    },
    handler: async (params) => {
      const filter = params.filter as 'page' | 'database' | undefined;
      const results = await notion.search(paramString(params.query), filter);
      if (!results.length) return 'No results';
      return results.map(r => `${r.title} - ${r.url}`).join('\n');
    }
  },
  {
    name: 'notion_databases',
    description: 'List all Notion databases',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const dbs = await notion.listDatabases();
      if (!dbs.length) return 'No databases';
      return dbs.map(d => `${d.title} (${d.id})`).join('\n');
    }
  },
  {
    name: 'notion_query',
    description: 'Query a Notion database',
    inputSchema: {
      type: 'object',
      properties: { databaseId: { type: 'string' } },
      required: ['databaseId']
    },
    handler: async (params) => {
      const pages = await notion.queryDatabase(paramString(params.databaseId));
      if (!pages.length) return 'No results';
      return pages.map(p => `${p.title} - ${p.url}`).join('\n');
    }
  },
  {
    name: 'notion_create_page',
    description: 'Create a page in Notion database',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: { type: 'string' },
        title: { type: 'string' },
        properties: { type: 'string', description: 'JSON properties' }
      },
      required: ['databaseId', 'title']
    },
    handler: async (params) => {
      const props: Record<string, unknown> = params.properties
        ? safeJsonParse<Record<string, unknown>>(paramString(params.properties), {})
        : {};
      props.Name = notion.propertyHelpers.title(paramString(params.title));
      const page = await notion.createPage(paramString(params.databaseId), props);
      return `Created: ${page.url}`;
    }
  }
];
