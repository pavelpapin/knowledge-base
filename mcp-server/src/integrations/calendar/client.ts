/**
 * Google Calendar Client
 */

import * as fs from 'fs';
import * as https from 'https';
import { paths } from '@elio/shared';
import { GoogleToken } from './types.js';

const TOKEN_PATH = paths.credentials.googleToken;

export function loadToken(): GoogleToken | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
}

export async function calendarRequest(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  const token = loadToken();
  if (!token) {
    throw new Error('Not authenticated. Run gmail-auth to authenticate.');
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'www.googleapis.com',
      path: `/calendar/v3${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
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

export function isAuthenticated(): boolean {
  return loadToken() !== null;
}
