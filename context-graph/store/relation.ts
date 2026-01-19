/**
 * Relation operations
 */

import * as crypto from 'crypto';
import { loadStore, saveStore } from './base.js';
import { Entity, Relation, RelationType } from '../types.js';

export function addRelation(
  type: RelationType,
  sourceId: string,
  targetId: string,
  options: Partial<Omit<Relation, 'id' | 'type' | 'sourceId' | 'targetId' | 'createdAt' | 'updatedAt'>> = {}
): Relation {
  const store = loadStore();
  const now = new Date().toISOString();

  const existing = store.relations.find((r: Relation) =>
    r.type === type && r.sourceId === sourceId && r.targetId === targetId
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

export function deleteRelation(id: string): boolean {
  const store = loadStore();
  const index = store.relations.findIndex((r: Relation) => r.id === id);
  if (index === -1) return false;

  store.relations.splice(index, 1);
  saveStore(store);
  return true;
}

export function getAllRelations(): Relation[] {
  return loadStore().relations;
}
