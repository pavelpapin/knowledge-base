/**
 * Shared JSON Store Utilities
 * Provides sync and async operations for JSON file storage
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { dirname, basename } from 'path';
import { eventBus, Events, StoreUpdatedEvent } from './events.js';

/**
 * Ensure directory exists (sync)
 */
function ensureDirSync(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Ensure directory exists (async)
 */
async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Load JSON from file (sync)
 */
export function loadJsonSync<T>(path: string, defaultValue: T): T {
  if (!existsSync(path)) {
    return defaultValue;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Save JSON to file (sync)
 */
export function saveJsonSync<T>(path: string, data: T): void {
  ensureDirSync(path);
  writeFileSync(path, JSON.stringify(data, null, 2));
}

/**
 * Load JSON from file (async)
 */
export async function loadJson<T>(path: string, defaultValue: T): Promise<T> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Save JSON to file (async)
 */
export async function saveJson<T>(path: string, data: T): Promise<void> {
  await ensureDir(path);
  await writeFile(path, JSON.stringify(data, null, 2));
}

export interface StoreOptions {
  emitEvents?: boolean;
  moduleName?: string;
}

/**
 * Create a typed store with sync operations
 */
export function createStore<T>(path: string, defaultValue: T, options: StoreOptions = {}) {
  const { emitEvents = true, moduleName } = options;
  const module = moduleName || basename(path, '.json');

  const emitUpdate = (action: StoreUpdatedEvent['action'], id?: string) => {
    if (emitEvents) {
      eventBus.emit<StoreUpdatedEvent>(Events.STORE_UPDATED, { module, action, id });
    }
  };

  return {
    load: (): T => {
      const data = loadJsonSync(path, defaultValue);
      if (emitEvents) {
        eventBus.emit<StoreUpdatedEvent>(Events.STORE_LOADED, { module, action: 'update' });
      }
      return data;
    },
    save: (data: T): void => {
      saveJsonSync(path, data);
      emitUpdate('update');
    },
    update: (updater: (current: T) => T): T => {
      const current = loadJsonSync(path, defaultValue);
      const updated = updater(current);
      saveJsonSync(path, updated);
      emitUpdate('update');
      return updated;
    }
  };
}

/**
 * Create a typed store with async operations
 */
export function createAsyncStore<T>(path: string, defaultValue: T, options: StoreOptions = {}) {
  const { emitEvents = true, moduleName } = options;
  const module = moduleName || basename(path, '.json');

  const emitUpdate = (action: StoreUpdatedEvent['action'], id?: string) => {
    if (emitEvents) {
      eventBus.emit<StoreUpdatedEvent>(Events.STORE_UPDATED, { module, action, id });
    }
  };

  return {
    load: async (): Promise<T> => {
      const data = await loadJson(path, defaultValue);
      if (emitEvents) {
        eventBus.emit<StoreUpdatedEvent>(Events.STORE_LOADED, { module, action: 'update' });
      }
      return data;
    },
    save: async (data: T): Promise<void> => {
      await saveJson(path, data);
      emitUpdate('update');
    },
    update: async (updater: (current: T) => T): Promise<T> => {
      const current = await loadJson(path, defaultValue);
      const updated = updater(current);
      await saveJson(path, updated);
      emitUpdate('update');
      return updated;
    }
  };
}
