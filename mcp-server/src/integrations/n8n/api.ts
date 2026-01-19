/**
 * n8n API Utilities
 */

import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import type { N8nCredentials, WebhookResponse } from './types.js';

const CREDENTIALS_PATH = '/root/.claude/secrets/n8n-credentials.json';

export function loadCredentials(): N8nCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

export async function n8nRequest(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('n8n not configured. Add credentials to /root/.claude/secrets/n8n-credentials.json');
  }

  const url = new URL(credentials.base_url);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `/api/v1${endpoint}`,
      method,
      headers: {
        'X-N8N-API-KEY': credentials.api_key,
        'Content-Type': 'application/json'
      }
    };

    const req = httpModule.request(options, (res) => {
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

export async function webhookRequest(
  webhookPath: string,
  method: 'GET' | 'POST' = 'POST',
  data?: unknown
): Promise<WebhookResponse> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('n8n not configured');
  }

  const url = new URL(credentials.base_url);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve) => {
    const path = webhookPath.startsWith('/') ? webhookPath : `/webhook/${webhookPath}`;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, data: JSON.parse(responseData) });
        } catch {
          resolve({ success: true, data: responseData });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    if (data && method === 'POST') {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
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
