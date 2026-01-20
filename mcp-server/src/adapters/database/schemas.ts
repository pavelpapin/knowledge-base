/**
 * Database Adapter Schemas
 * Zod schemas for database tools
 */

import { z } from 'zod';

// Helper for safe JSON parsing
export const jsonString = z.string().transform((val, ctx) => {
  try {
    return JSON.parse(val);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
    return z.NEVER;
  }
});

// Workflow schemas
export const runsSummarySchema = z.object({
  since: z.string().optional().describe('ISO date to filter from (default: last 24h)')
});

export const workflowRunsSchema = z.object({
  workflowName: z.string().optional().describe('Filter by workflow name'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.number().optional().default(20)
});

export const createRunSchema = z.object({
  workflowName: z.string().describe('Workflow name'),
  trigger: z.string().describe('What triggered this run'),
  input: z.string().optional().describe('JSON input data')
});

export const updateRunSchema = z.object({
  runId: z.string().describe('Run UUID'),
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).describe('New status'),
  output: z.string().optional().describe('JSON output data'),
  error: z.string().optional().describe('Error message if failed')
});

// Schedule schemas
export const scheduledTasksSchema = z.object({
  enabledOnly: z.boolean().optional().default(true)
});

export const createScheduleSchema = z.object({
  name: z.string().describe('Unique task name'),
  workflowName: z.string().describe('Workflow to run'),
  frequency: z.enum(['once', 'hourly', 'daily', 'weekly', 'cron']),
  cronExpression: z.string().optional().describe('Cron expression if frequency=cron'),
  config: z.string().optional().describe('JSON config')
});

// Message schemas
export const messagesSchema = z.object({
  source: z.enum(['telegram', 'email', 'slack', 'web']).optional(),
  limit: z.number().optional().default(50)
});

// Task schemas
export const taskSchema = z.object({
  title: z.string().describe('Task title'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  project: z.string().optional(),
  dueDate: z.string().optional().describe('Due date in YYYY-MM-DD format')
});

export const taskListSchema = z.object({
  limit: z.number().optional().default(50)
});

// State schemas
export const stateGetSchema = z.object({
  key: z.string().describe('State key')
});

export const stateSetSchema = z.object({
  key: z.string().describe('State key'),
  value: z.string().describe('JSON value')
});

// Utility
export function safeJsonParse(str: string | undefined, fallback = {}): unknown {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    throw new Error(`Invalid JSON: ${str.substring(0, 50)}...`);
  }
}
