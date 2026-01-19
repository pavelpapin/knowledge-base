/**
 * Headless Task Executor
 * Runs tasks autonomously
 */

import { spawn } from 'child_process';
import * as store from './store.js';
import { HeadlessTask, TaskExecution } from './types.js';

interface ExecutionResult {
  success: boolean;
  output: string;
  exitCode: number;
  duration: number;
}

export async function executeTask(task: HeadlessTask): Promise<ExecutionResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const execution = store.startExecution(task.id);

    const proc = spawn(task.command, task.args, {
      shell: true,
      timeout: task.timeout,
      env: {
        ...process.env,
        HEADLESS_MODE: 'true',
        TASK_ID: task.id
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      const exitCode = code ?? 1;
      const output = stdout || stderr;

      store.completeExecution(execution.executionId, output, exitCode);

      resolve({
        success: exitCode === 0,
        output,
        exitCode,
        duration
      });
    });

    proc.on('error', (err) => {
      const duration = Date.now() - startTime;

      store.failExecution(execution.executionId, err.message);

      resolve({
        success: false,
        output: err.message,
        exitCode: 1,
        duration
      });
    });
  });
}

export async function runPendingTasks(): Promise<ExecutionResult[]> {
  const settings = store.getSettings();
  const running = store.getRunningTasks();

  if (running.length >= settings.maxConcurrent) {
    console.log(`Max concurrent tasks reached (${settings.maxConcurrent})`);
    return [];
  }

  const pending = store.getPendingTasks();
  const available = settings.maxConcurrent - running.length;
  const toRun = pending.slice(0, available);

  const results: ExecutionResult[] = [];

  for (const task of toRun) {
    console.log(`Executing task: ${task.name} (${task.id.substring(0, 8)})`);
    const result = await executeTask(task);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ Completed in ${result.duration}ms`);
    } else {
      console.log(`  ❌ Failed: ${result.output.substring(0, 100)}`);
    }
  }

  return results;
}

export function parseSchedule(schedule: string): Date | null {
  // Simple schedule parsing (cron-like)
  // Format: "HH:MM" for daily, or "*/N" for every N minutes

  const now = new Date();

  // Every N minutes: */5
  if (schedule.startsWith('*/')) {
    const minutes = parseInt(schedule.substring(2));
    if (!isNaN(minutes)) {
      const next = new Date(now.getTime() + minutes * 60 * 1000);
      return next;
    }
  }

  // Specific time: HH:MM
  const timeMatch = schedule.match(/^(\d{2}):(\d{2})$/);
  if (timeMatch) {
    const [, hours, mins] = timeMatch;
    const next = new Date(now);
    next.setHours(parseInt(hours), parseInt(mins), 0, 0);

    // If time has passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  return null;
}

export function getNextScheduledTask(): HeadlessTask | null {
  const scheduled = store.getScheduledTasks()
    .filter((t: HeadlessTask) => t.nextRunAt)
    .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime());

  if (scheduled.length > 0) {
    const next = scheduled[0];
    const nextTime = new Date(next.nextRunAt!);

    if (nextTime <= new Date()) {
      return next;
    }
  }

  return null;
}
