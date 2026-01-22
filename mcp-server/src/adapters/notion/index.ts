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
  properties: z.string().optional().describe('JSON properties'),
  skipDuplicateCheck: z.boolean().optional().describe('Skip duplicate check (default: false)')
});

const deletePageSchema = z.object({
  pageId: z.string().describe('Page ID to archive/delete')
});

const findDuplicatesSchema = z.object({
  databaseId: z.string().describe('Database ID'),
  titlePattern: z.string().optional().describe('Title pattern to search for duplicates')
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
    description: 'Create a page in Notion database (with duplicate check)',
    type: 'write',
    schema: createPageSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createPageSchema>;

      // Deduplication check unless explicitly skipped
      if (!p.skipDuplicateCheck) {
        const existing = await notion.queryDatabase(p.databaseId);
        const duplicate = existing.find(page =>
          page.title.toLowerCase().trim() === p.title.toLowerCase().trim()
        );
        if (duplicate) {
          return JSON.stringify({
            error: 'DUPLICATE_EXISTS',
            message: `Page with title "${p.title}" already exists`,
            existing: {
              id: duplicate.id,
              url: duplicate.url,
              createdTime: duplicate.createdTime
            }
          });
        }
      }

      const props = p.properties ? JSON.parse(p.properties) : {};
      // Use propertyHelpers to set title
      const properties = { ...props, ...notion.propertyHelpers.title(p.title) };
      const result = await notion.createPage(p.databaseId, properties);
      return JSON.stringify(result);
    }
  },
  {
    name: 'delete_page',
    description: 'Archive (delete) a Notion page',
    type: 'write',
    schema: deletePageSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof deletePageSchema>;
      const result = await notion.updatePage(p.pageId, { archived: true } as unknown as Record<string, unknown>);
      return JSON.stringify({ success: true, archived: p.pageId, result });
    }
  },
  {
    name: 'find_duplicates',
    description: 'Find duplicate pages in a database by title',
    type: 'read',
    schema: findDuplicatesSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof findDuplicatesSchema>;
      const pages = await notion.queryDatabase(p.databaseId);

      // Group by title (normalized)
      const titleGroups: Record<string, typeof pages> = {};
      for (const page of pages) {
        const normalizedTitle = page.title.toLowerCase().trim();
        if (p.titlePattern && !normalizedTitle.includes(p.titlePattern.toLowerCase())) {
          continue;
        }
        if (!titleGroups[normalizedTitle]) {
          titleGroups[normalizedTitle] = [];
        }
        titleGroups[normalizedTitle].push(page);
      }

      // Find duplicates (more than 1 page with same title)
      const duplicates = Object.entries(titleGroups)
        .filter(([, group]) => group.length > 1)
        .map(([title, group]) => ({
          title,
          count: group.length,
          pages: group.map(p => ({
            id: p.id,
            url: p.url,
            createdTime: p.createdTime
          }))
        }));

      return JSON.stringify({
        totalPages: pages.length,
        duplicateGroups: duplicates.length,
        duplicates
      }, null, 2);
    }
  }
];

export const notionAdapter: Adapter = {
  name: 'notion',
  isAuthenticated: notion.isAuthenticated,
  tools
};
