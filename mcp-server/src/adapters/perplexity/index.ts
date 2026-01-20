/**
 * Perplexity Adapter
 * Exposes Perplexity AI search as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as perplexity from '../../integrations/perplexity/index.js';

const searchSchema = z.object({
  query: z.string().describe('Search query'),
  depth: z.enum(['quick', 'standard', 'deep']).optional().describe('Search depth')
});

const factcheckSchema = z.object({
  claim: z.string().describe('Claim to fact-check')
});

const tools: AdapterTool[] = [
  {
    name: 'search',
    description: 'AI-powered web search via Perplexity',
    type: 'read',
    schema: searchSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof searchSchema>;
      const result = await perplexity.research(p.query, { depth: p.depth });
      return JSON.stringify(result, null, 2);
    }
  },
  {
    name: 'factcheck',
    description: 'Fact-check a claim',
    type: 'read',
    schema: factcheckSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof factcheckSchema>;
      const result = await perplexity.factCheck(p.claim);
      return JSON.stringify(result, null, 2);
    }
  }
];

export const perplexityAdapter: Adapter = {
  name: 'perplexity',
  isAuthenticated: perplexity.isAuthenticated,
  tools
};
