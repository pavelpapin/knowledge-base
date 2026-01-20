/**
 * Supabase Client
 * Singleton client with credentials management
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { paths } from '@elio/shared';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('supabase');

interface SupabaseCredentials {
  url: string;
  anon_key: string;
  service_role_key?: string;
}

const CREDENTIALS_PATH = paths.credentials.supabase;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | null = null;

export function loadCredentials(): SupabaseCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    logger.error('Failed to parse Supabase credentials');
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getClient(): SupabaseClient<any> | null {
  if (client) return client;

  const creds = loadCredentials();
  if (!creds) {
    logger.warn('Supabase not configured');
    return null;
  }

  // Use service role key if available for server-side operations
  const key = creds.service_role_key || creds.anon_key;

  client = createClient(creds.url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  logger.info('Supabase client initialized');
  return client;
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
Supabase Setup:
1. Create project at https://supabase.com
2. Go to Project Settings > API
3. Create ${CREDENTIALS_PATH} with:
{
  "url": "https://your-project.supabase.co",
  "anon_key": "your-anon-key",
  "service_role_key": "your-service-role-key"
}
4. Run migrations to create tables
`;
}
