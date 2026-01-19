/**
 * Job Executor
 * Runs skills or commands for scheduled jobs
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { ScheduledJob, JobResult } from './types.js';

const SKILLS_DIR = '/root/.claude/skills';

export async function executeJob(job: ScheduledJob): Promise<JobResult> {
  const startTime = Date.now();

  try {
    let output: string;

    if (job.skill) {
      output = await runSkill(job.skill, job.skillArgs || []);
    } else if (job.command) {
      output = await runCommand(job.command);
    } else {
      throw new Error('Job must have either skill or command');
    }

    return {
      jobId: job.id,
      success: true,
      output,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      jobId: job.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

async function runSkill(skillName: string, args: string[]): Promise<string> {
  const skillDir = path.join(SKILLS_DIR, skillName);
  const runScript = path.join(skillDir, 'run.sh');

  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [runScript, ...args], {
      cwd: skillDir,
      timeout: 300000
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
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || stdout || `Exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], {
      timeout: 300000
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
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || stdout || `Exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}
