/**
 * LinkedIn API Utilities
 * HTTP request helpers for Proxycurl and RapidAPI
 */

import * as fs from 'fs';
import * as https from 'https';
import type { LinkedInCredentials } from './types.js';

const CREDENTIALS_PATH = '/root/.claude/secrets/linkedin-credentials.json';

export function loadCredentials(): LinkedInCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

export async function rapidApiRequest(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials?.rapidapi_key) {
    throw new Error('RapidAPI key not configured');
  }

  const queryString = new URLSearchParams(params).toString();

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'linkedin-api8.p.rapidapi.com',
      path: `${endpoint}?${queryString}`,
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': credentials.rapidapi_key,
        'X-RapidAPI-Host': 'linkedin-api8.p.rapidapi.com'
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
    req.end();
  });
}

export async function proxycurlRequest(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const credentials = loadCredentials();
  const apiKey = credentials?.proxycurl_key;

  if (!apiKey) {
    throw new Error('Proxycurl API key not configured');
  }

  const queryString = new URLSearchParams(params).toString();

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'nubela.co',
      path: `/proxycurl/api${endpoint}?${queryString}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
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
    req.end();
  });
}

export function isAuthenticated(): boolean {
  const credentials = loadCredentials();
  return credentials !== null && (
    !!credentials.rapidapi_key ||
    !!credentials.proxycurl_key
  );
}

export function getAuthInstructions(): string {
  return `
LinkedIn Integration Setup:

Option 1: Proxycurl (Recommended)
1. Sign up at https://nubela.co/proxycurl
2. Get your API key
3. Create /root/.claude/secrets/linkedin-credentials.json:
   { "proxycurl_key": "YOUR_API_KEY" }

Option 2: RapidAPI LinkedIn API
1. Subscribe to LinkedIn API on RapidAPI
2. Get your API key
3. Create /root/.claude/secrets/linkedin-credentials.json:
   { "rapidapi_key": "YOUR_API_KEY" }
`;
}
