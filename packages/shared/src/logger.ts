/**
 * Structured Logger
 * Centralized logging with levels and context
 *
 * Usage:
 *   import { createLogger } from '@elio/shared'
 *   const logger = createLogger('MyModule')
 *   logger.info('message', { key: 'value' })
 */

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  data?: unknown
  timestamp: string
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// FIXED: Calculate ELIO_ROOT locally to avoid circular dependency
const ELIO_ROOT = process.env.ELIO_ROOT || path.join(os.homedir(), '.claude')

// Configuration
let currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
let jsonOutput = process.env.LOG_FORMAT === 'json'
let fileLogging = process.env.LOG_TO_FILE === 'true'
let logDir = path.join(ELIO_ROOT, 'logs')

export function setLevel(level: LogLevel): void {
  currentLevel = level
}

export function setJsonOutput(enabled: boolean): void {
  jsonOutput = enabled
}

export function setFileLogging(enabled: boolean, dir?: string): void {
  fileLogging = enabled
  if (dir) logDir = dir
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel]
}

function formatLog(entry: LogEntry): string {
  if (jsonOutput) {
    return JSON.stringify(entry)
  }

  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`
  const ctx = entry.context ? ` [${entry.context}]` : ''
  const data = entry.data !== undefined
    ? ` ${typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data)}`
    : ''
  return `${prefix}${ctx} ${entry.message}${data}`
}

function writeToFile(formatted: string): void {
  if (!fileLogging) return

  try {
    const today = new Date().toISOString().split('T')[0]
    const logFile = path.join(logDir, `${today}.log`)

    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    fs.appendFileSync(logFile, formatted + '\n')
  } catch (err) {
    // Fail silently to avoid infinite loops
  }
}

function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  }

  const formatted = formatLog(entry)

  // Console output
  if (level === 'error') {
    console.error(formatted)
  } else if (level === 'warn') {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }

  // File output
  writeToFile(formatted)
}

export interface Logger {
  debug: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
  /** Create child logger with additional context */
  child: (childContext: string) => Logger
}

/**
 * Create a logger with context
 */
export function createLogger(context: string): Logger {
  return {
    debug: (msg: string, data?: unknown) => log('debug', msg, context, data),
    info: (msg: string, data?: unknown) => log('info', msg, context, data),
    warn: (msg: string, data?: unknown) => log('warn', msg, context, data),
    error: (msg: string, data?: unknown) => log('error', msg, context, data),
    child: (childContext: string) => createLogger(`${context}:${childContext}`),
  }
}

/**
 * Default logger (no context)
 */
export const logger: Logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, undefined, data),
  info: (msg: string, data?: unknown) => log('info', msg, undefined, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, undefined, data),
  error: (msg: string, data?: unknown) => log('error', msg, undefined, data),
  child: (childContext: string) => createLogger(childContext),
}
