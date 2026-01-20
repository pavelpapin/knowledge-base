/**
 * Schedule Repository
 * Data access for scheduled tasks
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'cron';

export interface ScheduledTask {
  id: string;
  name: string;
  workflow_name: string;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  next_run_at: string;
  last_run_at?: string;
  last_run_id?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class ScheduleRepository extends BaseRepository<ScheduledTask> {
  constructor(client: SupabaseClient) {
    super(client, 'scheduled_tasks');
  }

  async getEnabled(): Promise<ScheduledTask[]> {
    return this.findBy({ enabled: true }, {
      orderBy: 'next_run_at',
      orderAsc: true
    });
  }

  async getDue(): Promise<ScheduledTask[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('enabled', true)
      .lte('next_run_at', now)
      .order('next_run_at', { ascending: true });

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as ScheduledTask[]) || [];
  }

  async getByName(name: string): Promise<ScheduledTask | null> {
    return this.findOne({ name });
  }

  async getByWorkflow(workflowName: string): Promise<ScheduledTask[]> {
    return this.findBy({ workflow_name: workflowName });
  }

  async enable(id: string): Promise<ScheduledTask> {
    return this.update(id, { enabled: true });
  }

  async disable(id: string): Promise<ScheduledTask> {
    return this.update(id, { enabled: false });
  }

  async markRan(id: string, runId: string, nextRunAt: string): Promise<ScheduledTask> {
    return this.update(id, {
      last_run_at: new Date().toISOString(),
      last_run_id: runId,
      next_run_at: nextRunAt
    });
  }

  async createSchedule(
    name: string,
    workflowName: string,
    frequency: ScheduleFrequency,
    config: Record<string, unknown> = {},
    cronExpression?: string
  ): Promise<ScheduledTask> {
    const nextRunAt = this.calculateNextRun(frequency, cronExpression);

    return this.create({
      name,
      workflow_name: workflowName,
      frequency,
      cron_expression: cronExpression,
      next_run_at: nextRunAt,
      enabled: true,
      config,
      updated_at: new Date().toISOString()
    });
  }

  calculateNextRun(frequency: ScheduleFrequency, _cronExpression?: string): string {
    const now = new Date();

    switch (frequency) {
      case 'hourly':
        now.setHours(now.getHours() + 1, 0, 0, 0);
        break;
      case 'daily':
        now.setDate(now.getDate() + 1);
        now.setHours(9, 0, 0, 0);
        break;
      case 'weekly':
        now.setDate(now.getDate() + 7);
        now.setHours(9, 0, 0, 0);
        break;
      case 'cron':
        // For cron, would need cron-parser library
        now.setHours(now.getHours() + 1, 0, 0, 0);
        break;
      case 'once':
      default:
        break;
    }

    return now.toISOString();
  }
}
