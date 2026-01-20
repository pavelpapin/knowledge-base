/**
 * Scrape.do Integration
 * Premium proxy scraper that bypasses blocks (LinkedIn, Google, etc.)
 * https://scrape.do
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const CREDENTIALS_PATH = '/root/.claude/secrets/scrapedo.json';
const BASE_URL = 'https://api.scrape.do';

// Cache for scraped pages
const cache = new Map<string, { data: string; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours default

function getCredentials(): { api_key: string } | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function getCacheKey(url: string, options?: string): string {
  const input = `${url}:${options || ''}`;
  return `scrapedo:${createHash('md5').update(input).digest('hex')}`;
}

export interface ScrapeOptions {
  /** Render JavaScript (for SPAs) */
  render?: boolean;
  /** Use residential proxies */
  residential?: boolean;
  /** Target country code (us, uk, de, etc.) */
  geoCode?: string;
  /** Wait for specific element */
  waitSelector?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Return as JSON (for APIs) */
  returnJson?: boolean;
  /** Cache TTL in ms (default 24h) */
  cacheTtl?: number;
  /** Skip cache */
  noCache?: boolean;
}

export interface ScrapeResult {
  success: boolean;
  url: string;
  content: string;
  statusCode?: number;
  cached: boolean;
  error?: string;
}

/**
 * Scrape any URL through Scrape.do proxy
 * Bypasses blocks on LinkedIn, Google, etc.
 */
export async function scrape(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error('Scrape.do not configured. Add api_key to /root/.claude/secrets/scrapedo.json');
  }

  const cacheKey = getCacheKey(url, JSON.stringify(options));
  const cacheTtl = options.cacheTtl || CACHE_TTL;

  // Check cache
  if (!options.noCache) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[Scrape.do] Cache HIT for:', url.slice(0, 50));
      return { success: true, url, content: cached.data, cached: true };
    }
  }

  console.log('[Scrape.do] Fetching:', url.slice(0, 80));

  // Build query params
  const params = new URLSearchParams({
    token: creds.api_key,
    url: url
  });

  if (options.render) params.set('render', 'true');
  if (options.residential) params.set('residential', 'true');
  if (options.geoCode) params.set('geoCode', options.geoCode);
  if (options.waitSelector) params.set('waitSelector', options.waitSelector);

  try {
    const response = await fetch(`${BASE_URL}/?${params}`, {
      method: 'GET',
      headers: options.headers || {}
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Scrape.do] Error:', response.status, errorText.slice(0, 200));
      return {
        success: false,
        url,
        content: '',
        statusCode: response.status,
        cached: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`
      };
    }

    const content = options.returnJson
      ? JSON.stringify(await response.json())
      : await response.text();

    // Cache result
    cache.set(cacheKey, { data: content, expiresAt: Date.now() + cacheTtl });

    return {
      success: true,
      url,
      content,
      statusCode: response.status,
      cached: false
    };
  } catch (error) {
    console.error('[Scrape.do] Fetch error:', error);
    return {
      success: false,
      url,
      content: '',
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Scrape LinkedIn profile
 */
export async function scrapeLinkedIn(
  profileUrl: string
): Promise<ScrapeResult> {
  // Normalize LinkedIn URL
  let url = profileUrl;
  if (!url.startsWith('http')) {
    url = 'https://www.linkedin.com/in/' + url.replace(/^\/+/, '');
  }

  return scrape(url, {
    render: true,  // LinkedIn needs JS
    residential: true,  // Better for LinkedIn
    geoCode: 'us',
    cacheTtl: 30 * 24 * 60 * 60 * 1000  // 30 days for profiles
  });
}

/**
 * Scrape Google search results
 */
export async function scrapeGoogle(
  query: string,
  options: { num?: number; lang?: string } = {}
): Promise<ScrapeResult> {
  const params = new URLSearchParams({
    q: query,
    num: String(options.num || 10),
    hl: options.lang || 'en'
  });

  const url = `https://www.google.com/search?${params}`;

  return scrape(url, {
    render: false,  // Google works without JS
    geoCode: 'us',
    cacheTtl: 7 * 24 * 60 * 60 * 1000  // 7 days for search
  });
}

/**
 * Scrape any page with JS rendering
 */
export async function scrapeWithJs(
  url: string,
  waitSelector?: string
): Promise<ScrapeResult> {
  return scrape(url, {
    render: true,
    waitSelector,
    residential: true
  });
}

// Utility functions

export function isAuthenticated(): boolean {
  return getCredentials() !== null;
}

export function getCacheStats(): { size: number } {
  return { size: cache.size };
}

export function clearCache(): void {
  cache.clear();
}
