/**
 * Day Review Utilities
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

export function exec(cmd: string, fallback: string = ''): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch {
    return fallback;
  }
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readJsonl<T>(filepath: string): T[] {
  if (!fs.existsSync(filepath)) return [];
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

export function loadJson<T>(filepath: string, fallback: T): T {
  if (!fs.existsSync(filepath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return fallback;
  }
}
