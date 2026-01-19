/**
 * Scheduler Types
 */

export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  cron: string;
  enabled: boolean;
  skill?: string;
  skillArgs?: string[];
  command?: string;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  timestamp: string;
}

export interface SchedulerConfig {
  jobs: ScheduledJob[];
}
