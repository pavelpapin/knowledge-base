/**
 * Base store operations
 */

import * as fs from 'fs';
import { HeadlessStore, HeadlessSettings } from '../types.js';

const STORE_PATH = '/root/.claude/headless/data/store.json';

export function loadStore(): HeadlessStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return {
    tasks: [],
    executions: [],
    settings: {
      maxConcurrent: 3,
      defaultTimeout: 300000,
      notifyOnComplete: true,
      notifyOnError: true
    }
  };
}

export function saveStore(store: HeadlessStore): void {
  const dir = STORE_PATH.substring(0, STORE_PATH.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function getSettings(): HeadlessSettings {
  return loadStore().settings;
}

export function updateSettings(updates: Partial<HeadlessSettings>): HeadlessSettings {
  const store = loadStore();
  store.settings = { ...store.settings, ...updates };
  saveStore(store);
  return store.settings;
}
