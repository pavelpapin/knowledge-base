/**
 * Clay Webhook Agent
 * Работает ТОЛЬКО через webhooks - единственный способ отправить данные в Clay
 *
 * Clay НЕ имеет публичного REST API для CRUD операций.
 * API ключ используется только для аутентификации webhooks.
 *
 * Flow:
 * 1. Человек создаёт таблицу в Clay UI с webhook источником
 * 2. Человек настраивает enrichment в Clay UI
 * 3. Агент отправляет данные на webhook URL
 * 4. Clay обогащает данные
 * 5. Если настроен HTTP callback - Clay отправляет результат обратно
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const CREDENTIALS_PATH = '/root/.claude/secrets/clay.json';
const RESULTS_PATH = '/root/.claude/data/clay-results';

interface ClayCredentials {
  api_key: string;
  webhook_url?: string;      // URL для отправки данных В Clay
  callback_url?: string;     // URL куда Clay отправит результат
}

interface WebhookPayload {
  [key: string]: unknown;
}

// Ensure results directory exists
if (!existsSync(RESULTS_PATH)) {
  mkdirSync(RESULTS_PATH, { recursive: true });
}

function getCredentials(): ClayCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCredentials(creds: ClayCredentials): void {
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2));
}

/**
 * Configure Clay integration
 *
 * @param webhook_url - URL вебхука из Clay (создаётся в Clay UI: Add → Monitor webhook)
 * @param callback_url - URL куда Clay отправит результат (опционально)
 */
export function configure(options: {
  api_key?: string;
  webhook_url?: string;
  callback_url?: string;
}): { success: boolean; message: string } {
  const existing = getCredentials() || { api_key: '' };

  const updated: ClayCredentials = {
    api_key: options.api_key || existing.api_key,
    webhook_url: options.webhook_url || existing.webhook_url,
    callback_url: options.callback_url || existing.callback_url
  };

  saveCredentials(updated);

  const status = [];
  if (updated.webhook_url) status.push('webhook: configured');
  else status.push('webhook: NOT SET (required!)');
  if (updated.callback_url) status.push('callback: configured');

  return {
    success: !!updated.webhook_url,
    message: status.join(', ')
  };
}

/**
 * Get configuration status
 */
export function getStatus(): {
  configured: boolean;
  has_webhook: boolean;
  has_callback: boolean;
  webhook_url?: string;
  instructions?: string;
} {
  const creds = getCredentials();

  if (!creds?.webhook_url) {
    return {
      configured: false,
      has_webhook: false,
      has_callback: false,
      instructions: `
Clay требует ручной настройки в UI:

1. Создай таблицу в Clay
2. Нажми "+ Add" внизу таблицы
3. Выбери "Monitor webhook"
4. Скопируй URL вебхука
5. Вызови: configure({ webhook_url: "скопированный_url" })

После этого можно отправлять данные через sendToWebhook()
      `.trim()
    };
  }

  return {
    configured: true,
    has_webhook: !!creds.webhook_url,
    has_callback: !!creds.callback_url,
    webhook_url: creds.webhook_url
  };
}

/**
 * Send data to Clay webhook
 * Это единственный способ программно отправить данные в Clay
 */
export async function sendToWebhook(data: WebhookPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  const creds = getCredentials();

  if (!creds?.webhook_url) {
    return {
      success: false,
      error: 'Webhook URL not configured. Run getStatus() for setup instructions.'
    };
  }

  try {
    const response = await fetch(creds.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(creds.api_key ? { 'Authorization': `Bearer ${creds.api_key}` } : {})
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Webhook error (${response.status}): ${error}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

/**
 * Send person data to Clay for enrichment
 */
export async function enrichPerson(input: {
  linkedin_url?: string;
  name?: string;
  email?: string;
  company?: string;
  [key: string]: unknown;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  // Map to common Clay column names
  const payload: WebhookPayload = {};

  if (input.linkedin_url) payload['LinkedIn URL'] = input.linkedin_url;
  if (input.name) payload['Name'] = input.name;
  if (input.email) payload['Email'] = input.email;
  if (input.company) payload['Company'] = input.company;

  // Add any extra fields
  for (const [key, value] of Object.entries(input)) {
    if (!['linkedin_url', 'name', 'email', 'company'].includes(key)) {
      payload[key] = value;
    }
  }

  const result = await sendToWebhook(payload);

  if (result.success) {
    return {
      success: true,
      message: 'Data sent to Clay. Enrichment will run automatically if configured in Clay UI.'
    };
  }

  return result;
}

/**
 * Send multiple records to Clay
 */
export async function enrichBatch(records: WebhookPayload[]): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const record of records) {
    const result = await sendToWebhook(record);
    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.error) errors.push(result.error);
    }
  }

  return {
    success: failed === 0,
    sent,
    failed,
    errors
  };
}

/**
 * Handle callback from Clay (when Clay sends enriched data back)
 * Call this from your HTTP server endpoint
 */
export function handleCallback(data: Record<string, unknown>): {
  success: boolean;
  id: string;
} {
  const id = (data.request_id as string) || Date.now().toString();
  const path = `${RESULTS_PATH}/${id}.json`;

  writeFileSync(path, JSON.stringify({
    ...data,
    received_at: new Date().toISOString()
  }, null, 2));

  return { success: true, id };
}

/**
 * Get stored result by ID
 */
export function getResult(id: string): Record<string, unknown> | null {
  const path = `${RESULTS_PATH}/${id}.json`;
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * List all stored results
 */
export function listResults(): Array<{ id: string; received_at: string }> {
  if (!existsSync(RESULTS_PATH)) return [];

  const { readdirSync } = require('fs');
  const files = readdirSync(RESULTS_PATH) as string[];

  return files
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => {
      try {
        const data = JSON.parse(readFileSync(`${RESULTS_PATH}/${f}`, 'utf-8'));
        return {
          id: f.replace('.json', ''),
          received_at: data.received_at || 'unknown'
        };
      } catch {
        return { id: f.replace('.json', ''), received_at: 'unknown' };
      }
    });
}

// Legacy alias
export const enrich = enrichPerson;
