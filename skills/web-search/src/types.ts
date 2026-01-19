/**
 * Web Search Types
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  source: 'serper' | 'duckduckgo' | 'fallback';
}

export interface SerperResponse {
  organic: Array<{
    title: string;
    link: string;
    snippet: string;
    position: number;
  }>;
  searchParameters: {
    q: string;
  };
}

export interface SearchOptions {
  query: string;
  numResults?: number;
  site?: string;
}
