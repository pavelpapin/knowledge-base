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

  /** Logs directory */
  logs: path.join(ELIO_ROOT, 'logs'),

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
