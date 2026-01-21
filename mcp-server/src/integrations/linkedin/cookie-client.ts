/**
 * LinkedIn Cookie-based Client
 * Uses saved li_at cookie for authenticated requests
 * Works for own profile only (API restriction)
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const COOKIE_PATH = '/root/.claude/secrets/linkedin-cookie.json';

interface LinkedInCookie {
  li_at: string;
  csrf_token: string;
  saved_at: string;
  owner: string;
}

interface MyProfile {
  id: number;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline?: string;
  location?: string;
}

function getCookie(): LinkedInCookie | null {
  if (!existsSync(COOKIE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(COOKIE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getCookie() !== null;
}

export function getOwner(): string | null {
  const cookie = getCookie();
  return cookie?.owner || null;
}

/**
 * Get authenticated user's profile via Voyager API
 */
export async function getMyProfile(): Promise<MyProfile | null> {
  const cookie = getCookie();
  if (!cookie) {
    console.log('[LinkedIn Cookie] No cookie found');
    return null;
  }

  try {
    const { stdout } = await execAsync(`curl -s 'https://www.linkedin.com/voyager/api/me' \
      -H 'Cookie: li_at=${cookie.li_at}; JSESSIONID="${cookie.csrf_token}"' \
      -H 'csrf-token: ${cookie.csrf_token}' \
      -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' \
      -H 'Accept: application/vnd.linkedin.normalized+json+2.1' \
      -H 'x-li-lang: en_US' \
      -H 'x-restli-protocol-version: 2.0.0'`);

    const data = JSON.parse(stdout);

    if (data.exceptionClass || data.status >= 400) {
      console.error('[LinkedIn Cookie] API error:', data.message || data.status);
      return null;
    }

    const mini = data.miniProfile || data.included?.[0]?.miniProfile;

    return {
      id: data.plainId || mini?.entityUrn?.split(':').pop(),
      publicIdentifier: mini?.publicIdentifier || data.publicIdentifier,
      firstName: mini?.firstName || data.firstName,
      lastName: mini?.lastName || data.lastName,
      headline: mini?.occupation || data.headline,
      location: mini?.geoLocation?.name
    };
  } catch (error) {
    console.error('[LinkedIn Cookie] Error:', error);
    return null;
  }
}

/**
 * Validate cookie by calling /me endpoint
 */
export async function validateCookie(): Promise<{
  valid: boolean;
  owner?: string;
  error?: string;
}> {
  const profile = await getMyProfile();

  if (profile) {
    // Update owner in cookie file
    const cookie = getCookie();
    if (cookie && cookie.owner !== profile.publicIdentifier) {
      cookie.owner = profile.publicIdentifier;
      writeFileSync(COOKIE_PATH, JSON.stringify(cookie, null, 2));
    }

    return {
      valid: true,
      owner: profile.publicIdentifier
    };
  }

  return {
    valid: false,
    error: 'Could not validate cookie'
  };
}

/**
 * Save new cookie
 */
export function saveCookie(liAt: string, csrfToken?: string): void {
  const cookie: LinkedInCookie = {
    li_at: liAt,
    csrf_token: csrfToken || `ajax:${Date.now()}`,
    saved_at: new Date().toISOString(),
    owner: ''
  };

  writeFileSync(COOKIE_PATH, JSON.stringify(cookie, null, 2));
  console.log('[LinkedIn Cookie] Saved to', COOKIE_PATH);
}

/**
 * Get instructions for obtaining cookie
 */
export function getInstructions(): string {
  return `
LinkedIn Cookie Setup
====================

1. Open linkedin.com in Chrome/Firefox and log in

2. Open Developer Tools:
   - Mac: Cmd+Option+I
   - Windows/Linux: F12 or Ctrl+Shift+I

3. Go to Application tab (Chrome) or Storage tab (Firefox)

4. Click Cookies → linkedin.com

5. Find "li_at" cookie and copy its value
   (starts with AQ...)

6. Also find "JSESSIONID" cookie and copy its value
   (starts with "ajax:...)

Provide both values to save your session.
`.trim();
}
