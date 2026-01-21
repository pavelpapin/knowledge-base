/**
 * Database Layer
 * Main entry point for database operations
 */

import { getClient } from '../integrations/supabase/client.js';
import { getRepositories, Repositories, resetRepositories } from './repositories/index.js';
import { getCache, resetCache, Cache } from './cache/index.js';
import { createLogger } from '../utils/logger.js';

export * from './repositories/index.js';
export * from './cache/index.js';
export * from './errors/index.js';

const logger = createLogger('db');

let db: Database | null = null;

export class Database {
  private _repos: Repositories | null = null;
  private _cache: Cache;

  constructor() {
    this._cache = getCache();
  }

  get repos(): Repositories {
    if (!this._repos) {
      const client = getClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Check credentials.');
      }
      this._repos = getRepositories(client);
    }
    return this._repos;
  }

  get cache(): Cache {
    return this._cache;
  }

  // Convenience accessors
  get workflow() { return this.repos.workflow; }
  get schedule() { return this.repos.schedule; }
  get message() { return this.repos.message; }
  get task() { return this.repos.task; }
  get person() { return this.repos.person; }
  get audit() { return this.repos.audit; }
  get state() { return this.repos.state; }
  get backlog() { return this.repos.backlog; }

  async healthCheck(): Promise<boolean> {
    try {
      const client = getClient();
      if (!client) return false;

      const { error } = await client
        .from('system_state')
        .select('key')
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  invalidateCache(pattern?: string): void {
    if (pattern) {
      this._cache.invalidatePattern(pattern);
    } else {
      this._cache.clear();
    }
  }

  reset(): void {
    this._repos = null;
    resetRepositories();
    resetCache();
    logger.info('Database layer reset');
  }
}

export function getDb(): Database {
  if (!db) {
    db = new Database();
  }
  return db;
}

export function resetDb(): void {
  if (db) {
    db.reset();
  }
  db = null;
}

// Quick access functions
export const workflow = () => getDb().workflow;
export const schedule = () => getDb().schedule;
export const message = () => getDb().message;
export const task = () => getDb().task;
export const person = () => getDb().person;
export const audit = () => getDb().audit;
export const state = () => getDb().state;
export const backlog = () => getDb().backlog;
export const cache = () => getDb().cache;
