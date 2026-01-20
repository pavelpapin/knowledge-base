/**
 * Audit Logger
 * Immutable logging for all tool executions
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { paths } from '@elio/shared';
import { AuditEntry } from './types.js';

const AUDIT_DIR = join(paths.base, 'logs', 'audit');
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'api_key', 'apiKey', 'authorization', 'body'];
const PII_PATTERNS = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, mask: '[EMAIL]' },
  { pattern: /\+?[0-9]{10,15}/g, mask: '[PHONE]' }
];

function ensureAuditDir(): void {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

function redactValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;

  // Check if key is sensitive
  if (key && SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
    return '[REDACTED]';
  }

  // Handle strings
  if (typeof value === 'string') {
    let result = value;
    for (const { pattern, mask } of PII_PATTERNS) {
      result = result.replace(pattern, mask);
    }
    // Truncate long strings
    if (result.length > 200) {
      return result.substring(0, 200) + '...[TRUNCATED]';
    }
    return result;
  }

  // Handle objects recursively
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.slice(0, 10).map(v => redactValue(v));
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = redactValue(v, k);
    }
    return result;
  }

  return value;
}

function redactParams(params: Record<string, unknown>): Record<string, unknown> {
  return redactValue(params) as Record<string, unknown>;
}

function getAuditFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return join(AUDIT_DIR, `${date}.jsonl`);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'params'> & { params: Record<string, unknown> }): AuditEntry {
  ensureAuditDir();

  const fullEntry: AuditEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    tool: entry.tool,
    params: redactParams(entry.params),
    result: entry.result,
    error: entry.error,
    duration: entry.duration
  };

  const filePath = getAuditFilePath();
  appendFileSync(filePath, JSON.stringify(fullEntry) + '\n');

  return fullEntry;
}

export function createAuditContext(tool: string, params: Record<string, unknown>): {
  startTime: number;
  complete: (result: AuditEntry['result'], error?: string) => AuditEntry;
} {
  const startTime = Date.now();

  return {
    startTime,
    complete: (result, error) => {
      return logAudit({
        tool,
        params,
        result,
        error,
        duration: Date.now() - startTime
      });
    }
  };
}
