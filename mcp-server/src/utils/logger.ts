/**
 * Structured Logger
 * Centralized logging with levels and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
  timestamp: string;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLevel: LogLevel = 'info';
let jsonOutput = false;

export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

export function setJsonOutput(enabled: boolean): void {
  jsonOutput = enabled;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatLog(entry: LogEntry): string {
  if (jsonOutput) {
    return JSON.stringify(entry);
  }

  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  const ctx = entry.context ? ` [${entry.context}]` : '';
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
  return `${prefix}${ctx} ${entry.message}${data}`;
}

function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString()
  };

  const formatted = formatLog(entry);

  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', msg, context, data),
    info: (msg: string, data?: unknown) => log('info', msg, context, data),
    warn: (msg: string, data?: unknown) => log('warn', msg, context, data),
    error: (msg: string, data?: unknown) => log('error', msg, context, data)
  };
}

// Default logger
export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, undefined, data),
  info: (msg: string, data?: unknown) => log('info', msg, undefined, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, undefined, data),
  error: (msg: string, data?: unknown) => log('error', msg, undefined, data)
};
