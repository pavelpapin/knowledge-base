/**
 * Backlog Repository
 * Data access for CTO/CPO backlog items with Notion sync
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, QueryOptions } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export type BacklogType = 'technical' | 'product';
export type BacklogPriority = 'critical' | 'high' | 'medium' | 'low';
export type BacklogStatus = 'backlog' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
export type BacklogEffort = 'xs' | 's' | 'm' | 'l' | 'xl';
export type BacklogImpact = 'high' | 'medium' | 'low';
export type BacklogSource = 'cto_review' | 'cpo_review' | 'user_feedback' | 'manual' | 'bug_report' | 'correction_log';

export interface BacklogItem {
  id: string;
  title: string;
  description?: string;
  backlog_type: BacklogType;
  category?: string;
  priority: BacklogPriority;
  status: BacklogStatus;
  effort?: BacklogEffort;
  impact?: BacklogImpact;
  source: BacklogSource;
  source_quote?: string;
  notion_page_id?: string;
  notion_db_id?: string;
  notion_synced_at?: string;
  notion_url?: string;
  tags: string[];
  assignee?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface BacklogStats {
  backlog_type: BacklogType;
  total: number;
  backlog: number;
  in_progress: number;
  done: number;
  blocked: number;
  high_priority: number;
}

export class BacklogRepository extends BaseRepository<BacklogItem> {
  constructor(client: SupabaseClient) {
    super(client, 'backlog_items');
  }

  // ============ Query Methods ============

  async getByType(type: BacklogType, options: QueryOptions = {}): Promise<BacklogItem[]> {
    return this.findBy({ backlog_type: type }, {
      orderBy: 'priority',
      orderAsc: true,
      ...options
    });
  }

  async getTechnical(options: QueryOptions = {}): Promise<BacklogItem[]> {
    return this.getByType('technical', options);
  }

  async getProduct(options: QueryOptions = {}): Promise<BacklogItem[]> {
    return this.getByType('product', options);
  }

  async getActive(type?: BacklogType): Promise<BacklogItem[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .not('status', 'in', '("done","cancelled")')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('backlog_type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as BacklogItem[]) || [];
  }

  async getByStatus(status: BacklogStatus, type?: BacklogType): Promise<BacklogItem[]> {
    const filters: Record<string, string> = { status };
    if (type) {
      filters.backlog_type = type;
    }
    return this.findBy(filters, {
      orderBy: 'priority',
      orderAsc: true
    });
  }

  async getHighPriority(type?: BacklogType): Promise<BacklogItem[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .in('priority', ['critical', 'high'])
      .not('status', 'in', '("done","cancelled")')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('backlog_type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as BacklogItem[]) || [];
  }

  async getByCategory(category: string, type?: BacklogType): Promise<BacklogItem[]> {
    const filters: Record<string, string> = { category };
    if (type) {
      filters.backlog_type = type;
    }
    return this.findBy(filters);
  }

  async getBySource(source: BacklogSource, type?: BacklogType): Promise<BacklogItem[]> {
    const filters: Record<string, string> = { source };
    if (type) {
      filters.backlog_type = type;
    }
    return this.findBy(filters);
  }

  // ============ Notion Sync Methods ============

  async getByNotionPageId(notionPageId: string): Promise<BacklogItem | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('notion_page_id', notionPageId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new DatabaseError(error.message, error.code);
    }
    return data as BacklogItem | null;
  }

  async getUnsyncedItems(type?: BacklogType): Promise<BacklogItem[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .is('notion_page_id', null)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('backlog_type', type);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as BacklogItem[]) || [];
  }

  async getStaleItems(olderThanHours: number = 24): Promise<BacklogItem[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .not('notion_page_id', 'is', null)
      .or(`notion_synced_at.is.null,notion_synced_at.lt.${cutoff}`)
      .order('notion_synced_at', { ascending: true, nullsFirst: true });

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as BacklogItem[]) || [];
  }

  async updateNotionSync(
    id: string,
    notionPageId: string,
    notionDbId: string,
    notionUrl?: string
  ): Promise<BacklogItem> {
    return this.update(id, {
      notion_page_id: notionPageId,
      notion_db_id: notionDbId,
      notion_url: notionUrl,
      notion_synced_at: new Date().toISOString()
    });
  }

  async markSynced(id: string): Promise<BacklogItem> {
    return this.update(id, {
      notion_synced_at: new Date().toISOString()
    });
  }

  // ============ Create/Update Methods ============

  async createItem(
    title: string,
    type: BacklogType,
    options: Partial<Omit<BacklogItem, 'id' | 'created_at' | 'updated_at' | 'title' | 'backlog_type'>> = {}
  ): Promise<BacklogItem> {
    return this.create({
      title,
      backlog_type: type,
      priority: options.priority || 'medium',
      status: options.status || 'backlog',
      source: options.source || 'manual',
      description: options.description,
      category: options.category,
      effort: options.effort,
      impact: options.impact,
      source_quote: options.source_quote,
      tags: options.tags || [],
      assignee: options.assignee,
      updated_at: new Date().toISOString()
    });
  }

  async createTechnicalItem(
    title: string,
    options: Partial<Omit<BacklogItem, 'id' | 'created_at' | 'updated_at' | 'title' | 'backlog_type'>> = {}
  ): Promise<BacklogItem> {
    return this.createItem(title, 'technical', {
      source: 'cto_review',
      ...options
    });
  }

  async createProductItem(
    title: string,
    options: Partial<Omit<BacklogItem, 'id' | 'created_at' | 'updated_at' | 'title' | 'backlog_type'>> = {}
  ): Promise<BacklogItem> {
    return this.createItem(title, 'product', {
      source: 'cpo_review',
      ...options
    });
  }

  // ============ Status Methods ============

  async startWork(id: string): Promise<BacklogItem> {
    return this.update(id, { status: 'in_progress' });
  }

  async complete(id: string): Promise<BacklogItem> {
    return this.update(id, {
      status: 'done',
      completed_at: new Date().toISOString()
    });
  }

  async block(id: string): Promise<BacklogItem> {
    return this.update(id, { status: 'blocked' });
  }

  async cancel(id: string): Promise<BacklogItem> {
    return this.update(id, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });
  }

  async setPriority(id: string, priority: BacklogPriority): Promise<BacklogItem> {
    return this.update(id, { priority });
  }

  // ============ Stats ============

  async getStats(): Promise<BacklogStats[]> {
    const { data, error } = await this.client
      .from('backlog_stats')
      .select('*');

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as BacklogStats[]) || [];
  }

  async getStatsByType(type: BacklogType): Promise<BacklogStats | null> {
    const stats = await this.getStats();
    return stats.find(s => s.backlog_type === type) || null;
  }
}
