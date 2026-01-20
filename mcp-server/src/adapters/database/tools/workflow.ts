/**
 * Workflow Tools
 * Tools for workflow run management
 */

import { z } from 'zod';
import { AdapterTool } from '../../../gateway/types.js';
import { getDb } from '../../../db/index.js';
import {
  runsSummarySchema,
  workflowRunsSchema,
  createRunSchema,
  updateRunSchema,
  safeJsonParse
} from '../schemas.js';

export const workflowTools: AdapterTool[] = [
  {
    name: 'runs_summary',
    description: 'Get summary of workflow runs (total, completed, failed, running, pending)',
    type: 'read',
    schema: runsSummarySchema,
    execute: async (params) => {
      const p = params as z.infer<typeof runsSummarySchema>;
      const since = p.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const stats = await getDb().workflow.getStats(since);
      return JSON.stringify(stats, null, 2);
    }
  },
  {
    name: 'runs_list',
    description: 'List workflow runs with optional filters',
    type: 'read',
    schema: workflowRunsSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof workflowRunsSchema>;

      let runs;
      if (p.status) {
        runs = await getDb().workflow.getByStatus(p.status, { limit: p.limit });
      } else if (p.workflowName) {
        runs = await getDb().workflow.getByWorkflow(p.workflowName, { limit: p.limit });
      } else {
        runs = await getDb().workflow.getRecent(p.limit);
      }

      return JSON.stringify(runs, null, 2);
    }
  },
  {
    name: 'run_start',
    description: 'Start a new workflow run',
    type: 'write',
    schema: createRunSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createRunSchema>;
      const input = safeJsonParse(p.input, {}) as Record<string, unknown>;
      const run = await getDb().workflow.startRun(p.workflowName, p.trigger, input);
      return JSON.stringify(run, null, 2);
    }
  },
  {
    name: 'run_complete',
    description: 'Mark workflow run as completed/failed/cancelled',
    type: 'write',
    schema: updateRunSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof updateRunSchema>;

      let run;
      if (p.status === 'completed') {
        const output = safeJsonParse(p.output, {}) as Record<string, unknown>;
        run = await getDb().workflow.completeRun(p.runId, output);
      } else if (p.status === 'failed') {
        run = await getDb().workflow.failRun(p.runId, p.error || 'Unknown error');
      } else if (p.status === 'cancelled') {
        run = await getDb().workflow.cancelRun(p.runId);
      } else {
        run = await getDb().workflow.update(p.runId, { status: p.status });
      }

      return JSON.stringify(run, null, 2);
    }
  }
];
