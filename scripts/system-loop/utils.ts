/**
 * System Loop Utilities
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { CONFIG } from './config.js'

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
  const timestamp = new Date().toISOString()
  const prefix = { info: '', warn: '', error: '', debug: '' }[level]
  console.log(`[${timestamp}] ${prefix} ${message}`)

  ensureDir(CONFIG.logDir)
  const logFile = path.join(CONFIG.logDir, `${new Date().toISOString().split('T')[0]}.log`)
  fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`)
}

export function loadEnv(): void {
  // Load from .env file if exists
  const envPath = '/root/.claude/secrets/.env'
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      }
    }
  }

  // Load Telegram credentials from JSON
  const telegramPath = '/root/.claude/secrets/telegram.json'
  if (fs.existsSync(telegramPath)) {
    try {
      const telegram = JSON.parse(fs.readFileSync(telegramPath, 'utf-8'))
      if (telegram.bot_token) process.env.TELEGRAM_BOT_TOKEN = telegram.bot_token
      if (telegram.default_chat_id) process.env.TELEGRAM_CHAT_ID = telegram.default_chat_id
    } catch {}
  }

  // Load Supabase credentials from JSON
  const supabasePath = '/root/.claude/secrets/supabase.json'
  if (fs.existsSync(supabasePath)) {
    try {
      const supabase = JSON.parse(fs.readFileSync(supabasePath, 'utf-8'))
      if (supabase.url) process.env.SUPABASE_URL = supabase.url
      if (supabase.service_key) process.env.SUPABASE_SERVICE_KEY = supabase.service_key
    } catch {}
  }
}

export function loadJson<T>(filepath: string, fallback: T): T {
  if (!fs.existsSync(filepath)) return fallback
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch (error) {
    log(`Failed to load ${filepath}: ${error}`, 'warn')
    return fallback
  }
}

export function saveJson(filepath: string, data: unknown): void {
  ensureDir(path.dirname(filepath))
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}

export function sendTelegram(message: string): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    log('Telegram not configured', 'debug')
    return false
  }

  try {
    execSync(
      `curl -s -X POST "https://api.telegram.org/bot${token}/sendMessage" ` +
      `-d "chat_id=${chatId}" ` +
      `-d "text=${encodeURIComponent(message)}" ` +
      `-d "parse_mode=HTML"`,
      { timeout: 10000, stdio: 'ignore' }
    )
    return true
  } catch (error) {
    log(`Telegram failed: ${error}`, 'error')
    return false
  }
}
