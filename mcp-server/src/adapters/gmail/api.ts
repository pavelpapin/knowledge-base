/**
 * Gmail API
 * Low-level Gmail API calls
 */

import { httpRequest, HttpError } from '../../utils/http.js';
import { getAccessToken, isAuthenticated, loadCredentials, saveToken } from './auth.js';

export { isAuthenticated, loadCredentials, saveToken };

export interface EmailMessage {
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
