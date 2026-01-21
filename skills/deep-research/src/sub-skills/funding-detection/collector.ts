/**
 * Funding Detection - Data Collector
 * Collects articles from GDELT and RSS feeds
 */

import * as crypto from 'crypto';
import { RawArticle, GDELTResponse, RSSItem } from './types';
import { buildGDELTQuery, FUNDING_KEYWORDS, RSS_FEEDS } from './config';

/**
 * Fetch articles from GDELT API
 */
export async function fetchGDELTArticles(
  keywords: string[] = FUNDING_KEYWORDS,
  lookbackHours: number = 72
): Promise<RawArticle[]> {
  const url = buildGDELTQuery(keywords, lookbackHours);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`[GDELT] API returned ${response.status}`);
      return [];
    }

    const data = await response.json() as GDELTResponse;

    if (!data.articles || !Array.isArray(data.articles)) {
      console.log('[GDELT] No articles in response');
      return [];
    }

    return data.articles.map(article => ({
      id: crypto.randomUUID(),
      title: article.title || '',
      body: '', // GDELT doesn't include body, need to fetch
      url: article.url,
      publishedAt: parseGDELTDate(article.seendate),
      source: article.domain,
      fetchedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.log(`[GDELT] Fetch error: ${error}`);
    return [];
  }
}

/**
 * Parse GDELT date format (YYYYMMDDHHMMSS)
 */
function parseGDELTDate(seendate: string): string {
  if (!seendate || seendate.length < 8) {
    return new Date().toISOString();
  }

  const year = seendate.slice(0, 4);
  const month = seendate.slice(4, 6);
  const day = seendate.slice(6, 8);
  const hour = seendate.slice(8, 10) || '00';
  const minute = seendate.slice(10, 12) || '00';

  return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
}

/**
 * Fetch articles from RSS feeds
 */
export async function fetchRSSArticles(
  feeds: typeof RSS_FEEDS = RSS_FEEDS
): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  for (const feed of feeds) {
    try {
      const feedArticles = await fetchSingleRSSFeed(feed.url, feed.name);
      articles.push(...feedArticles);
    } catch (error) {
      console.log(`[RSS] Error fetching ${feed.name}: ${error}`);
    }
  }

  return articles;
}

/**
 * Fetch single RSS feed
 */
async function fetchSingleRSSFeed(url: string, sourceName: string): Promise<RawArticle[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Elio/1.0 (Deep Research Agent)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    const items = parseRSSItems(xml);

    return items.map(item => ({
      id: crypto.randomUUID(),
      title: item.title,
      body: item.content || item.description || '',
      url: item.link,
      publishedAt: new Date(item.pubDate).toISOString(),
      source: sourceName,
      fetchedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.log(`[RSS] Parse error for ${sourceName}: ${error}`);
    return [];
  }
}

/**
 * Simple RSS XML parser
 */
function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Extract items using regex (simple approach, works for most RSS)
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    const content = extractTag(itemXml, 'content:encoded') || extractTag(itemXml, 'content');

    if (title && link) {
      items.push({
        title: decodeHTMLEntities(title),
        link,
        pubDate: pubDate || new Date().toISOString(),
        description: decodeHTMLEntities(description || ''),
        content: decodeHTMLEntities(content || '')
      });
    }
  }

  return items;
}

/**
 * Extract XML tag content
 */
function extractTag(xml: string, tag: string): string {
  // Try CDATA first
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // Try regular content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ''); // Strip remaining HTML tags
}

/**
 * Fetch article body from URL (for GDELT articles that don't include body)
 */
export async function fetchArticleBody(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Elio/1.0; +https://elio.ai)'
      }
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();

    // Extract article content (simplified)
    // In production, use readability library
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      return decodeHTMLEntities(articleMatch[1]);
    }

    // Fallback: extract paragraphs
    const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
    return paragraphs
      .map(p => decodeHTMLEntities(p.replace(/<[^>]*>/g, '')))
      .join('\n\n')
      .slice(0, 5000); // Limit to 5000 chars
  } catch (error) {
    console.log(`[Collector] Body fetch error for ${url}: ${error}`);
    return '';
  }
}

/**
 * Filter articles by funding keywords
 */
export function filterByKeywords(
  articles: RawArticle[],
  keywords: string[] = FUNDING_KEYWORDS
): RawArticle[] {
  const keywordsLower = keywords.map(k => k.toLowerCase());

  return articles.filter(article => {
    const text = `${article.title} ${article.body}`.toLowerCase();
    return keywordsLower.some(keyword => text.includes(keyword));
  });
}

/**
 * Remove duplicate articles by URL and title
 */
export function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seen = new Set<string>();
  const result: RawArticle[] = [];

  for (const article of articles) {
    // Create dedupe key from normalized URL and title
    const urlKey = normalizeUrl(article.url);
    const titleKey = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    const key = `${urlKey}|${titleKey}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(article);
    }
  }

  return result;
}

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Main collection function
 */
export async function collectArticles(config?: {
  useGDELT?: boolean;
  useRSS?: boolean;
  lookbackHours?: number;
}): Promise<RawArticle[]> {
  const { useGDELT = true, useRSS = true, lookbackHours = 72 } = config || {};

  const allArticles: RawArticle[] = [];

  // Collect from GDELT
  if (useGDELT) {
    console.log('[Collector] Fetching from GDELT...');
    const gdeltArticles = await fetchGDELTArticles(FUNDING_KEYWORDS, lookbackHours);
    console.log(`[Collector] GDELT: ${gdeltArticles.length} articles`);
    allArticles.push(...gdeltArticles);
  }

  // Collect from RSS
  if (useRSS) {
    console.log('[Collector] Fetching from RSS feeds...');
    const rssArticles = await fetchRSSArticles();
    console.log(`[Collector] RSS: ${rssArticles.length} articles`);
    allArticles.push(...rssArticles);
  }

  // Filter and deduplicate
  const filtered = filterByKeywords(allArticles);
  console.log(`[Collector] After keyword filter: ${filtered.length} articles`);

  const deduplicated = deduplicateArticles(filtered);
  console.log(`[Collector] After deduplication: ${deduplicated.length} articles`);

  return deduplicated;
}
