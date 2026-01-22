/**
 * Simple file-based JSON store
 * Thread-safe writes with atomic operations
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Store<T> {
  load(): T;
  save(data: T): void;
  update(fn: (current: T) => T): T;
}

/**
 * Create a file-based JSON store
 * @param filePath - Path to the JSON file
 * @param defaultValue - Default value if file doesn't exist
 */
export function createStore<T>(filePath: string, defaultValue: T): Store<T> {
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Ensure file has .json extension
  const jsonPath = filePath.endsWith('.json') ? filePath : `${filePath}.json`;

  function load(): T {
    try {
      if (!fs.existsSync(jsonPath)) {
        save(defaultValue);
        return defaultValue;
      }
      const content = fs.readFileSync(jsonPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return defaultValue;
    }
  }

  function save(data: T): void {
    // Atomic write: write to temp file, then rename
    const tempPath = `${jsonPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, jsonPath);
  }

  function update(fn: (current: T) => T): T {
    const current = load();
    const updated = fn(current);
    save(updated);
    return updated;
  }

  return { load, save, update };
}
