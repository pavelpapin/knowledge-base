/**
 * Base store operations
 * Uses @elio/shared for storage
 */

import { createStore, paths } from '@elio/shared';
import { GraphStore, GraphStats, Entity } from '../types.js';

const DEFAULT_STORE: GraphStore = {
  entities: [],
  relations: []
};

const store = createStore<GraphStore>(paths.data.contextGraph, DEFAULT_STORE);

export function loadStore(): GraphStore {
  return store.load();
}

export function saveStore(data: GraphStore): void {
  store.save(data);
}

export function getStats(): GraphStats {
  const data = store.load();
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  return {
    totalEntities: data.entities.length,
    people: data.entities.filter((e: Entity) => e.type === 'person').length,
    companies: data.entities.filter((e: Entity) => e.type === 'company').length,
    projects: data.entities.filter((e: Entity) => e.type === 'project').length,
    topics: data.entities.filter((e: Entity) => e.type === 'topic').length,
    totalRelations: data.relations.length,
    recentlyMentioned: data.entities.filter((e: Entity) =>
      e.lastMentioned && new Date(e.lastMentioned).getTime() > dayAgo
    ).length
  };
}

export function exportGraph(): GraphStore {
  return store.load();
}
