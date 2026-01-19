/**
 * Context Graph CLI
 * Command-line interface for managing the knowledge graph
 */

import * as store from './store.js';
import { EntityType, RelationType, Entity, Relation } from './types.js';

const command = process.argv[2];
const args = process.argv.slice(3);

function printEntity(e: Entity): void {
  const typeIcon = e.type === 'person' ? '👤' :
                   e.type === 'company' ? '🏢' :
                   e.type === 'project' ? '📁' : '💡';
  console.log(`${typeIcon} ${e.id.substring(0, 8)} | ${e.name}`);
  if (e.aliases.length > 0) {
    console.log(`   Aliases: ${e.aliases.join(', ')}`);
  }
  if (e.notes.length > 0) {
    console.log(`   Notes: ${e.notes.length} note(s)`);
  }
  console.log(`   Mentions: ${e.mentionCount}`);
}

function printRelation(r: Relation, source: Entity | null, target: Entity | null): void {
  const srcName = source?.name || r.sourceId.substring(0, 8);
  const tgtName = target?.name || r.targetId.substring(0, 8);
  console.log(`  ${srcName} --[${r.type}]--> ${tgtName} (strength: ${r.strength.toFixed(2)})`);
}

switch (command) {
  case 'add': {
    const [type, ...nameWords] = args;
    const name = nameWords.join(' ');
    if (!type || !name) {
      console.error('Usage: graph add <person|company|project|topic> <name>');
      process.exit(1);
    }
    const entity = store.addEntity(type as EntityType, name);
    console.log(`✅ Added ${type}: ${entity.id.substring(0, 8)} | ${entity.name}`);
    break;
  }

  case 'find':
  case 'search': {
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
    break;
  }

  case 'show': {
    const id = args[0];
    if (!id) {
      console.error('Usage: graph show <entity-id>');
      process.exit(1);
    }
    const entities = store.getAllEntities();
    const entity = entities.find(e => e.id.startsWith(id));
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
    break;
  }

  case 'link':
  case 'relate': {
    const [sourceId, relType, targetId] = args;
    if (!sourceId || !relType || !targetId) {
      console.error('Usage: graph link <source-id> <relation> <target-id>');
      console.error('Relations: works_at, knows, manages, founded, invested_in, works_on, part_of, related_to, expert_in');
      process.exit(1);
    }
    const entities = store.getAllEntities();
    const source = entities.find(e => e.id.startsWith(sourceId));
    const target = entities.find(e => e.id.startsWith(targetId));
    if (!source || !target) {
      console.error('Entity not found');
      process.exit(1);
    }
    const relation = store.addRelation(relType as RelationType, source.id, target.id);
    console.log(`✅ Linked: ${source.name} --[${relType}]--> ${target.name}`);
    break;
  }

  case 'note': {
    const [id, ...noteWords] = args;
    const note = noteWords.join(' ');
    if (!id || !note) {
      console.error('Usage: graph note <entity-id> <note text>');
      process.exit(1);
    }
    const entities = store.getAllEntities();
    const entity = entities.find(e => e.id.startsWith(id));
    if (!entity) {
      console.error('Entity not found');
      process.exit(1);
    }
    store.addNote(entity.id, note);
    console.log(`📝 Note added to ${entity.name}`);
    break;
  }

  case 'alias': {
    const [id, alias] = args;
    if (!id || !alias) {
      console.error('Usage: graph alias <entity-id> <alias>');
      process.exit(1);
    }
    const entities = store.getAllEntities();
    const entity = entities.find(e => e.id.startsWith(id));
    if (!entity) {
      console.error('Entity not found');
      process.exit(1);
    }
    store.addAlias(entity.id, alias);
    console.log(`✅ Alias added: ${entity.name} aka "${alias}"`);
    break;
  }

  case 'people': {
    const people = store.getEntitiesByType('person');
    console.log('\n👥 People');
    console.log('=========');
    if (people.length === 0) {
      console.log('No people yet');
    } else {
      people.forEach(printEntity);
    }
    break;
  }

  case 'companies': {
    const companies = store.getEntitiesByType('company');
    console.log('\n🏢 Companies');
    console.log('============');
    if (companies.length === 0) {
      console.log('No companies yet');
    } else {
      companies.forEach(printEntity);
    }
    break;
  }

  case 'recent': {
    const limit = parseInt(args[0]) || 10;
    const recent = store.getRecentlyMentioned(limit);
    console.log('\n🕐 Recently Mentioned');
    console.log('====================');
    if (recent.length === 0) {
      console.log('No recent mentions');
    } else {
      recent.forEach(printEntity);
    }
    break;
  }

  case 'top': {
    const limit = parseInt(args[0]) || 10;
    const top = store.getMostMentioned(limit);
    console.log('\n🔥 Most Mentioned');
    console.log('=================');
    if (top.length === 0) {
      console.log('No entities yet');
    } else {
      top.forEach(printEntity);
    }
    break;
  }

  case 'stats': {
    const stats = store.getStats();
    console.log('\n📊 Context Graph Stats');
    console.log('======================');
    console.log(`Total entities: ${stats.totalEntities}`);
    console.log(`  👤 People:    ${stats.people}`);
    console.log(`  🏢 Companies: ${stats.companies}`);
    console.log(`  📁 Projects:  ${stats.projects}`);
    console.log(`  💡 Topics:    ${stats.topics}`);
    console.log(`Total relations: ${stats.totalRelations}`);
    console.log(`Recently mentioned (24h): ${stats.recentlyMentioned}`);
    break;
  }

  case 'delete': {
    const id = args[0];
    if (!id) {
      console.error('Usage: graph delete <entity-id>');
      process.exit(1);
    }
    const entities = store.getAllEntities();
    const entity = entities.find(e => e.id.startsWith(id));
    if (!entity) {
      console.error('Entity not found');
      process.exit(1);
    }
    store.deleteEntity(entity.id);
    console.log(`🗑️  Deleted: ${entity.name}`);
    break;
  }

  case 'json': {
    const graph = store.exportGraph();
    console.log(JSON.stringify(graph, null, 2));
    break;
  }

  default:
    console.log(`
Context Graph - Knowledge Graph Manager

Usage: graph <command> [args]

Commands:
  add <type> <name>           Add entity (person|company|project|topic)
  search <query>              Search entities
  show <id>                   Show entity details
  link <id> <rel> <id>        Create relationship
  note <id> <text>            Add note to entity
  alias <id> <alias>          Add alias to entity
  people                      List all people
  companies                   List all companies
  recent [n]                  Recently mentioned
  top [n]                     Most mentioned
  stats                       Show statistics
  delete <id>                 Delete entity
  json                        Export as JSON
`);
}
