/**
 * n8n Adapter
 * Exposes n8n automation platform as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as n8n from '../../integrations/n8n/index.js';

const workflowsSchema = z.object({});

const triggerSchema = z.object({
  webhook: z.string().describe('Webhook path or ID'),
  data: z.string().optional().describe('JSON data to send')
});

const executionsSchema = z.object({
  workflowId: z.string().optional().describe('Filter by workflow ID'),
  limit: z.number().optional().default(10).describe('Maximum results')
});

const tools: AdapterTool[] = [
  {
    name: 'workflows',
    description: 'List n8n workflows',
    type: 'read',
    schema: workflowsSchema,
    execute: async () => {
      const workflows = await n8n.listWorkflows();
      return JSON.stringify(workflows, null, 2);
    }
  },
  {
    name: 'trigger',
    description: 'Trigger n8n webhook',
    type: 'write',
    schema: triggerSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof triggerSchema>;
      const data = p.data ? JSON.parse(p.data) : {};
      const result = await n8n.triggerWebhook(p.webhook, data);
      return JSON.stringify(result);
    }
  },
  {
    name: 'executions',
    description: 'List recent n8n executions',
    type: 'read',
    schema: executionsSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof executionsSchema>;
      const executions = await n8n.listExecutions({ workflowId: p.workflowId, limit: p.limit });
      return JSON.stringify(executions, null, 2);
    }
  }
];

export const n8nAdapter: Adapter = {
  name: 'n8n',
  isAuthenticated: n8n.isAuthenticated,
  tools
};
