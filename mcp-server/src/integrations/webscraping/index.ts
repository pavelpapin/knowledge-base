/**
 * Web Scraping Integration
 * Combines Jina Reader, DuckDuckGo, and Google News RSS
 *
 * Security: Uses execFile with argument arrays to prevent command injection
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Validate query to prevent injection
// Allow: Unicode letters, numbers, spaces, common punctuation, site: prefix
const SAFE_QUERY_REGEX = /^[\p{L}\p{N}\s.,!?'":()\-/@]+$/u;
const MAX_QUERY_LENGTH = 500;

function validateQuery(query: string): void {
  if (!query || query.length > MAX_QUERY_LENGTH) {
    throw new Error('Invalid query length');
  }
  // Allow Unicode letters, numbers, common punctuation, site: syntax
  if (!SAFE_QUERY_REGEX.test(query)) {
    throw new Error('Query contains unsafe characters');
  }
}

export interface JinaReaderResult {
  title: string;
  url: string;
  content: string;
  success: boolean;
  error?: string;
}

export interface DuckDuckGoResult {
  title: string;
  url: string;
  snippet: string;
}

export interface GoogleNewsResult {
  title: string;
  url: string;
  published: string;
  source: string;
}

/**
 * Jina Reader - Extract clean markdown from any URL
 * Free: 1M tokens/month, no API key needed
 */
export async function jinaReader(url: string): Promise<JinaReaderResult> {
  try {
    // Basic URL validation
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL protocol');
    }

    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain'
      }
    });

    if (!response.ok) {
      throw new Error(`Jina Reader error: ${response.status}`);
    }

    const content = await response.text();

    // Parse title from content (first line usually)
    const lines = content.split('\n');
    const titleLine = lines.find(l => l.startsWith('Title:'));
    const title = titleLine ? titleLine.replace('Title:', '').trim() : 'Unknown';

    return {
      title,
      url,
      content,
      success: true
    };
  } catch (error) {
    return {
      title: '',
      url,
      content: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * DuckDuckGo Search - Free unlimited search
 * Uses Python duckduckgo-search library
 * Security: Uses execFile with separate arguments to prevent command injection
 */
export async function duckduckgoSearch(
  query: string,
  maxResults: number = 10
): Promise<DuckDuckGoResult[]> {
  try {
    validateQuery(query);

    const pythonScript = `
import sys
import json
from duckduckgo_search import DDGS
query = sys.argv[1]
max_results = int(sys.argv[2])
r = DDGS().text(query, max_results=max_results)
print(json.dumps(r))
`;

    const { stdout } = await execFileAsync(
      'python3',
      ['-c', pythonScript, query, String(maxResults)],
      { timeout: 30000 }
    );

    const results = JSON.parse(stdout);
    return results.map((r: { title: string; href: string; body: string }) => ({
      title: r.title,
      url: r.href,
      snippet: r.body
    }));
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    return [];
  }
}

/**
 * DuckDuckGo News Search
 * Security: Uses execFile with separate arguments
 */
export async function duckduckgoNews(
  query: string,
  maxResults: number = 10
): Promise<DuckDuckGoResult[]> {
  try {
    validateQuery(query);

    const pythonScript = `
import sys
import json
from duckduckgo_search import DDGS
query = sys.argv[1]
max_results = int(sys.argv[2])
r = DDGS().news(query, max_results=max_results)
print(json.dumps(r))
`;

    const { stdout } = await execFileAsync(
      'python3',
      ['-c', pythonScript, query, String(maxResults)],
      { timeout: 30000 }
    );

    const results = JSON.parse(stdout);
    return results.map((r: { title: string; url: string; body: string }) => ({
      title: r.title,
      url: r.url,
      snippet: r.body
    }));
  } catch (error) {
    console.error('DuckDuckGo news error:', error);
    return [];
  }
}

/**
 * Google News RSS - Free unlimited news
 * Security: Uses execFile with separate arguments
 */
export async function googleNewsRss(
  query: string,
  maxResults: number = 10
): Promise<GoogleNewsResult[]> {
  try {
    validateQuery(query);

    const encodedQuery = encodeURIComponent(query);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

    const pythonScript = `
import sys
import json
import feedparser
url = sys.argv[1]
max_results = int(sys.argv[2])
f = feedparser.parse(url)
result = [{'title': e.title, 'url': e.link, 'published': e.get('published', ''), 'source': e.get('source', {}).get('title', '')} for e in f.entries[:max_results]]
print(json.dumps(result))
`;

    const { stdout } = await execFileAsync(
      'python3',
      ['-c', pythonScript, rssUrl, String(maxResults)],
      { timeout: 30000 }
    );

    return JSON.parse(stdout);
  } catch (error) {
    console.error('Google News RSS error:', error);
    return [];
  }
}

/**
 * Combined web search - searches multiple sources
 */
export async function combinedSearch(
  query: string,
  options: {
    includeNews?: boolean;
    maxResults?: number;
  } = {}
): Promise<{
  web: DuckDuckGoResult[];
  news: GoogleNewsResult[];
}> {
  const maxResults = options.maxResults || 10;

  const [web, news] = await Promise.all([
    duckduckgoSearch(query, maxResults),
    options.includeNews ? googleNewsRss(query, maxResults) : Promise.resolve([])
  ]);

  return { web, news };
}
