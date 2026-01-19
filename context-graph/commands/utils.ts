/**
 * CLI Utilities
 */

import { Entity, Relation } from '../types.js';

export function printEntity(e: Entity): void {
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

export function findEntity(entities: Entity[], id: string): Entity | undefined {
  return entities.find(e => e.id.startsWith(id));
}

export function printHelp(): void {
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
