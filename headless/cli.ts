/**
 * Headless CLI
 * Command-line interface for autonomous task execution
 */

import * as task from './commands/task.js';
import * as info from './commands/info.js';
import { printHelp } from './commands/utils.js';

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'create':
  case 'add':
    task.create(args);
    break;

  case 'schedule':
    task.schedule(args);
    break;

  case 'run':
    task.run(args);
    break;

  case 'list':
  case 'ls':
    task.list(args);
    break;

  case 'show':
    task.show(args);
    break;

  case 'cancel':
    task.cancel(args);
    break;

  case 'delete':
    task.deleteTask(args);
    break;

  case 'executions':
    info.executions();
    break;

  case 'stats':
    info.stats();
    break;

  case 'settings':
    info.settings();
    break;

  default:
    printHelp();
}
