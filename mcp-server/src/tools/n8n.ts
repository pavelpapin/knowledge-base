/**
 * n8n tools
 */

import * as n8n from '../integrations/n8n.js';
import { Tool, paramString, paramNumber, safeJsonParse } from './types.js';

export const n8nTools: Tool[] = [
  {
    name: 'n8n_workflows',
    description: 'List n8n workflows',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const workflows = await n8n.listWorkflows();
      if (!workflows.length) return 'No workflows';
      return workflows
        .map(w => `${w.name} (${w.id}) - ${w.active ? 'active' : 'inactive'}`)
        .join('\n');
    }
  },
  {
    name: 'n8n_trigger',
    description: 'Trigger n8n webhook',
    inputSchema: {
      type: 'object',
      properties: {
        webhook: { type: 'string', description: 'Webhook path or ID' },
        data: { type: 'string', description: 'JSON data' }
      },
      required: ['webhook']
    },
    handler: async (params) => {
      const data = params.data
        ? safeJsonParse(paramString(params.data), undefined)
        : undefined;
      const result = await n8n.triggerWebhook(paramString(params.webhook), data);
      return result.success
        ? `Triggered: ${JSON.stringify(result.data)}`
        : `Failed: ${result.error}`;
    }
  },
  {
    name: 'n8n_executions',
    description: 'List recent n8n executions',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
        limit: { type: 'number', default: 10 }
      }
    },
    handler: async (params) => {
      const executions = await n8n.listExecutions({
        workflowId: params.workflowId ? paramString(params.workflowId) : undefined,
        limit: paramNumber(params.limit, 10)
      });
      if (!executions.length) return 'No executions';
      return executions.map(e => `${e.id} - ${e.status} (${e.startedAt})`).join('\n');
    }
  }
];
