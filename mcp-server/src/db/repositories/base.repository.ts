/**
 * Base Repository
 * Abstract base class for all repositories with CRUD operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '../errors/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('repository');

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderAsc?: boolean;
}

export interface FilterOptions {
  [key: string]: unknown;
}

export abstract class BaseRepository<T extends { id: string }> {
  protected logger = logger;

  constructor(
    protected client: SupabaseClient,
    protected tableName: string
  ) {}

  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new DatabaseError(error.message, error.code);
    }
    return data as T;
  }

  async findByIdOrFail(id: string): Promise<T> {
    const result = await this.findById(id);
    if (!result) {
      throw new NotFoundError(this.tableName, id);
    }
    return result;
  }

  async findAll(options: QueryOptions = {}): Promise<T[]> {
    let query = this.client.from(this.tableName).select('*');

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderAsc ?? false });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as T[]) || [];
  }

  async findBy(filters: FilterOptions, options: QueryOptions = {}): Promise<T[]> {
    let query = this.client.from(this.tableName).select('*');

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    if (options.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderAsc ?? false });
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as T[]) || [];
  }

  async findOne(filters: FilterOptions): Promise<T | null> {
    const results = await this.findBy(filters, { limit: 1 });
    return results[0] || null;
  }

  async create(entity: Omit<T, 'id' | 'created_at'>): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(entity)
      .select()
      .single();

    if (error) {
      this.logger.error(`Create failed in ${this.tableName}`, error);
      throw new DatabaseError(error.message, error.code);
    }
    return data as T;
  }

  async createMany(entities: Array<Omit<T, 'id' | 'created_at'>>): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(entities)
      .select();

    if (error) {
      this.logger.error(`Batch create failed in ${this.tableName}`, error);
      throw new DatabaseError(error.message, error.code);
    }
    return (data as T[]) || [];
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Update failed in ${this.tableName}`, error);
      throw new DatabaseError(error.message, error.code);
    }
    return data as T;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      this.logger.error(`Delete failed in ${this.tableName}`, error);
      throw new DatabaseError(error.message, error.code);
    }
    return true;
  }

  async count(filters: FilterOptions = {}): Promise<number> {
    let query = this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { count, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return count || 0;
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.findById(id);
    return result !== null;
  }
}
