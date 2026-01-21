/**
 * Notion API Utilities
 */

import { httpRequest } from '../../utils/http.js';
import { loadCredentialsSync, NotionCredentials } from '../../utils/credentials.js';

const CREDENTIALS_FILE = 'notion.json';
const NOTION_VERSION = '2022-06-28';

export function loadCredentials(): NotionCredentials | null {
  return loadCredentialsSync<NotionCredentials>(CREDENTIALS_FILE);
}

export async function notionRequest<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Notion not authenticated. Add api_key to /root/.claude/secrets/notion.json');
  }

  return httpRequest<T>({
    hostname: 'api.notion.com',
    path: `/v1${endpoint}`,
    method,
    headers: {
      'Authorization': `Bearer ${credentials.api_key}`,
      'Notion-Version': NOTION_VERSION
    },
    body
  });
}

export function extractTitle(properties: Record<string, unknown>): string {
  for (const [, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    if (prop.type === 'title' && Array.isArray(prop.title)) {
      return prop.title.map((t: { plain_text: string }) => t.plain_text).join('');
    }
  }
  return '(untitled)';
}

export function extractPlainText(richText: Array<{ plain_text: string }>): string {
  return richText.map(t => t.plain_text).join('');
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
