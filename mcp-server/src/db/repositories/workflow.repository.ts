/**
 * Workflow Repository
 * Data access for workflow runs
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, QueryOptions } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowRun {
  id: string;
  workflow_name: string;
  trigger: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
}

export interface RunStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  cancelled: number;
  avgDurationMs?: number;
}

export class WorkflowRepository extends BaseRepository<WorkflowRun> {
  constructor(client: SupabaseClient) {
    super(client, 'workflow_runs');
  }

  async getByStatus(status: RunStatus, options: QueryOptions = {}): Promise<WorkflowRun[]> {
    return this.findBy({ status }, {
      orderBy: 'created_at',
      orderAsc: false,
      ...options
    });
  }

  async getByWorkflow(workflowName: string, options: QueryOptions = {}): Promise<WorkflowRun[]> {
    return this.findBy({ workflow_name: workflowName }, {
      orderBy: 'created_at',
      orderAsc: false,
      ...options
    });
  }

  async getRecent(limit = 50): Promise<WorkflowRun[]> {
    return this.findAll({
      orderBy: 'created_at',
      orderAsc: false,
      limit
    });
  }

  async getSince(since: string, options: QueryOptions = {}): Promise<WorkflowRun[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as WorkflowRun[]) || [];
  }

  async getStats(since?: string): Promise<RunStats> {
    let query = this.client
      .from(this.tableName)
      .select('status, duration_ms');

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }

    const runs = data || [];
    const durations = runs
      .filter(r => r.duration_ms !== null)
      .map(r => r.duration_ms as number);

    return {
      total: runs.length,
      completed: runs.filter(r => r.status === 'completed').length,
      failed: runs.filter(r => r.status === 'failed').length,
      running: runs.filter(r => r.status === 'running').length,
      pending: runs.filter(r => r.status === 'pending').length,
      cancelled: runs.filter(r => r.status === 'cancelled').length,
      avgDurationMs: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : undefined
    };
  }

  async startRun(workflowName: string, trigger: string, input: Record<string, unknown> = {}): Promise<WorkflowRun> {
    return this.create({
      workflow_name: workflowName,
      trigger,
      status: 'running',
      input,
      started_at: new Date().toISOString()
    });
  }

  async completeRun(id: string, output: Record<string, unknown> = {}): Promise<WorkflowRun> {
    return this.update(id, {
      status: 'completed',
      output,
      completed_at: new Date().toISOString()
    });
  }

  async failRun(id: string, error: string): Promise<WorkflowRun> {
    return this.update(id, {
      status: 'failed',
      error,
      completed_at: new Date().toISOString()
    });
  }

  async cancelRun(id: string): Promise<WorkflowRun> {
    return this.update(id, {
      status: 'cancelled',
      completed_at: new Date().toISOString()
    });
  }
}
