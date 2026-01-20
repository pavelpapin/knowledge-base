/**
 * n8n API Utilities
 */

import { httpRequest } from '../../utils/http.js';
import { loadCredentialsSync, N8nCredentials } from '../../utils/credentials.js';
import type { WebhookResponse } from './types.js';

const CREDENTIALS_FILE = 'n8n-credentials.json';

export function loadCredentials(): N8nCredentials | null {
  return loadCredentialsSync<N8nCredentials>(CREDENTIALS_FILE);
}

function parseBaseUrl(baseUrl: string): { hostname: string; port?: number; protocol: 'http' | 'https' } {
  const url = new URL(baseUrl);
  return {
    hostname: url.hostname,
    port: url.port ? parseInt(url.port) : undefined,
    protocol: url.protocol === 'http:' ? 'http' : 'https'
  };
}

export async function n8nRequest<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('n8n not configured. Add credentials to /root/.claude/secrets/n8n-credentials.json');
  }

  const { hostname, port, protocol } = parseBaseUrl(credentials.base_url);

  return httpRequest<T>({
    hostname,
    port,
    protocol,
    path: `/api/v1${endpoint}`,
    method,
    headers: {
      'X-N8N-API-KEY': credentials.api_key || ''
    },
    body
  });
}

export async function webhookRequest(
  webhookPath: string,
  method: 'GET' | 'POST' = 'POST',
  data?: unknown
): Promise<WebhookResponse> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('n8n not configured');
  }

  const { hostname, port, protocol } = parseBaseUrl(credentials.base_url);
  const path = webhookPath.startsWith('/') ? webhookPath : `/webhook/${webhookPath}`;

  try {
    const result = await httpRequest<unknown>({
      hostname,
      port,
      protocol,
      path,
      method,
      body: method === 'POST' ? data : undefined
    });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
n8n Integration Setup:

1. Go to your n8n instance settings
2. Create an API key (Settings > API)
3. Create /root/.claude/secrets/n8n-credentials.json:
   {
     "base_url": "https://your-n8n-instance.com",
     "api_key": "YOUR_API_KEY"
   }

For self-hosted n8n:
   {
     "base_url": "http://localhost:5678",
     "api_key": "YOUR_API_KEY"
   }

Note: Webhook triggers require workflows with Webhook nodes.
The webhook path is typically the workflow ID or a custom path.
`;
}
