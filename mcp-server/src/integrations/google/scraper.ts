/**
 * Google Search Scraper (Free)
 * Parses Google search results without API
 * Uses multiple methods: direct scrape, DuckDuckGo fallback
 */

import { createHash } from 'crypto';
import { httpRequest } from '../../utils/http.js';

// Cache for search results
const cache = new Map<string, { data: GoogleSearchResult[]; expiresAt: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface GoogleSearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
  domain: string;
  type?: 'organic' | 'featured' | 'video' | 'news' | 'image';
}

export interface GoogleSearchResponse {
  results: GoogleSearchResult[];
  totalResults?: number;
  cached: boolean;
  query: string;
  method: 'google-html' | 'serpapi-free' | 'duckduckgo';
}

function getCacheKey(query: string, num: number): string {
  return `google:${createHash('md5').update(`${query}:${num}`).digest('hex')}`;
}

/**
 * Search Google and get parsed results
 * Tries multiple methods in order of preference
 */
export async function search(
  query: string,
  options: {
    num?: number;
    lang?: string;
    country?: string;
  } = {}
): Promise<GoogleSearchResponse> {
  const num = Math.min(options.num || 10, 30);
  const cacheKey = getCacheKey(query, num);

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[Google] Cache HIT for:', query.slice(0, 50));
    return { results: cached.data, cached: true, query, method: 'google-html' };
  }

  console.log('[Google] Cache MISS, searching:', query.slice(0, 50));

  // Try methods in order
  let results: GoogleSearchResult[] = [];
  let method: GoogleSearchResponse['method'] = 'duckduckgo';

  // Method 1: Direct Google HTML scraping
  try {
    results = await scrapeGoogleHtml(query, num, options.lang);
    if (results.length > 0) {
      method = 'google-html';
    }
  } catch (e) {
    console.log('[Google] HTML scrape failed:', (e as Error).message);
  }

  // Method 2: Fallback to DuckDuckGo
  if (results.length === 0) {
    try {
      const { duckduckgoSearch } = await import('../webscraping/index.js');
      const ddgResults = await duckduckgoSearch(query, num);
      results = ddgResults.map((r, i) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        position: i + 1,
        domain: new URL(r.url).hostname,
        type: 'organic' as const
      }));
      method = 'duckduckgo';
    } catch (e) {
      console.log('[Google] DuckDuckGo fallback failed:', (e as Error).message);
    }
  }

  // Cache results
  if (results.length > 0) {
    cache.set(cacheKey, { data: results, expiresAt: Date.now() + CACHE_TTL });
  }

  return { results, cached: false, query, method };
}

/**
 * Scrape Google HTML directly
 */
async function scrapeGoogleHtml(
  query: string,
  num: number,
  lang?: string
): Promise<GoogleSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    num: String(num),
    hl: lang || 'en',
  });

  // Use a common user agent
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const html = await httpRequest<string>({
    hostname: 'www.google.com',
    path: `/search?${params}`,
    method: 'GET',
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'text/html'
    }
  });

  return parseGoogleHtml(html);
}

/**
 * Parse Google search results HTML
 */
function parseGoogleHtml(html: string): GoogleSearchResult[] {
  const results: GoogleSearchResult[] = [];

  // Pattern for search result blocks
  // Google uses data-* attributes and nested divs

  // Find all result links with their context
  const linkPattern = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gi;
  const titlePattern = /<h3[^>]*>([^<]+)<\/h3>/gi;
  const snippetPattern = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+(?:<[^>]+>[^<]+)*)<\/div>/gi;

  // Alternative: look for result containers
  const containerPattern = /<div[^>]*class="[^"]*g[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;

  let match;
  let position = 0;

  // Try to find structured results
  while ((match = containerPattern.exec(html)) !== null && position < 30) {
    const container = match[1];

    // Extract URL
    const urlMatch = container.match(/href="([^"]+)"/);
    if (!urlMatch) continue;

    let url = urlMatch[1];
    if (url.startsWith('/url?q=')) {
      url = decodeURIComponent(url.replace('/url?q=', '').split('&')[0]);
    }

    // Skip Google's own pages
    if (url.includes('google.com') || url.includes('youtube.com/results')) continue;
    if (!url.startsWith('http')) continue;

    // Extract title
    const titleMatch = container.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    const title = titleMatch ? cleanHtml(titleMatch[1]) : '';

    // Extract snippet
    const snippetMatch = container.match(/class="[^"]*VwiC3b[^"]*"[^>]*>([^<]+)/i);
    const snippet = snippetMatch ? cleanHtml(snippetMatch[1]) : '';

    if (title && url) {
      position++;
      try {
        results.push({
          title,
          url,
          snippet,
          position,
          domain: new URL(url).hostname,
          type: 'organic'
        });
      } catch {
        // Invalid URL, skip
      }
    }
  }

  // Simpler fallback: just find all external links with context
  if (results.length < 5) {
    const simplePattern = /href="(https?:\/\/(?!www\.google)[^"]+)"[^>]*>([^<]+)/gi;
    while ((match = simplePattern.exec(html)) !== null && results.length < 30) {
      const url = match[1];
      const text = cleanHtml(match[2]);

      if (url.includes('google.com')) continue;
      if (text.length < 5) continue;
      if (results.some(r => r.url === url)) continue;

      try {
        results.push({
          title: text,
          url,
          snippet: '',
          position: results.length + 1,
          domain: new URL(url).hostname,
          type: 'organic'
        });
      } catch {
        // Invalid URL
      }
    }
  }

  return results;
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Deep search: get Google results and fetch content from top URLs
 */
export async function deepSearch(
  query: string,
  options: {
    num?: number;
    fetchContent?: boolean;
    maxContentUrls?: number;
  } = {}
): Promise<{
  results: GoogleSearchResult[];
  content?: Array<{ url: string; title: string; content: string }>;
}> {
  const searchResults = await search(query, { num: options.num || 10 });

  if (!options.fetchContent) {
    return { results: searchResults.results };
  }

  // Fetch content from top URLs using Jina
  const maxUrls = options.maxContentUrls || 5;
  const { jinaReader } = await import('../webscraping/index.js');

  const content: Array<{ url: string; title: string; content: string }> = [];

  for (const result of searchResults.results.slice(0, maxUrls)) {
    try {
      const page = await jinaReader(result.url);
      if (page.success) {
        content.push({
          url: result.url,
          title: result.title,
          content: page.content.slice(0, 10000) // Limit content size
        });
      }
    } catch (e) {
      console.log(`[Google] Failed to fetch ${result.url}:`, (e as Error).message);
    }
  }

  return { results: searchResults.results, content };
}

// Cache management
export function getCacheStats(): { size: number } {
  return { size: cache.size };
}

export function clearCache(): void {
  cache.clear();
}
