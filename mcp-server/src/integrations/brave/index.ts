/**
 * Brave Search API Integration
 * With caching to minimize API costs
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { httpRequest } from '../../utils/http.js';

const CREDENTIALS_PATH = '/root/.claude/secrets/brave.json';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for search results

// In-memory cache with persistence
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function getCacheKey(query: string, type: string): string {
  const hash = createHash('md5').update(query.toLowerCase().trim()).digest('hex');
  return `brave:${type}:${hash}`;
}

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  if (entry) {
    cache.delete(key);
  }
  return null;
}

function setCache(key: string, data: unknown, ttl: number = CACHE_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

function getCredentials(): { api_key: string } | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export interface BraveSearchResponse {
  results: BraveSearchResult[];
  cached: boolean;
  query: string;
}

/**
 * Search the web using Brave Search API
 * Results are cached for 7 days to minimize costs
 */
export async function search(
  query: string,
  options: {
    count?: number;
    freshness?: 'pd' | 'pw' | 'pm' | 'py'; // past day/week/month/year
    country?: string;
  } = {}
): Promise<BraveSearchResponse> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error('Brave API not configured. Add api_key to /root/.claude/secrets/brave.json');
  }

  const count = options.count || 10;
  const cacheKey = getCacheKey(`${query}:${count}:${options.freshness || ''}`, 'search');

  // Check cache first
  const cached = getFromCache<BraveSearchResult[]>(cacheKey);
  if (cached) {
    console.log(`[Brave] Cache HIT for: ${query.slice(0, 50)}`);
    return { results: cached, cached: true, query };
  }

  console.log(`[Brave] Cache MISS, calling API for: ${query.slice(0, 50)}`);

  const params = new URLSearchParams({
    q: query,
    count: String(count),
  });

  if (options.freshness) params.set('freshness', options.freshness);
  if (options.country) params.set('country', options.country);

  const response = await httpRequest<{
    web?: { results: Array<{ title: string; url: string; description: string; age?: string }> };
  }>({
    hostname: 'api.search.brave.com',
    path: `/res/v1/web/search?${params}`,
    method: 'GET',
    headers: {
      'X-Subscription-Token': creds.api_key,
      'Accept': 'application/json'
    }
  });

  const results: BraveSearchResult[] = (response.web?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    description: r.description,
    age: r.age
  }));

  // Cache results
  setCache(cacheKey, results);

  return { results, cached: false, query };
}

/**
 * Search news using Brave Search API
 */
export async function searchNews(
  query: string,
  options: { count?: number; freshness?: 'pd' | 'pw' | 'pm' } = {}
): Promise<BraveSearchResponse> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error('Brave API not configured');
  }

  const count = options.count || 10;
  const freshness = options.freshness || 'pw';
  const cacheKey = getCacheKey(`${query}:${count}:${freshness}`, 'news');

  const cached = getFromCache<BraveSearchResult[]>(cacheKey);
  if (cached) {
    console.log(`[Brave News] Cache HIT for: ${query.slice(0, 50)}`);
    return { results: cached, cached: true, query };
  }

  console.log(`[Brave News] Cache MISS, calling API for: ${query.slice(0, 50)}`);

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    freshness,
    news: 'true'
  });

  const response = await httpRequest<{
    news?: { results: Array<{ title: string; url: string; description: string; age?: string }> };
  }>({
    hostname: 'api.search.brave.com',
    path: `/res/v1/web/search?${params}`,
    method: 'GET',
    headers: {
      'X-Subscription-Token': creds.api_key,
      'Accept': 'application/json'
    }
  });

  const results: BraveSearchResult[] = (response.news?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    description: r.description,
    age: r.age
  }));

  // Cache for shorter time (1 day for news)
  setCache(cacheKey, results, 24 * 60 * 60 * 1000);

  return { results, cached: false, query };
}

export function isAuthenticated(): boolean {
  return getCredentials() !== null;
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

export function clearCache(): void {
  cache.clear();
}
