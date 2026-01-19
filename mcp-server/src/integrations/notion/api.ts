/**
 * Notion API Utilities
 */

import * as fs from 'fs';
import * as https from 'https';
import type { NotionCredentials } from './types.js';

const CREDENTIALS_PATH = '/root/.claude/secrets/notion-token.json';
const NOTION_VERSION = '2022-06-28';

export function loadCredentials(): NotionCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

export async function notionRequest(
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
