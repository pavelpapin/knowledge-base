/**
 * CLI Utilities
 */

import { HeadlessTask, TaskExecution } from '../types.js';

export function printTask(t: HeadlessTask): void {
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

export function printExecution(e: TaskExecution): void {
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

export function findTask(tasks: HeadlessTask[], id: string): HeadlessTask | undefined {
  return tasks.find(t => t.id.startsWith(id));
}

export function printHelp(): void {
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
