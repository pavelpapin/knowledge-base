/**
 * LinkedIn API Utilities
 * HTTP request helpers for Proxycurl and RapidAPI
 */

import { httpRequest, buildQueryString } from '../../utils/http.js';
import { loadCredentialsSync, LinkedInCredentials } from '../../utils/credentials.js';

const CREDENTIALS_FILE = 'linkedin-credentials.json';

export function loadCredentials(): LinkedInCredentials | null {
  return loadCredentialsSync<LinkedInCredentials>(CREDENTIALS_FILE);
}

export async function rapidApiRequest<T = unknown>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const credentials = loadCredentials();
  if (!credentials?.rapidapi_key) {
    throw new Error('RapidAPI key not configured');
  }

  return httpRequest<T>({
    hostname: 'linkedin-api8.p.rapidapi.com',
    path: `${endpoint}${buildQueryString(params)}`,
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': credentials.rapidapi_key,
      'X-RapidAPI-Host': 'linkedin-api8.p.rapidapi.com'
    }
  });
}

export async function proxycurlRequest<T = unknown>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const credentials = loadCredentials();
  if (!credentials?.proxycurl_key) {
    throw new Error('Proxycurl API key not configured');
  }

  return httpRequest<T>({
    hostname: 'nubela.co',
    path: `/proxycurl/api${endpoint}${buildQueryString(params)}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${credentials.proxycurl_key}`
    }
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
