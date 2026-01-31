/**
 * Serper.dev API Provider
 * https://serper.dev - Google Search API
 */

import { SearchResult, SerperResponse, SearchOptions } from '../types.js';

const SERPER_API_URL = 'https://google.serper.dev/search';

export async function searchSerper(
  options: SearchOptions,
  apiKey: string
): Promise<SearchResult[]> {
  const { query, numResults = 10, site } = options;

  const searchQuery = site ? `${query} site:${site}` : query;

  const response = await fetch(SERPER_API_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: searchQuery,
      num: numResults
    })
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json() as SerperResponse;

  return (data.organic || []).map((item: any, index: number) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
    position: item.position || index + 1
  }));
}
