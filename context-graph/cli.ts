/**
 * Context Graph CLI
 * Command-line interface for managing the knowledge graph
 */

import * as entity from './commands/entity.js';
import * as list from './commands/list.js';
import { printHelp } from './commands/utils.js';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'add':
    entity.add(args);
    break;

  case 'find':
  case 'search':
    entity.search(args);
    break;

  case 'show':
    entity.show(args);
    break;

  case 'link':
  case 'relate':
    entity.link(args);
    break;

  case 'note':
    entity.note(args);
    break;

  case 'alias':
    entity.alias(args);
    break;

  case 'delete':
    entity.deleteEntity(args);
    break;

  case 'people':
    list.people();
    break;

  case 'companies':
    list.companies();
    break;

  case 'recent':
    list.recent(args);
    break;

  case 'top':
    list.top(args);
    break;

  case 'stats':
    list.stats();
    break;

  case 'json':
    list.json();
    break;

  default:
    printHelp();
}
