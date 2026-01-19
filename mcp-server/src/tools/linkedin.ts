/**
 * LinkedIn tools
 */

import * as linkedin from '../integrations/linkedin/index.js';
import { Tool, paramString } from './types.js';

export const linkedinTools: Tool[] = [
  {
    name: 'linkedin_profile',
    description: 'Get LinkedIn profile by URL',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    },
    handler: async (params) => {
      const profile = await linkedin.getProfile(paramString(params.url));
      if (!profile) return 'Profile not found';
      const company = profile.currentCompany || '';
      const title = profile.currentTitle || '';
      return `${profile.firstName} ${profile.lastName}\n${profile.headline}\n${profile.location}\n${company} - ${title}`;
    }
  },
  {
    name: 'linkedin_search',
    description: 'Search LinkedIn people',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: { type: 'string' },
        company: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['keywords']
    },
    handler: async (params) => {
      const results = await linkedin.searchPeople(paramString(params.keywords), {
        currentCompany: params.company ? paramString(params.company) : undefined,
        title: params.title ? paramString(params.title) : undefined
      });
      if (!results.profiles.length) return 'No results';
      return results.profiles
        .map(p => `${p.firstName} ${p.lastName} - ${p.headline}\n${p.profileUrl}`)
        .join('\n\n');
    }
  }
];
