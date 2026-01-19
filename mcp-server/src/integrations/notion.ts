/**
 * Notion Integration
 * Read/write databases, pages, and blocks
 */

import * as fs from 'fs';
import * as https from 'https';

const CREDENTIALS_PATH = '/root/.claude/secrets/notion-token.json';
const NOTION_VERSION = '2022-06-28';

interface NotionCredentials {
  api_key: string;
}

interface NotionPage {
  id: string;
  title: string;
  url: string;
  createdTime: string;
  lastEditedTime: string;
  properties: Record<string, unknown>;
}

interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, { type: string; name: string }>;
}

interface NotionBlock {
  id: string;
  type: string;
  content: string;
}

function loadCredentials(): NotionCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

async function notionRequest(
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Notion not authenticated. Add api_key to /root/.claude/secrets/notion-token.json');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.notion.com',
      path: `/v1${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${credentials.api_key}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.object === 'error') {
            reject(new Error(json.message));
          } else {
            resolve(json);
          }
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function extractTitle(properties: Record<string, unknown>): string {
  for (const [, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    if (prop.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t: { plain_text: string }) => t.plain_text).join('');
    }
  }
  return '(untitled)';
}

function extractPlainText(richText: Array<{ plain_text: string }>): string {
  return richText.map(t => t.plain_text).join('');
}

// Database operations

export async function listDatabases(): Promise<NotionDatabase[]> {
  const response = await notionRequest('/search', 'POST', {
    filter: { property: 'object', value: 'database' },
    page_size: 100
  }) as { results: Array<{
    id: string;
    url: string;
    title: Array<{ plain_text: string }>;
    properties: Record<string, { type: string; name: string }>;
  }> };

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
  ) as { results: Array<{
    id: string;
    url: string;
    created_time: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  }> };

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
  const db = await notionRequest(`/databases/${databaseId}`) as {
    id: string;
    url: string;
    title: Array<{ plain_text: string }>;
    properties: Record<string, { type: string; name: string }>;
  };

  return {
    id: db.id,
    title: db.title?.map(t => t.plain_text).join('') || '(untitled)',
    url: db.url,
    properties: db.properties
  };
}

// Page operations

export async function getPage(pageId: string): Promise<NotionPage> {
  const page = await notionRequest(`/pages/${pageId}`) as {
    id: string;
    url: string;
    created_time: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  };

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
  }) as {
    id: string;
    url: string;
    created_time: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  };

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
  }) as {
    id: string;
    url: string;
    created_time: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  };

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
  const response = await notionRequest(`/blocks/${pageId}/children`) as {
    results: Array<{
      id: string;
      type: string;
      [key: string]: unknown;
    }>;
  };

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
  type: 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3' | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' = 'paragraph'
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

  const response = await notionRequest('/search', 'POST', body) as {
    results: Array<{
      object: string;
      id: string;
      url: string;
      created_time?: string;
      last_edited_time?: string;
      title?: Array<{ plain_text: string }>;
      properties?: Record<string, unknown>;
    }>;
  };

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

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

// Helper to create property values
export const propertyHelpers = {
  title: (text: string) => ({
    title: [{ text: { content: text } }]
  }),
  richText: (text: string) => ({
    rich_text: [{ text: { content: text } }]
  }),
  number: (num: number) => ({ number: num }),
  select: (name: string) => ({ select: { name } }),
  multiSelect: (names: string[]) => ({
    multi_select: names.map(name => ({ name }))
  }),
  date: (start: string, end?: string) => ({
    date: { start, end }
  }),
  checkbox: (checked: boolean) => ({ checkbox: checked }),
  url: (url: string) => ({ url }),
  email: (email: string) => ({ email }),
  phone: (phone: string) => ({ phone_number: phone })
};
