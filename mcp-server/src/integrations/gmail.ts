/**
 * Gmail Integration
 * Read, search, and send emails via Gmail API
 */

import * as fs from 'fs';
import * as https from 'https';

const CREDENTIALS_PATH = '/root/.claude/secrets/google-credentials.json';
const TOKEN_PATH = '/root/.claude/secrets/google-token.json';

interface GoogleCredentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface GoogleToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
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
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

function loadToken(): GoogleToken | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
}

function saveToken(token: GoogleToken): void {
  fs.mkdirSync('/root/.claude/secrets', { recursive: true });
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function refreshAccessToken(): Promise<string | null> {
  const credentials = loadCredentials();
  const token = loadToken();

  if (!credentials || !token) {
    return null;
  }

  const config = credentials.installed || credentials.web;
  if (!config) return null;

  return new Promise((resolve) => {
    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    });

    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const newToken = JSON.parse(data);
          if (newToken.access_token) {
            saveToken({
              ...token,
              access_token: newToken.access_token,
              expiry_date: Date.now() + (newToken.expires_in * 1000)
            });
            resolve(newToken.access_token);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(params.toString());
    req.end();
  });
}

async function getAccessToken(): Promise<string | null> {
  const token = loadToken();
  if (!token) return null;

  if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
    return refreshAccessToken();
  }

  return token.access_token;
}

async function gmailRequest(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated. Run gmail-auth to authenticate.');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'gmail.googleapis.com',
      path: `/gmail/v1/users/me${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
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

export async function listEmails(query = '', maxResults = 10): Promise<EmailMessage[]> {
  const params = new URLSearchParams({
    maxResults: String(maxResults)
  });
  if (query) {
    params.set('q', query);
  }

  const response = await gmailRequest(`/messages?${params}`) as { messages?: Array<{ id: string }> };

  if (!response.messages) {
    return [];
  }

  const messages: EmailMessage[] = [];

  for (const msg of response.messages.slice(0, maxResults)) {
    const detail = await gmailRequest(`/messages/${msg.id}`) as {
      id: string;
      threadId: string;
      snippet: string;
      labelIds: string[];
      payload: {
        headers: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{ body?: { data?: string } }>;
      };
    };

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
  const detail = await gmailRequest(`/messages/${messageId}?format=full`) as {
    id: string;
    threadId: string;
    snippet: string;
    labelIds: string[];
    payload: {
      headers: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
    };
  };

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

export async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ].join('\r\n');

  const encodedEmail = Buffer.from(email).toString('base64url');

  try {
    const response = await gmailRequest('/messages/send', 'POST', {
      raw: encodedEmail
    }) as { id?: string; error?: { message: string } };

    if (response.id) {
      return { success: true, messageId: response.id };
    }

    return { success: false, error: response.error?.message || 'Unknown error' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function searchEmails(query: string, maxResults = 20): Promise<EmailMessage[]> {
  return listEmails(query, maxResults);
}

export function isAuthenticated(): boolean {
  return loadToken() !== null && loadCredentials() !== null;
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
