/**
 * Base store operations
 */

import * as fs from 'fs';
import { GraphStore, GraphStats, Entity } from '../types.js';

const STORE_PATH = '/root/.claude/context-graph/data/graph.json';

export function loadStore(): GraphStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return { entities: [], relations: [] };
}

export function saveStore(store: GraphStore): void {
  const dir = STORE_PATH.substring(0, STORE_PATH.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function getStats(): GraphStats {
  const store = loadStore();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  return {
    totalEntities: store.entities.length,
    people: store.entities.filter((e: Entity) => e.type === 'person').length,
    companies: store.entities.filter((e: Entity) => e.type === 'company').length,
    projects: store.entities.filter((e: Entity) => e.type === 'project').length,
    topics: store.entities.filter((e: Entity) => e.type === 'topic').length,
    totalRelations: store.relations.length,
    recentlyMentioned: store.entities.filter((e: Entity) =>
      e.lastMentioned && new Date(e.lastMentioned).getTime() > dayAgo
    ).length
  };
}

export function exportGraph(): GraphStore {
  return loadStore();
}
