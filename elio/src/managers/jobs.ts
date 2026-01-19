/**
 * Job Manager
 * Async task queue
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { Job, SkillConfig } from '../types';
import { JOBS_QUEUE, JOBS_ACTIVE, JOBS_COMPLETED, JOBS_FAILED, SKILLS_DIR } from '../utils/paths';
import { readJson, writeJson, listJsonFiles, ensureDir } from '../utils/fs';

function generateId(): string {
  return crypto.randomUUID();
}

function jobPath(id: string, dir: string): string {
  return path.join(dir, `${id}.json`);
}

export function createJob(
  type: string,
  skill: string,
  inputs: Record<string, unknown>,
  requestedBy: string,
  priority = 1
): Job {
  ensureDir(JOBS_QUEUE);

  const job: Job = {
    id: generateId(),
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    status: 'queued',
    type,
    skill,
    inputs,
    progress: 0,
    logs: [],
    result: null,
    error: null,
    requested_by: requestedBy,
    priority,
    timeout: 600
  };

  writeJson(jobPath(job.id, JOBS_QUEUE), job);
  return job;
}

export function loadJob(id: string): Job | null {
  for (const dir of [JOBS_ACTIVE, JOBS_QUEUE, JOBS_COMPLETED, JOBS_FAILED]) {
    const job = readJson<Job>(jobPath(id, dir));
    if (job) return job;
  }
  return null;
}

function moveJob(id: string, from: string, to: string): Job | null {
  const fromPath = jobPath(id, from);
  const toPath = jobPath(id, to);

  if (!fs.existsSync(fromPath)) return null;

  const job = readJson<Job>(fromPath);
  if (!job) return null;

  ensureDir(to);
  writeJson(toPath, job);
  fs.unlinkSync(fromPath);
  return job;
}

function addLog(job: Job, message: string, dir: string): void {
  job.logs.push({ timestamp: new Date().toISOString(), message });
  writeJson(jobPath(job.id, dir), job);
}

export async function runJob(id: string): Promise<Job | null> {
  const job = moveJob(id, JOBS_QUEUE, JOBS_ACTIVE);
  if (!job) return null;

  job.status = 'running';
  job.started_at = new Date().toISOString();
  addLog(job, 'Job started', JOBS_ACTIVE);

  try {
    const skillPath = path.join(SKILLS_DIR, job.skill, 'skill.json');
    const skillConfig = readJson<SkillConfig>(skillPath);

    if (!skillConfig) {
      throw new Error(`Skill not found: ${job.skill}`);
    }

    const entrypoint = path.join(SKILLS_DIR, job.skill, skillConfig.entrypoint);
    const args = Object.values(job.inputs).map(String);

    addLog(job, `Running: ${entrypoint} ${args.join(' ')}`, JOBS_ACTIVE);

    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn(entrypoint, args, {
        cwd: path.join(SKILLS_DIR, job.skill),
        timeout: (job.timeout || 600) * 1000
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`Exit code ${code}: ${stderr}`));
      });

      proc.on('error', reject);
    });

    try {
      job.result = JSON.parse(result.stdout);
    } catch {
      job.result = { raw: result.stdout };
    }

    job.completed_at = new Date().toISOString();
    job.status = 'completed';
    job.progress = 100;
    addLog(job, 'Job completed', JOBS_ACTIVE);

    moveJob(job.id, JOBS_ACTIVE, JOBS_COMPLETED);
    return job;

  } catch (err) {
    const error = err as Error;
    job.error = error.message;
    job.completed_at = new Date().toISOString();
    job.status = 'failed';
    addLog(job, `Job failed: ${error.message}`, JOBS_ACTIVE);

    moveJob(job.id, JOBS_ACTIVE, JOBS_FAILED);
    return job;
  }
}

export function getQueuedJobs(): Job[] {
  ensureDir(JOBS_QUEUE);
  return listJsonFiles(JOBS_QUEUE)
    .map(f => readJson<Job>(path.join(JOBS_QUEUE, f)))
    .filter((j): j is Job => j !== null)
    .sort((a, b) => b.priority - a.priority);
}

export function getActiveJobs(): Job[] {
  ensureDir(JOBS_ACTIVE);
  return listJsonFiles(JOBS_ACTIVE)
    .map(f => readJson<Job>(path.join(JOBS_ACTIVE, f)))
    .filter((j): j is Job => j !== null);
}
