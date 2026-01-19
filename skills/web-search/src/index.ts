/**
 * Web Search Skill
 * Searches the web using Serper (paid) or DuckDuckGo (free)
 */

import * as fs from 'fs';
import * as path from 'path';
import { SearchResponse, SearchOptions } from './types';
import { searchSerper } from './providers/serper';
import { searchDuckDuckGo } from './providers/duckduckgo';

const CREDENTIALS_PATH = '/root/.claude/.credentials.json';

interface Credentials {
  serper_api_key?: string;
}

function loadCredentials(): Credentials {
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

async function search(options: SearchOptions): Promise<SearchResponse> {
  const { query, numResults = 10, site } = options;
  const credentials = loadCredentials();

  // Try Serper first if API key available
  if (credentials.serper_api_key) {
    try {
      const results = await searchSerper(options, credentials.serper_api_key);
      return {
        query,
        results,
        total: results.length,
        source: 'serper'
      };
    } catch (error) {
      console.error('[web-search] Serper failed, falling back to DDG:', error);
    }
  }

  // Fallback to DuckDuckGo
  try {
    const searchQuery = site ? `${query} site:${site}` : query;
    const results = await searchDuckDuckGo(searchQuery, numResults);
    return {
      query,
      results,
      total: results.length,
      source: 'duckduckgo'
    };
  } catch (error) {
    console.error('[web-search] DuckDuckGo failed:', error);
    return {
      query,
      results: [],
      total: 0,
      source: 'fallback'
    };
  }
}

// CLI entry point
async function main() {
  const query = process.argv[2];
  const numResults = parseInt(process.argv[3] || '10', 10);
  const site = process.argv[4];

  if (!query) {
    console.error(JSON.stringify({ error: 'Query is required' }));
    process.exit(1);
  }

  const result = await search({ query, numResults, site });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});

export { search, SearchResponse, SearchOptions };
