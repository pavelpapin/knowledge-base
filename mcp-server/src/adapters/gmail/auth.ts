/**
 * Gmail Auth
 * Google OAuth token management
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { paths } from '@elio/shared';
import { httpRequest } from '../../utils/http.js';
import { getGoogleToken, GoogleToken } from '../../utils/credentials.js';

const CREDENTIALS_PATH = paths.credentials.google;
const TOKEN_PATH = paths.credentials.googleToken;

interface GoogleCredentials {
  installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
  web?: { client_id: string; client_secret: string; redirect_uris: string[] };
}

export function loadCredentials(): GoogleCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

export function saveToken(token: GoogleToken): void {
  mkdirSync(dirname(TOKEN_PATH), { recursive: true });
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

export async function getAccessToken(): Promise<string | null> {
  const token = getGoogleToken();
  if (!token) return null;

  if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
    return refreshAccessToken();
  }
  return token.access_token;
}

export function isAuthenticated(): boolean {
  return getGoogleToken() !== null && loadCredentials() !== null;
}
