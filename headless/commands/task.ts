/**
 * Task commands: create, schedule, run, cancel, delete, show
 */

import * as store from '../store.js';
import * as executor from '../executor.js';
import { TaskType } from '../types.js';
import { printTask, printExecution, findTask } from './utils.js';

export function create(args: string[]): void {
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
}

export function schedule(args: string[]): void {
  const [id, scheduleStr] = args;
  if (!id || !scheduleStr) {
    console.error('Usage: headless schedule <task-id> <schedule>');
    console.error('Schedule: HH:MM for daily, */N for every N minutes');
    process.exit(1);
  }

  const tasks = store.getAllTasks();
  const task = findTask(tasks, id);
  if (!task) {
    console.error('Task not found');
    process.exit(1);
  }

  const nextRun = executor.parseSchedule(scheduleStr);
  store.updateTask(task.id, {
    schedule: scheduleStr,
    nextRunAt: nextRun?.toISOString()
  });

  console.log(`✅ Scheduled: ${task.name}`);
  console.log(`   Schedule: ${scheduleStr}`);
  if (nextRun) {
    console.log(`   Next run: ${nextRun.toISOString()}`);
  }
}

export async function run(args: string[]): Promise<void> {
  const id = args[0];
  if (id) {
    const tasks = store.getAllTasks();
    const task = findTask(tasks, id);
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }

    console.log(`Running task: ${task.name}`);
    const result = await executor.executeTask(task);
    if (result.success) {
      console.log(`✅ Completed in ${result.duration}ms`);
      console.log(`Output:\n${result.output.substring(0, 500)}`);
    } else {
      console.error(`❌ Failed (exit ${result.exitCode})`);
      console.error(result.output);
    }
  } else {
    console.log('Running pending tasks...');
    const results = await executor.runPendingTasks();
    console.log(`\nExecuted ${results.length} tasks`);
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`  ✅ Success: ${success}`);
    console.log(`  ❌ Failed: ${failed}`);
  }
}

export function show(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error('Usage: headless show <task-id>');
    process.exit(1);
  }

  const tasks = store.getAllTasks();
  const task = findTask(tasks, id);
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
}

export function cancel(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error('Usage: headless cancel <task-id>');
    process.exit(1);
  }

  const tasks = store.getAllTasks();
  const task = findTask(tasks, id);
  if (!task) {
    console.error('Task not found');
    process.exit(1);
  }

  store.updateTask(task.id, { status: 'cancelled' });
  console.log(`🚫 Cancelled: ${task.name}`);
}

export function deleteTask(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.error('Usage: headless delete <task-id>');
    process.exit(1);
  }

  const tasks = store.getAllTasks();
  const task = findTask(tasks, id);
  if (!task) {
    console.error('Task not found');
    process.exit(1);
  }

  store.deleteTask(task.id);
  console.log(`🗑️  Deleted: ${task.name}`);
}

export function list(args: string[]): void {
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
}
