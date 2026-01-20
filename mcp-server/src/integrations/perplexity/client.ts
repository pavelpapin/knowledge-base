/**
 * Perplexity Client
 */

import * as fs from 'fs';
import * as https from 'https';
import { paths } from '@elio/shared';
import { PerplexityCredentials, PerplexityResponse } from './types.js';

const CREDENTIALS_PATH = paths.credentials.perplexity;

export function loadCredentials(): PerplexityCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

export async function perplexityRequest(body: Record<string, unknown>): Promise<PerplexityResponse> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Perplexity not authenticated. Add api_key to credentials.');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.perplexity.ai',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.api_key}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'Perplexity API error'));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error('Invalid response from Perplexity'));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
Perplexity Integration Setup:

1. Go to https://www.perplexity.ai/settings/api
2. Create an API key
3. Create /root/.claude/secrets/perplexity-token.json:
   { "api_key": "pplx-YOUR_API_KEY" }
`;
}
