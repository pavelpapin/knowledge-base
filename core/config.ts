/**
 * Centralized Configuration
 * All paths and environment settings in one place
 */

import { join } from 'path';

// Base directory - can be overridden via env
const BASE_DIR = process.env.ELIO_BASE_DIR || '/root/.claude';

export const paths = {
  base: BASE_DIR,

  // Secrets
  secrets: join(BASE_DIR, 'secrets'),

  // Skills
  skills: join(BASE_DIR, 'skills'),

  // Data stores
  data: {
    headless: join(BASE_DIR, 'headless/data/store.json'),
    gtd: join(BASE_DIR, 'gtd/data/tasks.json'),
    contextGraph: join(BASE_DIR, 'context-graph/data/graph.json'),
    selfImprovement: join(BASE_DIR, 'self-improvement/data/store.json'),
    notebooklm: join(BASE_DIR, 'mcp-server/data/notebooklm/notebooks.json'),
    notebooklmSources: join(BASE_DIR, 'notebooklm/sources'),
    scheduler: join(BASE_DIR, 'scheduler/jobs.json'),
    researchOutputs: join(BASE_DIR, 'research-outputs'),
  },

  // Credentials
  credentials: {
    google: join(BASE_DIR, 'secrets/google-credentials.json'),
    googleToken: join(BASE_DIR, 'secrets/google-token.json'),
    telegram: join(BASE_DIR, 'secrets/telegram.json'),
    slack: join(BASE_DIR, 'secrets/slack.json'),
    notion: join(BASE_DIR, 'secrets/notion-token.json'),
    perplexity: join(BASE_DIR, 'secrets/perplexity-token.json'),
    linkedin: join(BASE_DIR, 'secrets/linkedin-credentials.json'),
    n8n: join(BASE_DIR, 'secrets/n8n-credentials.json'),
    webSearch: join(BASE_DIR, '.credentials.json'),
    supabase: join(BASE_DIR, 'secrets/supabase.json'),
  },

  // Config files
  claudeMd: join(BASE_DIR, 'CLAUDE.md'),

  // Logs
  logs: {
    base: join(BASE_DIR, 'logs'),
    daily: join(BASE_DIR, 'logs/daily'),
    skills: join(BASE_DIR, 'logs/skills'),
    corrections: join(BASE_DIR, 'logs/corrections'),
    scheduler: join(BASE_DIR, 'scheduler/logs'),
  },

  // Context
  context: {
    base: join(BASE_DIR, 'context'),
    people: join(BASE_DIR, 'context/people'),
    companies: join(BASE_DIR, 'context/companies'),
    projects: join(BASE_DIR, 'context/projects'),
  },
} as const;

// Re-export for convenience
export const SECRETS_DIR = paths.secrets;
export const SKILLS_DIR = paths.skills;
export const BASE_PATH = BASE_DIR;
