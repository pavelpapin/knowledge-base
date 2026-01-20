/**
 * Direct PostgreSQL Connection
 * For raw SQL queries and migrations
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { paths } from '@elio/shared';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('postgres');

let pool: pg.Pool | null = null;

interface SupabaseCredentials {
  url: string;
  anon_key: string;
  service_role_key: string;
  connection_string?: string;
}

function getConnectionString(): string | null {
  try {
    if (!existsSync(paths.credentials.supabase)) {
      logger.warn('Supabase credentials not found');
      return null;
    }

    const creds: SupabaseCredentials = JSON.parse(
      readFileSync(paths.credentials.supabase, 'utf-8')
    );

    return creds.connection_string || null;
  } catch (error) {
    logger.error('Failed to read connection string', { error });
    return null;
  }
}

export function getPool(): pg.Pool | null {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) return null;

  pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    logger.error('Unexpected pool error', { error: err.message });
  });

  logger.info('PostgreSQL pool created');
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const p = getPool();
  if (!p) {
    throw new Error('PostgreSQL not configured');
  }

  const start = Date.now();
  try {
    const result = await p.query(sql, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      sql: sql.substring(0, 100),
      duration,
      rowCount: result.rowCount
    });

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0
    };
  } catch (error) {
    logger.error('Query failed', { sql: sql.substring(0, 100), error });
    throw error;
  }
}

export async function execute(sql: string): Promise<{ success: boolean; message: string }> {
  const p = getPool();
  if (!p) {
    throw new Error('PostgreSQL not configured');
  }

  try {
    await p.query(sql);
    return { success: true, message: 'Executed successfully' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: msg };
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as ok');
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

export function isConfigured(): boolean {
  return getConnectionString() !== null;
}
