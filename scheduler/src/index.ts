/**
 * Elio Scheduler
 * Cron-based job scheduler for automated tasks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Cron } from 'croner';
import { paths } from '@elio/shared';
import { ScheduledJob, SchedulerConfig, JobResult } from './types.js';
import { executeJob } from './executor.js';

const CONFIG_PATH = paths.data.scheduler;
const LOG_PATH = paths.logs.scheduler;

class Scheduler {
  private jobs: Map<string, Cron> = new Map();
  private config: SchedulerConfig = { jobs: [] };

  constructor() {
    this.ensureDirectories();
    this.loadConfig();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(LOG_PATH)) {
      fs.mkdirSync(LOG_PATH, { recursive: true });
    }
  }

  private loadConfig(): void {
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } catch (error) {
        console.error('Failed to load config:', error);
        this.config = { jobs: [] };
      }
    }
  }

  private saveConfig(): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }

  private logResult(result: JobResult): void {
    const logFile = path.join(LOG_PATH, `${result.jobId}.jsonl`);
    fs.appendFileSync(logFile, JSON.stringify(result) + '\n');
  }

  start(): void {
    console.log(`[Scheduler] Starting with ${this.config.jobs.length} jobs`);

    for (const job of this.config.jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
      }
    }
  }

  stop(): void {
    for (const [id, cron] of this.jobs) {
      cron.stop();
      console.log(`[Scheduler] Stopped job: ${id}`);
    }
    this.jobs.clear();
  }

  private scheduleJob(job: ScheduledJob): void {
    const cron = new Cron(job.cron, async () => {
      console.log(`[Scheduler] Running job: ${job.name}`);
      const result = await executeJob(job);
      this.logResult(result);

      // Update lastRun
      const jobConfig = this.config.jobs.find(j => j.id === job.id);
      if (jobConfig) {
        jobConfig.lastRun = result.timestamp;
        this.saveConfig();
      }

      if (result.success) {
        console.log(`[Scheduler] Job ${job.name} completed`);
      } else {
        console.error(`[Scheduler] Job ${job.name} failed: ${result.error}`);
      }
    });

    this.jobs.set(job.id, cron);
    console.log(`[Scheduler] Scheduled: ${job.name} (${job.cron})`);
  }

  addJob(job: Omit<ScheduledJob, 'id' | 'createdAt'>): ScheduledJob {
    const newJob: ScheduledJob = {
      ...job,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };

    this.config.jobs.push(newJob);
    this.saveConfig();

    if (newJob.enabled) {
      this.scheduleJob(newJob);
    }

    return newJob;
  }

  removeJob(id: string): boolean {
    const cron = this.jobs.get(id);
    if (cron) {
      cron.stop();
      this.jobs.delete(id);
    }

    const index = this.config.jobs.findIndex(j => j.id === id);
    if (index >= 0) {
      this.config.jobs.splice(index, 1);
      this.saveConfig();
      return true;
    }
    return false;
  }

  listJobs(): ScheduledJob[] {
    return this.config.jobs.map(job => ({
      ...job,
      nextRun: this.jobs.get(job.id)?.nextRun()?.toISOString()
    }));
  }
}

// CLI & Daemon mode
const scheduler = new Scheduler();

const command = process.argv[2];

switch (command) {
  case 'start':
    scheduler.start();
    console.log('[Scheduler] Running... Press Ctrl+C to stop');
    process.on('SIGINT', () => {
      scheduler.stop();
      process.exit(0);
    });
    break;

  case 'list':
    console.log(JSON.stringify(scheduler.listJobs(), null, 2));
    break;

  case 'add':
    const jobDef = JSON.parse(process.argv[3] || '{}');
    const added = scheduler.addJob(jobDef);
    console.log(JSON.stringify(added, null, 2));
    break;

  case 'remove':
    const removed = scheduler.removeJob(process.argv[3] || '');
    console.log(removed ? 'Removed' : 'Not found');
    break;

  default:
    console.log(`
Elio Scheduler

Usage:
  node dist/index.js start              Start scheduler daemon
  node dist/index.js list               List all jobs
  node dist/index.js add '<json>'       Add a job
  node dist/index.js remove <id>        Remove a job

Example job JSON:
{
  "name": "Daily digest",
  "description": "Morning news summary",
  "cron": "0 8 * * *",
  "enabled": true,
  "skill": "deep-research",
  "skillArgs": ["AI news today", "quick"]
}
`);
}

export { Scheduler };
