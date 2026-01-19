/**
 * Headless CLI
 * Command-line interface for autonomous task execution
 */

import * as store from './store.js';
import * as executor from './executor.js';
import { TaskType, HeadlessTask, TaskExecution } from './types.js';

const command = process.argv[2];
const args = process.argv.slice(3);

function printTask(t: HeadlessTask): void {
  const statusIcon = t.status === 'completed' ? '✅' :
                     t.status === 'running' ? '🔄' :
                     t.status === 'failed' ? '❌' :
                     t.status === 'pending' ? '⏳' : '🚫';

  console.log(`${statusIcon} ${t.id.substring(0, 8)} | ${t.name}`);
  console.log(`   Type: ${t.type} | Command: ${t.command}`);
  if (t.schedule) {
    console.log(`   Schedule: ${t.schedule}`);
  }
  if (t.error) {
    console.log(`   Error: ${t.error.substring(0, 60)}...`);
  }
}

function printExecution(e: TaskExecution): void {
  const statusIcon = e.status === 'completed' ? '✅' :
                     e.status === 'running' ? '🔄' :
                     e.status === 'failed' ? '❌' : '⏳';

  console.log(`${statusIcon} ${e.executionId.substring(0, 8)} | Task: ${e.taskId.substring(0, 8)}`);
  console.log(`   Started: ${e.startedAt}`);
  if (e.completedAt) {
    console.log(`   Completed: ${e.completedAt}`);
  }
  if (e.error) {
    console.log(`   Error: ${e.error.substring(0, 60)}...`);
  }
}

switch (command) {
  case 'create':
  case 'add': {
    const [type, name, cmd, ...extraArgs] = args;
    if (!type || !name || !cmd) {
      console.error('Usage: headless create <type> <name> <command> [args...]');
      console.error('Types: research, report, monitor, scrape, analyze, notify, backup, custom');
      process.exit(1);
    }

    const task = store.createTask(type as TaskType, name, cmd, {
      args: extraArgs,
      description: `Task: ${name}`
    });

    console.log(`✅ Task created: ${task.id.substring(0, 8)}`);
    console.log(`   Name: ${task.name}`);
    console.log(`   Type: ${task.type}`);
    console.log(`   Command: ${task.command}`);
    break;
  }

  case 'schedule': {
    const [id, schedule] = args;
    if (!id || !schedule) {
      console.error('Usage: headless schedule <task-id> <schedule>');
      console.error('Schedule: HH:MM for daily, */N for every N minutes');
      process.exit(1);
    }

    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }

    const nextRun = executor.parseSchedule(schedule);
    store.updateTask(task.id, {
      schedule,
      nextRunAt: nextRun?.toISOString()
    });

    console.log(`✅ Scheduled: ${task.name}`);
    console.log(`   Schedule: ${schedule}`);
    if (nextRun) {
      console.log(`   Next run: ${nextRun.toISOString()}`);
    }
    break;
  }

  case 'run': {
    const id = args[0];
    if (id) {
      // Run specific task
      const tasks = store.getAllTasks();
      const task = tasks.find(t => t.id.startsWith(id));
      if (!task) {
        console.error('Task not found');
        process.exit(1);
      }

      console.log(`Running task: ${task.name}`);
      executor.executeTask(task).then(result => {
        if (result.success) {
          console.log(`✅ Completed in ${result.duration}ms`);
          console.log(`Output:\n${result.output.substring(0, 500)}`);
        } else {
          console.error(`❌ Failed (exit ${result.exitCode})`);
          console.error(result.output);
        }
      });
    } else {
      // Run all pending
      console.log('Running pending tasks...');
      executor.runPendingTasks().then(results => {
        console.log(`\nExecuted ${results.length} tasks`);
        const success = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`  ✅ Success: ${success}`);
        console.log(`  ❌ Failed: ${failed}`);
      });
    }
    break;
  }

  case 'list':
  case 'ls': {
    const filter = args[0];
    let tasks = store.getAllTasks();

    if (filter === 'pending') {
      tasks = tasks.filter(t => t.status === 'pending');
    } else if (filter === 'running') {
      tasks = tasks.filter(t => t.status === 'running');
    } else if (filter === 'scheduled') {
      tasks = tasks.filter(t => t.schedule);
    }

    console.log('\n📋 Tasks');
    console.log('========');
    if (tasks.length === 0) {
      console.log('No tasks');
    } else {
      tasks.forEach(printTask);
    }
    break;
  }

  case 'show': {
    const id = args[0];
    if (!id) {
      console.error('Usage: headless show <task-id>');
      process.exit(1);
    }

    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }

    console.log(`\n📋 Task: ${task.name}`);
    console.log('='.repeat(40));
    console.log(`ID: ${task.id}`);
    console.log(`Type: ${task.type}`);
    console.log(`Status: ${task.status}`);
    console.log(`Command: ${task.command} ${task.args.join(' ')}`);
    console.log(`Timeout: ${task.timeout}ms`);
    if (task.schedule) {
      console.log(`Schedule: ${task.schedule}`);
      console.log(`Next run: ${task.nextRunAt}`);
    }
    if (task.result) {
      console.log(`\nResult:\n${task.result.substring(0, 500)}`);
    }
    if (task.error) {
      console.log(`\nError: ${task.error}`);
    }

    const executions = store.getExecutions(task.id);
    if (executions.length > 0) {
      console.log(`\nRecent executions:`);
      executions.slice(-5).forEach(printExecution);
    }
    break;
  }

  case 'cancel': {
    const id = args[0];
    if (!id) {
      console.error('Usage: headless cancel <task-id>');
      process.exit(1);
    }

    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }

    store.updateTask(task.id, { status: 'cancelled' });
    console.log(`🚫 Cancelled: ${task.name}`);
    break;
  }

  case 'delete': {
    const id = args[0];
    if (!id) {
      console.error('Usage: headless delete <task-id>');
      process.exit(1);
    }

    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }

    store.deleteTask(task.id);
    console.log(`🗑️  Deleted: ${task.name}`);
    break;
  }

  case 'executions': {
    const executions = store.getRecentExecutions(20);

    console.log('\n🔄 Recent Executions');
    console.log('====================');
    if (executions.length === 0) {
      console.log('No executions yet');
    } else {
      executions.forEach(printExecution);
    }
    break;
  }

  case 'stats': {
    const stats = store.getStats();

    console.log('\n📊 Headless Stats');
    console.log('=================');
    console.log(`Total tasks: ${stats.total}`);
    console.log(`  ⏳ Pending:   ${stats.pending}`);
    console.log(`  🔄 Running:   ${stats.running}`);
    console.log(`  ✅ Completed: ${stats.completed}`);
    console.log(`  ❌ Failed:    ${stats.failed}`);
    console.log(`  📅 Scheduled: ${stats.scheduled}`);
    break;
  }

  case 'settings': {
    const settings = store.getSettings();

    console.log('\n⚙️  Settings');
    console.log('============');
    console.log(`Max concurrent: ${settings.maxConcurrent}`);
    console.log(`Default timeout: ${settings.defaultTimeout}ms`);
    console.log(`Notify on complete: ${settings.notifyOnComplete}`);
    console.log(`Notify on error: ${settings.notifyOnError}`);
    if (settings.telegramChatId) {
      console.log(`Telegram chat: ${settings.telegramChatId}`);
    }
    break;
  }

  default:
    console.log(`
Headless Mode - Autonomous Task Execution

Usage: headless <command> [args]

Commands:
  create <type> <name> <cmd>  Create a task
  schedule <id> <schedule>    Schedule a task
  run [id]                    Run task(s)
  list [filter]               List tasks (pending|running|scheduled)
  show <id>                   Show task details
  cancel <id>                 Cancel task
  delete <id>                 Delete task
  executions                  Show recent executions
  stats                       Show statistics
  settings                    Show settings

Task types:
  research, report, monitor, scrape, analyze, notify, backup, custom

Schedule formats:
  HH:MM                       Daily at specific time
  */N                         Every N minutes
`);
}
