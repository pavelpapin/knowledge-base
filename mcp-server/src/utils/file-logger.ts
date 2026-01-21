/**
 * File Logger
 * Writes structured logs to files for observability
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_BASE = '/root/.claude/logs';
const DAILY_DIR = join(LOG_BASE, 'daily');
const RUNS_DIR = join(LOG_BASE, 'runs');
const ERRORS_DIR = join(LOG_BASE, 'errors');

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  ctx: string;
  runId?: string;
  msg: string;
  data?: unknown;
  duration?: number;
}

// Ensure directories exist
function ensureDirs(): void {
  for (const dir of [DAILY_DIR, RUNS_DIR, ERRORS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// Get today's date string
function getDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Write log entry to file
function writeLog(entry: LogEntry): void {
  ensureDirs();

  const line = JSON.stringify(entry) + '\n';
  const dateStr = getDateStr();

  // Always write to daily log
  const dailyFile = join(DAILY_DIR, `${dateStr}.jsonl`);
  appendFileSync(dailyFile, line);

  // Write to run-specific log if runId present
  if (entry.runId) {
    const runFile = join(RUNS_DIR, `${entry.runId}.jsonl`);
    appendFileSync(runFile, line);
  }

  // Write errors to separate file
  if (entry.level === 'error') {
    const errorFile = join(ERRORS_DIR, `${dateStr}.jsonl`);
    appendFileSync(errorFile, line);
  }

  // Also output to console for immediate visibility
  const prefix = `[${entry.ts}] [${entry.level.toUpperCase()}] [${entry.ctx}]`;
  const runInfo = entry.runId ? ` [${entry.runId}]` : '';
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';

  const consoleMsg = `${prefix}${runInfo} ${entry.msg}${dataStr}${durationStr}`;

  if (entry.level === 'error') {
    console.error(consoleMsg);
  } else if (entry.level === 'warn') {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }
}

// Log level filtering
let minLevel: LogLevel = 'debug';
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

export function setMinLevel(level: LogLevel): void {
  minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

// Main logging functions
function log(
  level: LogLevel,
  ctx: string,
  msg: string,
  options?: { runId?: string; data?: unknown; duration?: number }
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    ctx,
    msg,
    ...options
  };

  writeLog(entry);
}

// Create context-bound logger
export function createFileLogger(ctx: string, runId?: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', ctx, msg, { runId, data }),
    info: (msg: string, data?: unknown) => log('info', ctx, msg, { runId, data }),
    warn: (msg: string, data?: unknown) => log('warn', ctx, msg, { runId, data }),
    error: (msg: string, data?: unknown) => log('error', ctx, msg, { runId, data }),

    // Timed operation helper
    timed: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now();
      try {
        const result = await fn();
        log('info', ctx, `${operation} completed`, { runId, duration: Date.now() - start });
        return result;
      } catch (error) {
        log('error', ctx, `${operation} failed`, {
          runId,
          duration: Date.now() - start,
          data: { error: String(error) }
        });
        throw error;
      }
    }
  };
}

// Default logger without context
export const fileLogger = {
  debug: (ctx: string, msg: string, data?: unknown) => log('debug', ctx, msg, { data }),
  info: (ctx: string, msg: string, data?: unknown) => log('info', ctx, msg, { data }),
  warn: (ctx: string, msg: string, data?: unknown) => log('warn', ctx, msg, { data }),
  error: (ctx: string, msg: string, data?: unknown) => log('error', ctx, msg, { data }),

  // With run context
  forRun: (ctx: string, runId: string) => createFileLogger(ctx, runId)
};

// Export paths for external access
export const LOG_PATHS = {
  base: LOG_BASE,
  daily: DAILY_DIR,
  runs: RUNS_DIR,
  errors: ERRORS_DIR
};
