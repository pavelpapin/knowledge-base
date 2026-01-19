/**
 * Notion Integration
 * Read/write databases, pages, and blocks
 */

import { notionRequest, extractTitle, extractPlainText, isAuthenticated, propertyHelpers } from './api.js';
import type {
  NotionPage,
  NotionDatabase,
  NotionBlock,
  BlockType,
  NotionDatabaseResponse,
  NotionPageResponse,
  NotionSearchResponse,
  NotionBlocksResponse
} from './types.js';

export type { NotionPage, NotionDatabase, NotionBlock, BlockType } from './types.js';
export { isAuthenticated, propertyHelpers } from './api.js';

// Database operations

export async function listDatabases(): Promise<NotionDatabase[]> {
  const response = await notionRequest('/search', 'POST', {
    filter: { property: 'object', value: 'database' },
    page_size: 100
  }) as { results: NotionDatabaseResponse[] };

  return response.results.map(db => ({
    id: db.id,
    title: db.title?.map(t => t.plain_text).join('') || '(untitled)',
    url: db.url,
    properties: db.properties
  }));
}

export async function queryDatabase(
  databaseId: string,
  filter?: Record<string, unknown>,
  sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
): Promise<NotionPage[]> {
  const body: Record<string, unknown> = { page_size: 100 };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;

  const response = await notionRequest(
    `/databases/${databaseId}/query`,
    'POST',
    body
  ) as { results: NotionPageResponse[] };

  return response.results.map(page => ({
    id: page.id,
    title: extractTitle(page.properties),
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: page.properties
  }));
}

export async function getDatabase(databaseId: string): Promise<NotionDatabase> {
  const db = await notionRequest(`/databases/${databaseId}`) as NotionDatabaseResponse;

  return {
    id: db.id,
    title: db.title?.map(t => t.plain_text).join('') || '(untitled)',
    url: db.url,
    properties: db.properties
  };
}

// Page operations

export async function getPage(pageId: string): Promise<NotionPage> {
  const page = await notionRequest(`/pages/${pageId}`) as NotionPageResponse;

  return {
    id: page.id,
    title: extractTitle(page.properties),
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: page.properties
  };
}

export async function createPage(
  databaseId: string,
  properties: Record<string, unknown>
): Promise<NotionPage> {
  const page = await notionRequest('/pages', 'POST', {
    parent: { database_id: databaseId },
    properties
  }) as NotionPageResponse;

  return {
    id: page.id,
    title: extractTitle(page.properties),
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: page.properties
  };
}

export async function updatePage(
  pageId: string,
  properties: Record<string, unknown>
): Promise<NotionPage> {
  const page = await notionRequest(`/pages/${pageId}`, 'PATCH', {
    properties
  }) as NotionPageResponse;

  return {
    id: page.id,
    title: extractTitle(page.properties),
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    properties: page.properties
  };
}

// Block operations

export async function getBlocks(pageId: string): Promise<NotionBlock[]> {
  const response = await notionRequest(`/blocks/${pageId}/children`) as NotionBlocksResponse;

  return response.results.map(block => {
    const blockContent = block[block.type] as { rich_text?: Array<{ plain_text: string }> };
    let content = '';

    if (blockContent?.rich_text) {
      content = extractPlainText(blockContent.rich_text);
    }

    return {
      id: block.id,
      type: block.type,
      content
    };
  });
}

export async function appendBlock(
  pageId: string,
  content: string,
  type: BlockType = 'paragraph'
): Promise<NotionBlock> {
  const block: Record<string, unknown> = {
    object: 'block',
    type,
    [type]: {
      rich_text: [{ type: 'text', text: { content } }]
    }
  };

  if (type === 'to_do') {
    (block[type] as Record<string, unknown>).checked = false;
  }

  const response = await notionRequest(`/blocks/${pageId}/children`, 'PATCH', {
    children: [block]
  }) as { results: Array<{ id: string; type: string }> };

  return {
    id: response.results[0].id,
    type: response.results[0].type,
    content
  };
}

// Search

export async function search(query: string, filter?: 'page' | 'database'): Promise<Array<NotionPage | NotionDatabase>> {
  const body: Record<string, unknown> = {
    query,
    page_size: 20
  };

  if (filter) {
    body.filter = { property: 'object', value: filter };
  }

  const response = await notionRequest('/search', 'POST', body) as NotionSearchResponse;

  return response.results.map(item => {
    if (item.object === 'database') {
      return {
        id: item.id,
        title: item.title?.map(t => t.plain_text).join('') || '(untitled)',
        url: item.url,
        properties: item.properties || {}
      } as NotionDatabase;
    } else {
      return {
        id: item.id,
        title: extractTitle(item.properties || {}),
        url: item.url,
        createdTime: item.created_time || '',
        lastEditedTime: item.last_edited_time || '',
        properties: item.properties || {}
      } as NotionPage;
    }
  });
}
