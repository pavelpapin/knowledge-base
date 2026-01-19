/**
 * Gmail Integration
 * Read, search, and send emails via Gmail API
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { httpRequest, HttpError } from '../utils/http.js';
import { getGoogleToken, loadCredentialsSync, GoogleToken } from '../utils/credentials.js';

const CREDENTIALS_PATH = '/root/.claude/secrets/google-credentials.json';
const TOKEN_PATH = '/root/.claude/secrets/google-token.json';

interface GoogleCredentials {
  installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
  web?: { client_id: string; client_secret: string; redirect_uris: string[] };
}

interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body?: string;
  labels: string[];
}

function loadCredentials(): GoogleCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

function saveToken(token: GoogleToken): void {
  mkdirSync('/root/.claude/secrets', { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function refreshAccessToken(): Promise<string | null> {
  const credentials = loadCredentials();
  const token = getGoogleToken();
  if (!credentials || !token) return null;

  const config = credentials.installed || credentials.web;
  if (!config) return null;

  try {
    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    });

    const response = await httpRequest<{ access_token?: string; expires_in?: number }>({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (response.access_token) {
      saveToken({
        ...token,
        access_token: response.access_token,
        expiry_date: Date.now() + ((response.expires_in || 3600) * 1000)
      });
      return response.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  const token = getGoogleToken();
  if (!token) return null;

  if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
    return refreshAccessToken();
  }
  return token.access_token;
}

async function gmailRequest<T>(endpoint: string, method = 'GET', body?: unknown): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new HttpError('Not authenticated. Run gmail-auth to authenticate.');
  }

  return httpRequest<T>({
    hostname: 'gmail.googleapis.com',
    path: `/gmail/v1/users/me${endpoint}`,
    method: method as 'GET' | 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body
  });
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function parseEmailHeaders(headers: Array<{ name: string; value: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers) {
    result[h.name.toLowerCase()] = h.value;
  }
  return result;
}

interface GmailListResponse {
  messages?: Array<{ id: string }>;
}

interface GmailMessageDetail {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
  };
}

export async function listEmails(query = '', maxResults = 10): Promise<EmailMessage[]> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set('q', query);

  const response = await gmailRequest<GmailListResponse>(`/messages?${params}`);
  if (!response.messages) return [];

  const messages: EmailMessage[] = [];
  for (const msg of response.messages.slice(0, maxResults)) {
    const detail = await gmailRequest<GmailMessageDetail>(`/messages/${msg.id}`);
    const headers = parseEmailHeaders(detail.payload.headers);

    messages.push({
      id: detail.id,
      threadId: detail.threadId,
      from: headers['from'] || '',
      to: headers['to'] || '',
      subject: headers['subject'] || '(no subject)',
      date: headers['date'] || '',
      snippet: detail.snippet,
      labels: detail.labelIds || []
    });
  }

  return messages;
}

export async function getEmail(messageId: string): Promise<EmailMessage | null> {
  const detail = await gmailRequest<GmailMessageDetail>(`/messages/${messageId}?format=full`);
  if (!detail.id) return null;

  const headers = parseEmailHeaders(detail.payload.headers);

  let body = '';
  if (detail.payload.body?.data) {
    body = decodeBase64Url(detail.payload.body.data);
  } else if (detail.payload.parts) {
    const textPart = detail.payload.parts.find(p => p.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = decodeBase64Url(textPart.body.data);
    }
  }

  return {
    id: detail.id,
    threadId: detail.threadId,
    from: headers['from'] || '',
    to: headers['to'] || '',
    subject: headers['subject'] || '(no subject)',
    date: headers['date'] || '',
    snippet: detail.snippet,
    body,
    labels: detail.labelIds || []
  };
}

interface SendResponse {
  id?: string;
  error?: { message: string };
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ].join('\r\n');

  const encodedEmail = Buffer.from(email).toString('base64url');

  try {
    const response = await gmailRequest<SendResponse>('/messages/send', 'POST', { raw: encodedEmail });
    if (response.id) {
      return { success: true, messageId: response.id };
    }
    return { success: false, error: response.error?.message || 'Unknown error' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function searchEmails(query: string, maxResults = 20): Promise<EmailMessage[]> {
  return listEmails(query, maxResults);
}

export function isAuthenticated(): boolean {
  return getGoogleToken() !== null && loadCredentials() !== null;
}

export function getAuthUrl(): string | null {
  const credentials = loadCredentials();
  if (!credentials) return null;

  const config = credentials.installed || credentials.web;
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: config.redirect_uris[0],
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
