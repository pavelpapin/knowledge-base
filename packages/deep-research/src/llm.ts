/**
 * LLM abstraction
 * - Claude: via CLI as non-root user (Max plan credits + MCP tools)
 * - OpenAI/Groq: via HTTP API
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { withResilience } from '@elio/shared';
import type { LLMCallOptions } from './types.js';

const SECRETS_PATH = '/root/.claude/secrets/.env';

const SECRETS_DIR = '/root/.claude/secrets';
const CLI_USER = 'elio';
const MCP_CONFIG = '/home/elio/.mcp.json';

let envLoaded = false;
function ensureEnv(): void {
  if (envLoaded) return;
  // Load from .env file
  try {
    const content = readFileSync(SECRETS_PATH, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* ignore */ }
  // Load from JSON secrets files
  const jsonMap: Record<string, string> = {
    'anthropic.json': 'ANTHROPIC_API_KEY',
    'openai.json': 'OPENAI_API_KEY',
    'groq.json': 'GROQ_API_KEY',
  };
  for (const [file, envKey] of Object.entries(jsonMap)) {
    if (!process.env[envKey]) {
      try {
        const data = JSON.parse(readFileSync(`${SECRETS_DIR}/${file}`, 'utf-8'));
        if (data.api_key) process.env[envKey] = data.api_key;
      } catch { /* ignore */ }
    }
  }
  envLoaded = true;
}

export async function callLLM(opts: LLMCallOptions): Promise<unknown> {
  ensureEnv();
  const maxRetries = opts.maxRetries ?? 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const raw = await callProvider(opts);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (opts.outputSchema) {
        const result = opts.outputSchema.safeParse(parsed);
        if (!result.success) {
          if (attempt < maxRetries) {
            await sleep(exponentialBackoff(attempt));
            continue;
          }
          throw new Error(`Schema validation failed: ${result.error.message}`);
        }
        return result.data;
      }
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on non-retryable errors
      if (!isRetryableError(lastError)) {
        throw lastError;
      }

      if (attempt >= maxRetries) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delayMs = exponentialBackoff(attempt);
      await sleep(delayMs);
    }
  }
  throw lastError ?? new Error('LLM call failed after all retries');
}

function exponentialBackoff(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return delay + jitter;
}

function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase();

  // Retryable: rate limits, server errors, timeouts, network issues
  if (msg.includes('429') || msg.includes('rate limit')) return true;
  if (msg.includes('503') || msg.includes('502') || msg.includes('500')) return true;
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return true;
  if (msg.includes('ECONNRESET') || msg.includes('ENOTFOUND')) return true;
  if (msg.includes('network') || msg.includes('socket')) return true;

  // Non-retryable: auth errors, bad requests, not found
  if (msg.includes('400') || msg.includes('bad request')) return false;
  if (msg.includes('401') || msg.includes('unauthorized')) return false;
  if (msg.includes('403') || msg.includes('forbidden')) return false;
  if (msg.includes('404') || msg.includes('not found')) return false;

  // Unknown errors: retry to be safe
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callProvider(opts: LLMCallOptions): Promise<string> {
  // Map provider to rate limiter service name
  const service = opts.provider === 'claude' ? 'anthropic' : opts.provider;

  return withResilience(service, async () => {
    switch (opts.provider) {
      case 'claude': return callClaude(opts);
      case 'openai': return callOpenAI(opts);
      case 'groq': return callGroq(opts);
    }
  });
}

function callClaude(opts: LLMCallOptions): string {
  const fullPrompt = `${opts.prompt}\n\n## INPUT\n${opts.input}\n\nReturn ONLY valid JSON matching the schema, no markdown, no explanation.`;
  const timeout = opts.timeoutMs ?? 300_000;

  // Write prompt to temp file to avoid shell escaping issues
  const tmpDir = mkdtempSync(join(tmpdir(), 'elio-llm-'));
  const promptFile = join(tmpDir, 'prompt.txt');
  writeFileSync(promptFile, fullPrompt, 'utf-8');

  try {
    // Don't use --json-schema flag due to Claude CLI bug with empty schemas
    // Instead, rely on prompt instruction to return valid JSON
    const cmd = `sudo -u ${CLI_USER} claude --print --dangerously-skip-permissions --output-format json --mcp-config ${escapeShell(MCP_CONFIG)} < ${escapeShell(promptFile)}`;

    const result = execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
    return result.trim();
  } finally {
    try { execSync(`rm -rf ${escapeShell(tmpDir)}`); } catch { /* cleanup */ }
  }
}

async function callOpenAI(opts: LLMCallOptions): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  return callOpenAICompatible(
    'https://api.openai.com/v1/chat/completions',
    key,
    'gpt-4o',
    opts,
  );
}

async function callGroq(opts: LLMCallOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  return callOpenAICompatible(
    'https://api.groq.com/openai/v1/chat/completions',
    key,
    'llama-3.1-70b-versatile',
    opts,
  );
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  opts: LLMCallOptions,
): Promise<string> {
  const timeout = opts.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: opts.prompt },
          { role: 'user', content: `${opts.input}\n\nReturn ONLY valid JSON.` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`${model} API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

function escapeShell(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export function loadPrompt(promptName: string): string {
  const path = `/root/.claude/workflows/deep-research/prompts/${promptName}`;
  return readFileSync(path, 'utf-8');
}

export function hasProvider(provider: 'openai' | 'groq'): boolean {
  ensureEnv();
  const key = provider === 'openai' ? 'OPENAI_API_KEY' : 'GROQ_API_KEY';
  return !!process.env[key];
}
