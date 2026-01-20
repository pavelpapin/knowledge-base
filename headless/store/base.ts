/**
 * Base store operations
 * Uses @elio/shared for storage
 */

import { createStore, paths } from '@elio/shared';
import { HeadlessStore, HeadlessSettings } from '../types.js';

const DEFAULT_STORE: HeadlessStore = {
  tasks: [],
  executions: [],
  settings: {
    maxConcurrent: 3,
    defaultTimeout: 300000,
    notifyOnComplete: true,
    notifyOnError: true
  }
};

const store = createStore<HeadlessStore>(paths.data.headless, DEFAULT_STORE);

export function loadStore(): HeadlessStore {
  return store.load();
}

export function saveStore(data: HeadlessStore): void {
  store.save(data);
}

export function getSettings(): HeadlessSettings {
  return store.load().settings;
}

export function updateSettings(updates: Partial<HeadlessSettings>): HeadlessSettings {
  return store.update(current => ({
    ...current,
    settings: { ...current.settings, ...updates }
  })).settings;
}
