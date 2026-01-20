/**
 * LinkedIn Adapter
 * Exposes LinkedIn data as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as linkedin from '../../integrations/linkedin/index.js';

const profileSchema = z.object({
  url: z.string().describe('LinkedIn profile URL')
});

const searchSchema = z.object({
  keywords: z.string().describe('Search keywords'),
  title: z.string().optional().describe('Job title filter'),
  company: z.string().optional().describe('Company filter')
});

const tools: AdapterTool[] = [
  {
    name: 'profile',
    description: 'Get LinkedIn profile by URL',
    type: 'read',
    schema: profileSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof profileSchema>;
      const profile = await linkedin.getProfile(p.url);
      return JSON.stringify(profile, null, 2);
    }
  },
  {
    name: 'search',
    description: 'Search LinkedIn people',
    type: 'read',
    schema: searchSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof searchSchema>;
      const results = await linkedin.searchPeople(p.keywords, { title: p.title, currentCompany: p.company });
      return JSON.stringify(results, null, 2);
    }
  }
];

export const linkedinAdapter: Adapter = {
  name: 'linkedin',
  isAuthenticated: linkedin.isAuthenticated,
  tools
};
