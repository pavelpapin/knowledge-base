/**
 * LinkedIn OAuth 2.0 Integration
 * Handles authentication and API access
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash, randomBytes } from 'crypto';

const CREDENTIALS_PATH = '/root/.claude/secrets/linkedin.json';
const TOKENS_PATH = '/root/.claude/secrets/linkedin-tokens.json';

interface LinkedInCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

interface LinkedInTokens {
  access_token: string;
  expires_at: number;
  refresh_token?: string;
}

function getCredentials(): LinkedInCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function getTokens(): LinkedInTokens | null {
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
    if (tokens.expires_at && tokens.expires_at < Date.now()) {
      console.log('[LinkedIn OAuth] Token expired');
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: LinkedInTokens): void {
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthUrl(state?: string): string {
  const creds = getCredentials();
  if (!creds) {
    throw new Error('LinkedIn credentials not configured');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: creds.client_id,
    redirect_uri: creds.redirect_uri,
    state: state || randomBytes(16).toString('hex'),
    scope: 'openid profile email'
  });

  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCode(code: string): Promise<LinkedInTokens> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error('LinkedIn credentials not configured');
  }

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: creds.redirect_uri
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  const tokens: LinkedInTokens = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    refresh_token: data.refresh_token
  };

  saveTokens(tokens);
  return tokens;
}

/**
 * Get current user's profile via API
 */
export async function getMyProfile(): Promise<LinkedInApiProfile | null> {
  const tokens = getTokens();
  if (!tokens) {
    console.log('[LinkedIn OAuth] No valid token, need to authenticate');
    return null;
  }

  try {
    // Get basic profile via userinfo endpoint (OpenID Connect)
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!response.ok) {
      console.error('[LinkedIn OAuth] API error:', response.status);
      return null;
    }

    const data = await response.json() as {
      sub: string;
      given_name: string;
      family_name: string;
      name: string;
      email?: string;
      picture?: string;
      locale?: string;
    };

    return {
      id: data.sub,
      firstName: data.given_name,
      lastName: data.family_name,
      name: data.name,
      email: data.email,
      picture: data.picture,
      locale: data.locale
    };
  } catch (error) {
    console.error('[LinkedIn OAuth] Error:', error);
    return null;
  }
}

export interface LinkedInApiProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  picture?: string;
  locale?: string;
}

/**
 * Check if we have valid authentication
 */
export function isAuthenticated(): boolean {
  return getTokens() !== null;
}

/**
 * Get authentication status
 */
export function getAuthStatus(): {
  authenticated: boolean;
  expiresAt?: number;
  needsAuth: boolean;
  authUrl?: string;
} {
  const tokens = getTokens();
  const creds = getCredentials();

  if (tokens) {
    return {
      authenticated: true,
      expiresAt: tokens.expires_at,
      needsAuth: false
    };
  }

  if (creds) {
    return {
      authenticated: false,
      needsAuth: true,
      authUrl: getAuthUrl()
    };
  }

  return {
    authenticated: false,
    needsAuth: true
  };
}

/**
 * Start OAuth callback server for one-time auth
 */
export async function startAuthServer(port: number = 3000): Promise<string> {
  const { createServer } = await import('http');

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Error: ${error}</h1>`);
          server.close();
          reject(new Error(error));
          return;
        }

        if (code) {
          try {
            await exchangeCode(code);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>LinkedIn connected!</h1><p>You can close this window.</p>');
            server.close();
            resolve('success');
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Error</h1><p>${err}</p>`);
            server.close();
            reject(err);
          }
          return;
        }
      }

      // Redirect to auth
      const authUrl = getAuthUrl();
      res.writeHead(302, { Location: authUrl });
      res.end();
    });

    server.listen(port, () => {
      console.log(`[LinkedIn OAuth] Server started at http://localhost:${port}`);
      console.log(`[LinkedIn OAuth] Open this URL to authenticate:`);
      console.log(getAuthUrl());
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Auth timeout'));
    }, 5 * 60 * 1000);
  });
}
