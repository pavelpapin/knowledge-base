/**
 * n8n Integration
 * Trigger workflows, manage executions, and interact with n8n instance
 */

import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

const CREDENTIALS_PATH = '/root/.claude/secrets/n8n-credentials.json';

interface N8nCredentials {
  base_url: string;           // e.g., https://n8n.example.com or http://localhost:5678
  api_key: string;            // n8n API key
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: string; name: string }>;
}

interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  data?: unknown;
}

interface WebhookResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

function loadCredentials(): N8nCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

async function n8nRequest(
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('n8n not configured. Add credentials to /root/.claude/secrets/n8n-credentials.json');
  }

  const url = new URL(credentials.base_url);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `/api/v1${endpoint}`,
      method,
      headers: {
        'X-N8N-API-KEY': credentials.api_key,
        'Content-Type': 'application/json'
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function webhookRequest(
  webhookPath: string,
  method: 'GET' | 'POST' = 'POST',
  data?: unknown
): Promise<WebhookResponse> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('n8n not configured');
  }

  const url = new URL(credentials.base_url);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve) => {
    const path = webhookPath.startsWith('/') ? webhookPath : `/webhook/${webhookPath}`;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ success: true, data: json });
        } catch {
          resolve({ success: true, data: responseData });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    if (data && method === 'POST') {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Workflow operations

export async function listWorkflows(): Promise<N8nWorkflow[]> {
  const response = await n8nRequest('/workflows') as { data: N8nWorkflow[] };
  return response.data || [];
}

export async function getWorkflow(workflowId: string): Promise<N8nWorkflow | null> {
  try {
    const response = await n8nRequest(`/workflows/${workflowId}`) as N8nWorkflow;
    return response;
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
    const response = await n8nRequest(`/executions/${executionId}`) as N8nExecution;
    return response;
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

export async function triggerWebhook(
  webhookPath: string,
  data?: Record<string, unknown>
): Promise<WebhookResponse> {
  return webhookRequest(webhookPath, 'POST', data);
}

export async function triggerWebhookGet(webhookPath: string): Promise<WebhookResponse> {
  return webhookRequest(webhookPath, 'GET');
}

// Named workflow triggers (convenience functions)

export async function runWorkflow(
  workflowName: string,
  inputData?: Record<string, unknown>
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  // First find the workflow by name
  const workflows = await listWorkflows();
  const workflow = workflows.find(w =>
    w.name.toLowerCase() === workflowName.toLowerCase()
  );

  if (!workflow) {
    return { success: false, error: `Workflow not found: ${workflowName}` };
  }

  // Try to trigger via webhook (most workflows have a webhook trigger)
  const webhookResult = await triggerWebhook(workflow.id, inputData);

  if (webhookResult.success) {
    return { success: true, executionId: workflow.id };
  }

  return { success: false, error: webhookResult.error || 'Failed to trigger workflow' };
}

// Common workflow patterns

export async function sendNotification(
  message: string,
  channel?: string
): Promise<WebhookResponse> {
  return triggerWebhook('notify', {
    message,
    channel: channel || 'default',
    timestamp: new Date().toISOString()
  });
}

export async function processData(
  data: unknown,
  workflowName: string
): Promise<WebhookResponse> {
  return triggerWebhook(workflowName, {
    data,
    source: 'elio',
    timestamp: new Date().toISOString()
  });
}

export async function scheduleTask(
  task: {
    name: string;
    data?: unknown;
    executeAt?: string;
  }
): Promise<WebhookResponse> {
  return triggerWebhook('schedule-task', {
    ...task,
    scheduledBy: 'elio',
    createdAt: new Date().toISOString()
  });
}

// Status and health

export async function getHealth(): Promise<{ healthy: boolean; version?: string }> {
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
        let data = '';
        res.on('data', chunk => data += chunk);
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

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
n8n Integration Setup:

1. Go to your n8n instance settings
2. Create an API key (Settings > API)
3. Create /root/.claude/secrets/n8n-credentials.json:
   {
     "base_url": "https://your-n8n-instance.com",
     "api_key": "YOUR_API_KEY"
   }

For self-hosted n8n:
   {
     "base_url": "http://localhost:5678",
     "api_key": "YOUR_API_KEY"
   }

Note: Webhook triggers require workflows with Webhook nodes.
The webhook path is typically the workflow ID or a custom path.
`;
}
