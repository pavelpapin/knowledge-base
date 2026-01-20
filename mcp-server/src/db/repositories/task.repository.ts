/**
 * Task Repository
 * Data access for GTD tasks
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository, QueryOptions } from './base.repository.js';
import { DatabaseError } from '../errors/index.js';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'someday' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  context?: string;
  project?: string;
  due_date?: string;
  scheduled_date?: string;
  completed_at?: string;
  source_message_id?: string;
  created_at: string;
  updated_at: string;
}

export class TaskRepository extends BaseRepository<Task> {
  constructor(client: SupabaseClient) {
    super(client, 'tasks');
  }

  async getByStatus(status: TaskStatus, options: QueryOptions = {}): Promise<Task[]> {
    return this.findBy({ status }, {
      orderBy: 'created_at',
      orderAsc: false,
      ...options
    });
  }

  async getActive(options: QueryOptions = {}): Promise<Task[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .not('status', 'in', '("done","someday")')
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Task[]) || [];
  }

  async getInbox(): Promise<Task[]> {
    return this.getByStatus('inbox');
  }

  async getNext(): Promise<Task[]> {
    return this.getByStatus('next');
  }

  async getByProject(project: string, options: QueryOptions = {}): Promise<Task[]> {
    return this.findBy({ project }, {
      orderBy: 'priority',
      orderAsc: true,
      ...options
    });
  }

  async getByContext(context: string, options: QueryOptions = {}): Promise<Task[]> {
    return this.findBy({ context }, options);
  }

  async getDueToday(): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('due_date', today)
      .neq('status', 'done')
      .order('priority', { ascending: true });

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Task[]) || [];
  }

  async getOverdue(): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .lt('due_date', today)
      .neq('status', 'done')
      .order('due_date', { ascending: true });

    if (error) {
      throw new DatabaseError(error.message, error.code);
    }
    return (data as Task[]) || [];
  }

  async createTask(
    title: string,
    options: Partial<Omit<Task, 'id' | 'created_at' | 'updated_at' | 'title'>> = {}
  ): Promise<Task> {
    return this.create({
      title,
      priority: options.priority || 'medium',
      status: options.status || 'inbox',
      description: options.description,
      context: options.context,
      project: options.project,
      due_date: options.due_date,
      scheduled_date: options.scheduled_date,
      source_message_id: options.source_message_id,
      updated_at: new Date().toISOString()
    });
  }

  async complete(id: string): Promise<Task> {
    return this.update(id, {
      status: 'done',
      completed_at: new Date().toISOString()
    });
  }

  async moveToNext(id: string): Promise<Task> {
    return this.update(id, { status: 'next' });
  }

  async moveToSomeday(id: string): Promise<Task> {
    return this.update(id, { status: 'someday' });
  }

  async setPriority(id: string, priority: TaskPriority): Promise<Task> {
    return this.update(id, { priority });
  }

  async setDueDate(id: string, dueDate: string): Promise<Task> {
    return this.update(id, { due_date: dueDate });
  }

  async getStats(): Promise<{
    inbox: number;
    next: number;
    waiting: number;
    someday: number;
    done: number;
    overdue: number;
  }> {
    const [inbox, next, waiting, someday, done, overdue] = await Promise.all([
      this.count({ status: 'inbox' }),
      this.count({ status: 'next' }),
      this.count({ status: 'waiting' }),
      this.count({ status: 'someday' }),
      this.count({ status: 'done' }),
      this.getOverdue().then(tasks => tasks.length)
    ]);

    return { inbox, next, waiting, someday, done, overdue };
  }
}
