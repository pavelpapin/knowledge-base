/**
 * Context Graph Store
 * Persistence and query layer for the knowledge graph
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  GraphStore,
  Entity,
  Relation,
  EntityType,
  RelationType,
  SearchResult,
  GraphStats
} from './types.js';

const STORE_PATH = '/root/.claude/context-graph/graph.json';

function loadStore(): GraphStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return { entities: [], relations: [] };
}

function saveStore(store: GraphStore): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Entity operations

export function addEntity(
  type: EntityType,
  name: string,
  options: Partial<Omit<Entity, 'id' | 'type' | 'name' | 'createdAt' | 'updatedAt' | 'mentionCount'>> = {}
): Entity {
  const store = loadStore();
  const now = new Date().toISOString();

  // Check for existing entity with same name/alias
  const existing = findEntityByName(name);
  if (existing) {
    return touchEntity(existing.id);
  }

  const entity: Entity = {
    id: crypto.randomUUID(),
    type,
    name,
    aliases: options.aliases || [],
    properties: options.properties || {},
    notes: options.notes || [],
    tags: options.tags || [],
    createdAt: now,
    updatedAt: now,
    lastMentioned: now,
    mentionCount: 1
  };

  store.entities.push(entity);
  saveStore(store);
  return entity;
}

export function updateEntity(id: string, updates: Partial<Entity>): Entity | null {
  const store = loadStore();
  const index = store.entities.findIndex((e: Entity) => e.id === id);

  if (index === -1) return null;

  store.entities[index] = {
    ...store.entities[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  saveStore(store);
  return store.entities[index];
}

export function touchEntity(id: string): Entity {
  const store = loadStore();
  const entity = store.entities.find((e: Entity) => e.id === id);

  if (entity) {
    entity.lastMentioned = new Date().toISOString();
    entity.mentionCount += 1;
    entity.updatedAt = new Date().toISOString();
    saveStore(store);
    return entity;
  }

  throw new Error(`Entity not found: ${id}`);
}

export function getEntity(id: string): Entity | null {
  return loadStore().entities.find((e: Entity) => e.id === id) || null;
}

export function findEntityByName(name: string): Entity | null {
  const store = loadStore();
  const normalized = name.toLowerCase().trim();

  return store.entities.find((e: Entity) =>
    e.name.toLowerCase() === normalized ||
    e.aliases.some(a => a.toLowerCase() === normalized)
  ) || null;
}

export function searchEntities(query: string, type?: EntityType): SearchResult[] {
  const store = loadStore();
  const normalized = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const entity of store.entities) {
    if (type && entity.type !== type) continue;

    let score = 0;
    let matchedField = '';

    // Exact name match
    if (entity.name.toLowerCase() === normalized) {
      score = 1.0;
      matchedField = 'name';
    }
    // Name contains query
    else if (entity.name.toLowerCase().includes(normalized)) {
      score = 0.8;
      matchedField = 'name';
    }
    // Alias exact match
    else if (entity.aliases.some(a => a.toLowerCase() === normalized)) {
      score = 0.9;
      matchedField = 'alias';
    }
    // Alias contains query
    else if (entity.aliases.some(a => a.toLowerCase().includes(normalized))) {
      score = 0.7;
      matchedField = 'alias';
    }
    // Notes contain query
    else if (entity.notes.some(n => n.toLowerCase().includes(normalized))) {
      score = 0.5;
      matchedField = 'notes';
    }
    // Tags contain query
    else if (entity.tags.some(t => t.toLowerCase().includes(normalized))) {
      score = 0.6;
      matchedField = 'tags';
    }

    if (score > 0) {
      // Boost by mention count
      score *= 1 + Math.log10(1 + entity.mentionCount) * 0.1;
      results.push({ entity, score, matchedField });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function getEntitiesByType(type: EntityType): Entity[] {
  return loadStore().entities.filter((e: Entity) => e.type === type);
}

export function getRecentlyMentioned(limit = 10): Entity[] {
  const store = loadStore();
  return [...store.entities]
    .filter((e: Entity) => e.lastMentioned)
    .sort((a, b) => new Date(b.lastMentioned!).getTime() - new Date(a.lastMentioned!).getTime())
    .slice(0, limit);
}

export function getMostMentioned(limit = 10): Entity[] {
  const store = loadStore();
  return [...store.entities]
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, limit);
}

// Relation operations

export function addRelation(
  type: RelationType,
  sourceId: string,
  targetId: string,
  options: Partial<Omit<Relation, 'id' | 'type' | 'sourceId' | 'targetId' | 'createdAt' | 'updatedAt'>> = {}
): Relation {
  const store = loadStore();
  const now = new Date().toISOString();

  // Check for existing relation
  const existing = store.relations.find((r: Relation) =>
    r.type === type &&
    r.sourceId === sourceId &&
    r.targetId === targetId
  );

  if (existing) {
    return strengthenRelation(existing.id);
  }

  const relation: Relation = {
    id: crypto.randomUUID(),
    type,
    sourceId,
    targetId,
    properties: options.properties || {},
    notes: options.notes || [],
    strength: options.strength ?? 0.5,
    createdAt: now,
    updatedAt: now
  };

  store.relations.push(relation);
  saveStore(store);
  return relation;
}

export function strengthenRelation(id: string, amount = 0.1): Relation {
  const store = loadStore();
  const relation = store.relations.find((r: Relation) => r.id === id);

  if (relation) {
    relation.strength = Math.min(1, relation.strength + amount);
    relation.updatedAt = new Date().toISOString();
    saveStore(store);
    return relation;
  }

  throw new Error(`Relation not found: ${id}`);
}

export function getRelationsFor(entityId: string): Relation[] {
  return loadStore().relations.filter((r: Relation) =>
    r.sourceId === entityId || r.targetId === entityId
  );
}

export function getConnections(entityId: string): Array<{ entity: Entity; relation: Relation }> {
  const store = loadStore();
  const relations = getRelationsFor(entityId);
  const connections: Array<{ entity: Entity; relation: Relation }> = [];

  for (const rel of relations) {
    const otherId = rel.sourceId === entityId ? rel.targetId : rel.sourceId;
    const entity = store.entities.find((e: Entity) => e.id === otherId);
    if (entity) {
      connections.push({ entity, relation: rel });
    }
  }

  return connections.sort((a, b) => b.relation.strength - a.relation.strength);
}

export function deleteEntity(id: string): boolean {
  const store = loadStore();
  const index = store.entities.findIndex((e: Entity) => e.id === id);
  if (index === -1) return false;

  store.entities.splice(index, 1);
  store.relations = store.relations.filter((r: Relation) =>
    r.sourceId !== id && r.targetId !== id
  );
  saveStore(store);
  return true;
}

export function deleteRelation(id: string): boolean {
  const store = loadStore();
  const index = store.relations.findIndex((r: Relation) => r.id === id);
  if (index === -1) return false;

  store.relations.splice(index, 1);
  saveStore(store);
  return true;
}

// Stats and export

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

export function getAllEntities(): Entity[] {
  return loadStore().entities;
}

export function getAllRelations(): Relation[] {
  return loadStore().relations;
}

// Add note to entity
export function addNote(entityId: string, note: string): Entity | null {
  const entity = getEntity(entityId);
  if (!entity) return null;

  return updateEntity(entityId, {
    notes: [...entity.notes, note]
  });
}

// Add alias to entity
export function addAlias(entityId: string, alias: string): Entity | null {
  const entity = getEntity(entityId);
  if (!entity) return null;

  if (!entity.aliases.includes(alias)) {
    return updateEntity(entityId, {
      aliases: [...entity.aliases, alias]
    });
  }

  return entity;
}
