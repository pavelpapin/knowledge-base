/**
 * Message Repository
 * Data access for inbox messages
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, QueryOptions } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export type MessageSource = 'telegram' | 'email' | 'slack' | 'web';

export interface Message {
  id: string;
  source: MessageSource;
  external_id: string;
  sender: string;
  content: string;
  metadata: Record<string, unknown>;
  processed: boolean;
  processed_at?: string;
  action_taken?: string;
  created_at: string;
}

export class MessageRepository extends BaseRepository<Message> {
  constructor(client: SupabaseClient) {
    super(client, 'messages');
  }

  async getUnprocessed(source?: MessageSource, options: QueryOptions = {}): Promise<Message[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true });

    if (source) {
      query = query.eq('source', source);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Message[]) || [];
  }

  async getBySource(source: MessageSource, options: QueryOptions = {}): Promise<Message[]> {
    return this.findBy({ source }, {
      orderBy: 'created_at',
      orderAsc: false,
      ...options
    });
  }

  async getBySender(sender: string, options: QueryOptions = {}): Promise<Message[]> {
    return this.findBy({ sender }, {
      orderBy: 'created_at',
      orderAsc: false,
      ...options
    });
  }

  async findByExternalId(source: MessageSource, externalId: string): Promise<Message | null> {
    return this.findOne({ source, external_id: externalId });
  }

  async saveMessage(
    source: MessageSource,
    externalId: string,
    sender: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<Message> {
    // Check if message already exists
    const existing = await this.findByExternalId(source, externalId);
    if (existing) {
      return existing;
    }

    return this.create({
      source,
      external_id: externalId,
      sender,
      content,
      metadata,
      processed: false
    });
  }

  async markProcessed(id: string, actionTaken?: string): Promise<Message> {
    return this.update(id, {
      processed: true,
      processed_at: new Date().toISOString(),
      action_taken: actionTaken
    });
  }

  async getUnprocessedCount(source?: MessageSource): Promise<number> {
    const filters: Record<string, unknown> = { processed: false };
    if (source) {
      filters.source = source;
    }
    return this.count(filters);
  }

  async getRecentBySender(sender: string, limit = 10): Promise<Message[]> {
    return this.findBy({ sender }, {
      orderBy: 'created_at',
      orderAsc: false,
      limit
    });
  }
}
