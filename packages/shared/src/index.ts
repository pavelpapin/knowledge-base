/**
 * Shared utilities and paths for Elio OS
 */

import * as path from 'path'
import * as os from 'os'

// Re-export logger
export {
  createLogger,
  logger,
  setLevel,
  setJsonOutput,
  setFileLogging,
  type Logger,
  type LogLevel,
} from './logger.js'

// Re-export store
export { createStore, type Store } from './store.js'

/**
 * Root directory for Elio OS
 */
export const ELIO_ROOT = process.env.ELIO_ROOT || path.join(os.homedir(), '.claude')

/**
 * Standard paths in Elio OS
 */
export const paths = {
  /** Root directory */
  root: ELIO_ROOT,

  /** Base directory (alias for root) */
  base: ELIO_ROOT,

  /** Skills directory */
  skills: path.join(ELIO_ROOT, 'skills'),

  /** Workflows directory */
  workflows: path.join(ELIO_ROOT, 'workflows'),

  /** Agents directory */
  agents: path.join(ELIO_ROOT, 'agents'),

  /** Context directory */
  context: path.join(ELIO_ROOT, 'context'),

  /** Secrets directory */
  secrets: path.join(ELIO_ROOT, 'secrets'),

  /** Credentials paths */
  credentials: {
    /** Base credentials directory */
    dir: path.join(ELIO_ROOT, 'secrets'),
    /** Google OAuth credentials */
    google: path.join(ELIO_ROOT, 'secrets', 'google-credentials.json'),
    /** Google OAuth token */
    googleToken: path.join(ELIO_ROOT, 'secrets', 'google-token.json'),
    /** Perplexity API key file */
    perplexity: path.join(ELIO_ROOT, 'secrets', 'perplexity.json'),
    /** Supabase credentials */
    supabase: path.join(ELIO_ROOT, 'secrets', 'supabase.json'),
  },

  /** Data paths */
  data: {
    /** Base data directory */
    dir: path.join(ELIO_ROOT, 'data'),
    /** NotebookLM sources */
    notebooklmSources: path.join(ELIO_ROOT, 'data', 'notebooklm-sources'),
    /** Scheduler data */
    scheduler: path.join(ELIO_ROOT, 'data', 'scheduler'),
    /** GTD data */
    gtd: path.join(ELIO_ROOT, 'data', 'gtd'),
    /** Headless data */
    headless: path.join(ELIO_ROOT, 'data', 'headless'),
    /** Context graph data */
    contextGraph: path.join(ELIO_ROOT, 'data', 'context-graph'),
    /** Self improvement data */
    selfImprovement: path.join(ELIO_ROOT, 'data', 'self-improvement'),
  },

  /** Log paths */
  logs: {
    /** Base logs directory */
    dir: path.join(ELIO_ROOT, 'logs'),
    /** Scheduler logs */
    scheduler: path.join(ELIO_ROOT, 'logs', 'scheduler'),
    /** Daily logs */
    daily: path.join(ELIO_ROOT, 'logs', 'daily'),
    /** Team logs */
    team: path.join(ELIO_ROOT, 'logs', 'team'),
  },

  /** MCP server directory */
  mcpServer: path.join(ELIO_ROOT, 'mcp-server'),

  /** Packages directory */
  packages: path.join(ELIO_ROOT, 'packages'),

  /** Apps directory */
  apps: path.join(ELIO_ROOT, 'apps'),

  /** Config directory */
  config: path.join(ELIO_ROOT, 'config'),

  /** Core directory */
  core: path.join(ELIO_ROOT, 'core'),

  /** CLAUDE.md file */
  claudeMd: path.join(ELIO_ROOT, 'CLAUDE.md'),

  /** Team directory */
  team: path.join(ELIO_ROOT, 'team'),
} as const

/**
 * Get path relative to Elio root
 */
export function elioPath(...segments: string[]): string {
  return path.join(ELIO_ROOT, ...segments)
}

/**
 * Environment helpers
 */
export const env = {
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  nodeEnv: process.env.NODE_ENV || 'development',
}
