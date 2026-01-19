/**
 * n8n Integration
 * Trigger workflows, manage executions, and interact with n8n instance
 */

import * as https from 'https';
import * as http from 'http';
import { n8nRequest, webhookRequest, loadCredentials, isAuthenticated, getAuthInstructions } from './api.js';
import type { N8nWorkflow, N8nExecution, WebhookResponse, RunWorkflowResult, HealthStatus, ScheduledTask } from './types.js';

export type { N8nWorkflow, N8nExecution, WebhookResponse, RunWorkflowResult, HealthStatus, ScheduledTask } from './types.js';
export { isAuthenticated, getAuthInstructions } from './api.js';

// Workflow operations

export async function listWorkflows(): Promise<N8nWorkflow[]> {
  const response = await n8nRequest('/workflows') as { data: N8nWorkflow[] };
  return response.data || [];
}

export async function getWorkflow(workflowId: string): Promise<N8nWorkflow | null> {
  try {
    return await n8nRequest(`/workflows/${workflowId}`) as N8nWorkflow;
  } catch {
    return null;
  }
}

export async function activateWorkflow(workflowId: string): Promise<boolean> {
  try {
    await n8nRequest(`/workflows/${workflowId}/activate`, 'POST');
    return true;
  } catch {
    return false;
  }
}

export async function deactivateWorkflow(workflowId: string): Promise<boolean> {
  try {
    await n8nRequest(`/workflows/${workflowId}/deactivate`, 'POST');
    return true;
  } catch {
    return false;
  }
}

// Execution operations

export async function listExecutions(
  options: {
    workflowId?: string;
    status?: 'success' | 'error' | 'running' | 'waiting';
    limit?: number;
  } = {}
): Promise<N8nExecution[]> {
  let endpoint = '/executions';
  const params: string[] = [];

  if (options.workflowId) params.push(`workflowId=${options.workflowId}`);
  if (options.status) params.push(`status=${options.status}`);
  if (options.limit) params.push(`limit=${options.limit}`);

  if (params.length > 0) {
    endpoint += '?' + params.join('&');
  }

  const response = await n8nRequest(endpoint) as { data: N8nExecution[] };
  return response.data || [];
}

export async function getExecution(executionId: string): Promise<N8nExecution | null> {
  try {
    return await n8nRequest(`/executions/${executionId}`) as N8nExecution;
  } catch {
    return null;
  }
}

export async function deleteExecution(executionId: string): Promise<boolean> {
  try {
    await n8nRequest(`/executions/${executionId}`, 'DELETE');
    return true;
  } catch {
    return false;
  }
}

// Webhook triggers

export async function triggerWebhook(webhookPath: string, data?: Record<string, unknown>): Promise<WebhookResponse> {
  return webhookRequest(webhookPath, 'POST', data);
}

export async function triggerWebhookGet(webhookPath: string): Promise<WebhookResponse> {
  return webhookRequest(webhookPath, 'GET');
}

// Named workflow triggers

export async function runWorkflow(workflowName: string, inputData?: Record<string, unknown>): Promise<RunWorkflowResult> {
  const workflows = await listWorkflows();
  const workflow = workflows.find(w => w.name.toLowerCase() === workflowName.toLowerCase());

  if (!workflow) {
    return { success: false, error: `Workflow not found: ${workflowName}` };
  }

  const webhookResult = await triggerWebhook(workflow.id, inputData);

  if (webhookResult.success) {
    return { success: true, executionId: workflow.id };
  }

  return { success: false, error: webhookResult.error || 'Failed to trigger workflow' };
}

// Common workflow patterns

export async function sendNotification(message: string, channel?: string): Promise<WebhookResponse> {
  return triggerWebhook('notify', {
    message,
    channel: channel || 'default',
    timestamp: new Date().toISOString()
  });
}

export async function processData(data: unknown, workflowName: string): Promise<WebhookResponse> {
  return triggerWebhook(workflowName, {
    data,
    source: 'elio',
    timestamp: new Date().toISOString()
  });
}

export async function scheduleTask(task: ScheduledTask): Promise<WebhookResponse> {
  return triggerWebhook('schedule-task', {
    ...task,
    scheduledBy: 'elio',
    createdAt: new Date().toISOString()
  });
}

// Status and health

export async function getHealth(): Promise<HealthStatus> {
  try {
    const credentials = loadCredentials();
    if (!credentials) {
      return { healthy: false };
    }

    const url = new URL(credentials.base_url);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = httpModule.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: '/healthz',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve({ healthy: res.statusCode === 200 });
        });
      });

      req.on('error', () => resolve({ healthy: false }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ healthy: false });
      });
      req.end();
    });
  } catch {
    return { healthy: false };
  }
}
