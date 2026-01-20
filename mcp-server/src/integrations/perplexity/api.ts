/**
 * Perplexity API
 * Updated for new Sonar models (Jan 2026)
 * WITH CACHING to minimize costs
 */

import { createHash } from 'crypto';
import { perplexityRequest } from './client.js';
import {
  SearchResult,
  SearchOptions,
  ResearchOptions,
  FactCheckResult,
  PerplexityModel
} from './types.js';

// Cache with TTL
const cache = new Map<string, { data: SearchResult; expiresAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours default
const FACT_CHECK_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days for fact checks

function getCacheKey(query: string, model: string, extra?: string): string {
  const input = `${query.toLowerCase().trim()}:${model}:${extra || ''}`;
  return `pplx:${createHash('md5').update(input).digest('hex')}`;
}

function getFromCache(key: string): SearchResult | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    console.log(`[Perplexity] Cache HIT`);
    return entry.data;
  }
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, data: SearchResult, ttl: number = CACHE_TTL): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
  console.log(`[Perplexity] Cached result, TTL: ${ttl / 1000 / 60}min`);
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const model = options.model || 'sonar';
  const cacheKey = getCacheKey(query, model, options.systemPrompt);

  // Check cache first (skip for very fresh data needs)
  if (options.searchRecency !== 'day') {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  console.log(`[Perplexity] API call: ${model} for "${query.slice(0, 50)}..."`);

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: query });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: options.maxTokens || 1024,
    temperature: options.temperature || 0.2,
    return_citations: true
  };

  if (options.searchRecency) {
    body.search_recency_filter = options.searchRecency;
  }

  const response = await perplexityRequest(body);

  const result: SearchResult = {
    answer: response.choices[0]?.message?.content || '',
    citations: response.citations || [],
    model: response.model,
    tokensUsed: response.usage.total_tokens
  };

  // Cache result (shorter TTL for fresh data)
  const ttl = options.searchRecency === 'week' ? 6 * 60 * 60 * 1000 : CACHE_TTL; // 6h for news
  setCache(cacheKey, result, ttl);

  return result;
}

export async function research(topic: string, options: ResearchOptions = {}): Promise<SearchResult> {
  const depth = options.depth || 'standard';
  const focus = options.focus || 'general';
  const cacheKey = getCacheKey(topic, `research:${depth}:${focus}`);

  // Check cache (skip for news focus)
  if (focus !== 'news') {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  let systemPrompt = '';
  let model: PerplexityModel;
  let maxTokens: number;

  switch (depth) {
    case 'quick':
      model = 'sonar';
      maxTokens = 512;
      systemPrompt = 'Provide a brief, focused answer with key facts only.';
      break;
    case 'deep':
      model = 'sonar-pro';
      maxTokens = 4096;
      systemPrompt = 'Provide comprehensive analysis with multiple perspectives, data points, and citations.';
      break;
    default:
      model = 'sonar-pro';
      maxTokens = 2048;
      systemPrompt = 'Provide a well-structured answer with relevant details and citations.';
  }

  switch (focus) {
    case 'academic':
      systemPrompt += ' Focus on academic sources, research papers, and scholarly analysis.';
      break;
    case 'news':
      systemPrompt += ' Focus on recent news, current events, and latest developments.';
      break;
    case 'code':
      systemPrompt += ' Focus on technical documentation, code examples, and implementation details.';
      break;
  }

  const result = await search(topic, {
    model,
    systemPrompt,
    maxTokens,
    searchRecency: focus === 'news' ? 'week' : undefined
  });

  // Cache research results
  const ttl = focus === 'news' ? 6 * 60 * 60 * 1000 : CACHE_TTL;
  setCache(cacheKey, result, ttl);

  return result;
}

export async function factCheck(claim: string): Promise<FactCheckResult> {
  const cacheKey = getCacheKey(claim, 'factcheck');

  // Fact checks can be cached longer
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    console.log(`[Perplexity] Fact check cache HIT`);
    const cached = cachedEntry.data;
    return {
      verdict: (cached as unknown as FactCheckResult).verdict || 'unverifiable',
      explanation: cached.answer,
      citations: cached.citations,
      cached: true
    };
  }

  const result = await search(
    `Fact check the following claim and provide a verdict (true, false, partially true, or unverifiable): "${claim}"`,
    {
      model: 'sonar-reasoning',
      systemPrompt: 'You are a fact-checker. Analyze claims objectively using reliable sources.',
      temperature: 0.1
    }
  );

  let verdict: FactCheckResult['verdict'] = 'unverifiable';
  const lowerAnswer = result.answer.toLowerCase();

  if (lowerAnswer.includes('verdict: true') || lowerAnswer.includes('is true')) {
    verdict = 'true';
  } else if (lowerAnswer.includes('verdict: false') || lowerAnswer.includes('is false')) {
    verdict = 'false';
  } else if (lowerAnswer.includes('partially true') || lowerAnswer.includes('partly true')) {
    verdict = 'partially_true';
  }

  const factResult: FactCheckResult = { verdict, explanation: result.answer, citations: result.citations };

  // Cache fact checks for 7 days
  cache.set(cacheKey, {
    data: { ...result, verdict } as unknown as SearchResult,
    expiresAt: Date.now() + FACT_CHECK_TTL
  });

  return factResult;
}

export async function summarize(
  url: string,
  options: { maxLength?: number } = {}
): Promise<{ summary: string; citations: string[]; cached?: boolean }> {
  const maxLength = options.maxLength || 500;
  const cacheKey = getCacheKey(url, 'summarize', String(maxLength));

  const cached = getFromCache(cacheKey);
  if (cached) {
    return { summary: cached.answer, citations: cached.citations, cached: true };
  }

  const result = await search(
    `Summarize the main points from this article/page: ${url}`,
    {
      model: 'sonar',
      systemPrompt: `Provide a concise summary in ${maxLength} words or less.`,
      maxTokens: 1024
    }
  );

  setCache(cacheKey, result, CACHE_TTL);

  return { summary: result.answer, citations: result.citations };
}

export async function compare(
  items: string[],
  criteria?: string[]
): Promise<{ comparison: string; citations: string[]; cached?: boolean }> {
  const cacheKey = getCacheKey(items.join('|'), 'compare', criteria?.join('|'));

  const cached = getFromCache(cacheKey);
  if (cached) {
    return { comparison: cached.answer, citations: cached.citations, cached: true };
  }

  let query = `Compare and contrast: ${items.join(' vs ')}`;
  if (criteria?.length) {
    query += `. Focus on these criteria: ${criteria.join(', ')}`;
  }

  const result = await search(query, {
    model: 'sonar-pro',
    systemPrompt: 'Create a structured comparison with clear pros/cons for each option.',
    maxTokens: 2048
  });

  setCache(cacheKey, result, CACHE_TTL);

  return { comparison: result.answer, citations: result.citations };
}

// Cache management
export function getCacheStats(): { size: number; estimatedSavings: number } {
  return {
    size: cache.size,
    estimatedSavings: cache.size * 0.01 // ~$0.01 per cached query
  };
}

export function clearCache(): void {
  cache.clear();
  console.log('[Perplexity] Cache cleared');
}
