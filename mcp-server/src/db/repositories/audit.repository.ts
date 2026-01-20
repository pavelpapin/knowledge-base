/**
 * Audit Repository
 * Data access for audit logs - security and tracking
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, QueryOptions } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export type AuditResult = 'success' | 'failure' | 'blocked';

export interface AuditLog {
  id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  user_id?: string;
  details: Record<string, unknown>;
  result: AuditResult;
  timestamp: string;
}

export class AuditRepository extends BaseRepository<AuditLog> {
  constructor(client: SupabaseClient) {
    super(client, 'audit_log');
  }

  async log(
    action: string,
    result: AuditResult,
    details: Record<string, unknown> = {},
    options: {
      resourceType?: string;
      resourceId?: string;
      userId?: string;
    } = {}
  ): Promise<AuditLog> {
    return this.create({
      action,
      result,
      details: this.redactSensitive(details),
      resource_type: options.resourceType,
      resource_id: options.resourceId,
      user_id: options.userId,
      timestamp: new Date().toISOString()
    });
  }

  async getByAction(action: string, options: QueryOptions = {}): Promise<AuditLog[]> {
    return this.findBy({ action }, {
      orderBy: 'timestamp',
      orderAsc: false,
      ...options
    });
  }

  async getByResource(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    return this.findBy(
      { resource_type: resourceType, resource_id: resourceId },
      { orderBy: 'timestamp', orderAsc: false }
    );
  }

  async getRecent(limit = 100): Promise<AuditLog[]> {
    return this.findAll({
      orderBy: 'timestamp',
      orderAsc: false,
      limit
    });
  }

  async getFailures(since?: string, options: QueryOptions = {}): Promise<AuditLog[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .in('result', ['failure', 'blocked'])
      .order('timestamp', { ascending: false });

    if (since) {
      query = query.gte('timestamp', since);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as AuditLog[]) || [];
  }

  async getSummary(since: string): Promise<{
    total: number;
    success: number;
    failure: number;
    blocked: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('action, result')
      .gte('timestamp', since);

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }

    const logs = data || [];

    // Count by action
    const actionCounts: Record<string, number> = {};
    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    }

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: logs.length,
      success: logs.filter(l => l.result === 'success').length,
      failure: logs.filter(l => l.result === 'failure').length,
      blocked: logs.filter(l => l.result === 'blocked').length,
      topActions
    };
  }

  private redactSensitive(details: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.redactSensitive(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
