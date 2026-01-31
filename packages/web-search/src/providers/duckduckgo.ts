/**
 * DuckDuckGo Instant Answer API (free, no key)
 * Fallback when no Serper API key
 */

import { SearchResult } from '../types.js';

const DDG_API_URL = 'https://api.duckduckgo.com/';

interface DDGResponse {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

export async function searchDuckDuckGo(
  query: string,
  numResults: number = 10
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    skip_disambig: '1'
  });

  const response = await fetch(`${DDG_API_URL}?${params}`);

  if (!response.ok) {
    throw new Error(`DuckDuckGo API error: ${response.status}`);
  }

  const data = await response.json() as DDGResponse;
  const results: SearchResult[] = [];

  // Main result
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
      position: 1
    });
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, numResults - 1)) {
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text,
          url: topic.FirstURL,
          snippet: topic.Text,
          position: results.length + 1
        });
      }
    }
  }

  return results.slice(0, numResults);
}
