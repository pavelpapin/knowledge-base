/**
 * Entity commands
 */

import * as store from '../store.js';
import { EntityType, RelationType } from '../types.js';
import { printEntity, findEntity } from './utils.js';

export function add(args: string[]): void {
  const [type, ...nameWords] = args;
  const name = nameWords.join(' ');
  if (!type || !name) {
    console.error('Usage: graph add <person|company|project|topic> <name>');
    process.exit(1);
  }
  const entity = store.addEntity(type as EntityType, name);
  console.log(`✅ Added ${type}: ${entity.id.substring(0, 8)} | ${entity.name}`);
}

export function search(args: string[]): void {
  const query = args.join(' ');
  if (!query) {
    console.error('Usage: graph search <query>');
    process.exit(1);
  }
  const results = store.searchEntities(query);
  console.log(`\n🔍 Search: "${query}"`);
  console.log('='.repeat(40));
  if (results.length === 0) {
    console.log('No results found');
  } else {
    results.forEach(r => {
      printEntity(r.entity);
      console.log(`   Match: ${r.matchedField} (score: ${r.score.toFixed(2)})`);
      console.log('');
    });
  }
}

export function show(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error('Usage: graph show <entity-id>');
    process.exit(1);
  }
  const entities = store.getAllEntities();
  const entity = findEntity(entities, id);
  if (!entity) {
    console.error('Entity not found');
    process.exit(1);
  }
  console.log(`\n${entity.type.toUpperCase()}: ${entity.name}`);
  console.log('='.repeat(40));
  console.log(`ID: ${entity.id}`);
  console.log(`Aliases: ${entity.aliases.join(', ') || 'none'}`);
  console.log(`Tags: ${entity.tags.join(', ') || 'none'}`);
  console.log(`Mentions: ${entity.mentionCount}`);
  console.log(`Last mentioned: ${entity.lastMentioned || 'never'}`);
  if (entity.notes.length > 0) {
    console.log(`\nNotes:`);
    entity.notes.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
  }
  const connections = store.getConnections(entity.id);
  if (connections.length > 0) {
    console.log(`\nConnections:`);
    connections.forEach(({ entity: e, relation: r }) => {
      const dir = r.sourceId === entity.id ? '->' : '<-';
      console.log(`  ${dir} ${e.name} [${r.type}] (${r.strength.toFixed(2)})`);
    });
  }
}

export function link(args: string[]): void {
  const [sourceId, relType, targetId] = args;
  if (!sourceId || !relType || !targetId) {
    console.error('Usage: graph link <source-id> <relation> <target-id>');
    console.error('Relations: works_at, knows, manages, founded, invested_in, works_on, part_of, related_to, expert_in');
    process.exit(1);
  }
  const entities = store.getAllEntities();
  const source = findEntity(entities, sourceId);
  const target = findEntity(entities, targetId);
  if (!source || !target) {
    console.error('Entity not found');
    process.exit(1);
  }
  store.addRelation(relType as RelationType, source.id, target.id);
  console.log(`✅ Linked: ${source.name} --[${relType}]--> ${target.name}`);
}

export function note(args: string[]): void {
  const [id, ...noteWords] = args;
  const noteText = noteWords.join(' ');
  if (!id || !noteText) {
    console.error('Usage: graph note <entity-id> <note text>');
    process.exit(1);
  }
  const entities = store.getAllEntities();
  const entity = findEntity(entities, id);
  if (!entity) {
    console.error('Entity not found');
    process.exit(1);
  }
  store.addNote(entity.id, noteText);
  console.log(`📝 Note added to ${entity.name}`);
}

export function alias(args: string[]): void {
  const [id, aliasText] = args;
  if (!id || !aliasText) {
    console.error('Usage: graph alias <entity-id> <alias>');
    process.exit(1);
  }
  const entities = store.getAllEntities();
  const entity = findEntity(entities, id);
  if (!entity) {
    console.error('Entity not found');
    process.exit(1);
  }
  store.addAlias(entity.id, aliasText);
  console.log(`✅ Alias added: ${entity.name} aka "${aliasText}"`);
}

export function deleteEntity(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error('Usage: graph delete <entity-id>');
    process.exit(1);
  }
  const entities = store.getAllEntities();
  const entity = findEntity(entities, id);
  if (!entity) {
    console.error('Entity not found');
    process.exit(1);
  }
  store.deleteEntity(entity.id);
  console.log(`🗑️  Deleted: ${entity.name}`);
}
