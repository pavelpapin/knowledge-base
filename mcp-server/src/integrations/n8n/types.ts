/**
 * n8n Integration Types
 */

export interface N8nCredentials {
  base_url: string;           // e.g., https://n8n.example.com or http://localhost:5678
  api_key: string;            // n8n API key
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ id: string; name: string }>;
}

export interface N8nExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  data?: unknown;
}

export interface WebhookResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface RunWorkflowResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

export interface HealthStatus {
  healthy: boolean;
  version?: string;
}

export interface ScheduledTask {
  name: string;
  data?: unknown;
  executeAt?: string;
}
