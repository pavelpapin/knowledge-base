/**
 * State Repository
 * Key-value store for system state
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '../errors/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('state-repo');

export interface SystemState {
  key: string;
  value: unknown;
  updated_at: string;
}

export class StateRepository {
  constructor(private client: SupabaseClient) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const { data, error } = await this.client
      .from('system_state')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(error.message, error.code);
    }

    return data?.value as T;
  }

  async getOrDefault<T = unknown>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value ?? defaultValue;
  }

  async set(key: string, value: unknown): Promise<void> {
    const { error } = await this.client
      .from('system_state')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      });

    if (error) {
      logger.error(`Failed to set state: ${key}`, error);
      throw new DatabaseError(error.message, error.code);
    }
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client
      .from('system_state')
      .delete()
      .eq('key', key);

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
  }

  async getAll(): Promise<SystemState[]> {
    const { data, error } = await this.client
      .from('system_state')
      .select('*')
      .order('key', { ascending: true });

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }

    return (data as SystemState[]) || [];
  }

  async getKeys(prefix?: string): Promise<string[]> {
    let query = this.client
      .from('system_state')
      .select('key');

    if (prefix) {
      query = query.like('key', `${prefix}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }

    return (data || []).map(d => d.key);
  }

  async increment(key: string, amount = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + amount;
    await this.set(key, newValue);
    return newValue;
  }

  async setIfNotExists(key: string, value: unknown): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) {
      return false;
    }
    await this.set(key, value);
    return true;
  }

  async setWithExpiry(key: string, value: unknown, expiresInMs: number): Promise<void> {
    await this.set(key, {
      value,
      expires_at: new Date(Date.now() + expiresInMs).toISOString()
    });
  }

  async getWithExpiry<T = unknown>(key: string): Promise<T | null> {
    const data = await this.get<{ value: T; expires_at: string }>(key);
    if (!data) return null;

    if (new Date(data.expires_at) < new Date()) {
      await this.delete(key);
      return null;
    }

    return data.value;
  }
}
