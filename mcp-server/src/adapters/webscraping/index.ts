/**
 * Web Scraping Adapter
 * Exposes Jina Reader, DuckDuckGo, Google News as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import {
  jinaReader,
  duckduckgoSearch,
  duckduckgoNews,
  googleNewsRss,
  combinedSearch
} from '../../integrations/webscraping/index.js';

const jinaSchema = z.object({
  url: z.string().describe('URL to extract content from')
});

const searchSchema = z.object({
  query: z.string().describe('Search query'),
  num_results: z.number().optional().default(10).describe('Number of results')
});

const newsSchema = z.object({
  query: z.string().describe('News search query'),
  num_results: z.number().optional().default(10).describe('Number of results')
});

const combinedSchema = z.object({
  query: z.string().describe('Search query'),
  include_news: z.boolean().optional().default(true).describe('Include news results'),
  num_results: z.number().optional().default(10).describe('Number of results per source')
});

const tools: AdapterTool[] = [
  {
    name: 'jina_reader',
    description: 'Extract clean markdown content from any URL using Jina Reader (free, 1M tokens/month)',
    type: 'read',
    schema: jinaSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof jinaSchema>;
      const result = await jinaReader(p.url);
      if (!result.success) {
        return JSON.stringify({ error: result.error });
      }
      return result.content;
    }
  },
  {
    name: 'ddg_search',
    description: 'Search the web using DuckDuckGo (free, unlimited)',
    type: 'read',
    schema: searchSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof searchSchema>;
      const results = await duckduckgoSearch(p.query, p.num_results);
      return JSON.stringify(results, null, 2);
    }
  },
  {
    name: 'ddg_news',
    description: 'Search news using DuckDuckGo (free, unlimited)',
    type: 'read',
    schema: newsSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof newsSchema>;
      const results = await duckduckgoNews(p.query, p.num_results);
      return JSON.stringify(results, null, 2);
    }
  },
  {
    name: 'google_news',
    description: 'Get news from Google News RSS feed (free, unlimited)',
    type: 'read',
    schema: newsSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof newsSchema>;
      const results = await googleNewsRss(p.query, p.num_results);
      return JSON.stringify(results, null, 2);
    }
  },
  {
    name: 'web_research',
    description: 'Combined search across DuckDuckGo and Google News',
    type: 'read',
    schema: combinedSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof combinedSchema>;
      const results = await combinedSearch(p.query, {
        includeNews: p.include_news,
        maxResults: p.num_results
      });
      return JSON.stringify(results, null, 2);
    }
  }
];

// Always available (no API key needed)
function isAuthenticated(): boolean {
  return true;
}

export const webscrapingAdapter: Adapter = {
  name: 'webscraping',
  isAuthenticated,
  tools
};
