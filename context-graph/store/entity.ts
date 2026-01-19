/**
 * Entity operations
 */

import * as crypto from 'crypto';
import { loadStore, saveStore } from './base.js';
import { Entity, EntityType, SearchResult } from '../types.js';

export function addEntity(
  type: EntityType,
  name: string,
  options: Partial<Omit<Entity, 'id' | 'type' | 'name' | 'createdAt' | 'updatedAt' | 'mentionCount'>> = {}
): Entity {
  const store = loadStore();
  const now = new Date().toISOString();

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

    if (entity.name.toLowerCase() === normalized) {
      score = 1.0;
      matchedField = 'name';
    } else if (entity.name.toLowerCase().includes(normalized)) {
      score = 0.8;
      matchedField = 'name';
    } else if (entity.aliases.some(a => a.toLowerCase() === normalized)) {
      score = 0.9;
      matchedField = 'alias';
    } else if (entity.aliases.some(a => a.toLowerCase().includes(normalized))) {
      score = 0.7;
      matchedField = 'alias';
    } else if (entity.notes.some(n => n.toLowerCase().includes(normalized))) {
      score = 0.5;
      matchedField = 'notes';
    } else if (entity.tags.some(t => t.toLowerCase().includes(normalized))) {
      score = 0.6;
      matchedField = 'tags';
    }

    if (score > 0) {
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

export function getAllEntities(): Entity[] {
  return loadStore().entities;
}

export function deleteEntity(id: string): boolean {
  const store = loadStore();
  const index = store.entities.findIndex((e: Entity) => e.id === id);
  if (index === -1) return false;

  store.entities.splice(index, 1);
  store.relations = store.relations.filter(r => r.sourceId !== id && r.targetId !== id);
  saveStore(store);
  return true;
}

export function addNote(entityId: string, note: string): Entity | null {
  const entity = getEntity(entityId);
  if (!entity) return null;
  return updateEntity(entityId, { notes: [...entity.notes, note] });
}

export function addAlias(entityId: string, alias: string): Entity | null {
  const entity = getEntity(entityId);
  if (!entity) return null;
  if (!entity.aliases.includes(alias)) {
    return updateEntity(entityId, { aliases: [...entity.aliases, alias] });
  }
  return entity;
}
