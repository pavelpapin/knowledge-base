/**
 * Perplexity tools
 */

import * as perplexity from '../integrations/perplexity.js';
import { Tool, paramString } from './types.js';

export const perplexityTools: Tool[] = [
  {
    name: 'perplexity_search',
    description: 'AI-powered web search via Perplexity',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        depth: { type: 'string', description: 'quick, standard, or deep' }
      },
      required: ['query']
    },
    handler: async (params) => {
      const depth = (params.depth as 'quick' | 'standard' | 'deep') || 'standard';
      const result = await perplexity.research(paramString(params.query), { depth });
      return `${result.answer}\n\nSources:\n${result.citations.join('\n')}`;
    }
  },
  {
    name: 'perplexity_factcheck',
    description: 'Fact-check a claim',
    inputSchema: {
      type: 'object',
      properties: { claim: { type: 'string' } },
      required: ['claim']
    },
    handler: async (params) => {
      const result = await perplexity.factCheck(paramString(params.claim));
      return `Verdict: ${result.verdict}\n\n${result.explanation}\n\nSources:\n${result.citations.join('\n')}`;
    }
  }
];
