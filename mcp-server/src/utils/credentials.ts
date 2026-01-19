/**
 * Shared credential loading utilities
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';

const SECRETS_DIR = process.env.SECRETS_DIR || '/root/.claude/secrets';

export interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}

export interface TelegramCredentials {
  bot_token: string;
  default_chat_id?: string;
}

export interface SlackCredentials {
  bot_token: string;
  default_channel?: string;
}

export interface NotionCredentials {
  api_key: string;
}

export interface PerplexityCredentials {
  api_key: string;
}

export interface LinkedInCredentials {
  proxycurl_key?: string;
  rapidapi_key?: string;
}

export interface N8nCredentials {
  base_url: string;
  api_key?: string;
}

/**
 * Load credentials from a JSON file synchronously (for init)
 */
export function loadCredentialsSync<T>(filename: string): T | null {
  const path = `${SECRETS_DIR}/${filename}`;
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = require('fs').readFileSync(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Load credentials from a JSON file asynchronously
 */
export async function loadCredentials<T>(filename: string): Promise<T | null> {
  const path = `${SECRETS_DIR}/${filename}`;
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Check if credentials file exists
 */
export function credentialsExist(filename: string): boolean {
  return existsSync(`${SECRETS_DIR}/${filename}`);
}

/**
 * Get Google token
 */
export function getGoogleToken(): GoogleToken | null {
  return loadCredentialsSync<GoogleToken>('google-token.json');
}

/**
 * Check if Google is authenticated
 */
export function isGoogleAuthenticated(): boolean {
  return credentialsExist('google-token.json');
}

/**
 * Get Telegram credentials
 */
export function getTelegramCredentials(): TelegramCredentials | null {
  return loadCredentialsSync<TelegramCredentials>('telegram.json');
}

/**
 * Get Slack credentials
 */
export function getSlackCredentials(): SlackCredentials | null {
  return loadCredentialsSync<SlackCredentials>('slack.json');
}

/**
 * Get Notion credentials
 */
export function getNotionCredentials(): NotionCredentials | null {
  return loadCredentialsSync<NotionCredentials>('notion.json');
}

/**
 * Get Perplexity credentials
 */
export function getPerplexityCredentials(): PerplexityCredentials | null {
  return loadCredentialsSync<PerplexityCredentials>('perplexity.json');
}

/**
 * Get LinkedIn credentials
 */
export function getLinkedInCredentials(): LinkedInCredentials | null {
  return loadCredentialsSync<LinkedInCredentials>('linkedin.json');
}

/**
 * Get n8n credentials
 */
export function getN8nCredentials(): N8nCredentials | null {
  return loadCredentialsSync<N8nCredentials>('n8n.json');
}
