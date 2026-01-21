/**
 * Agent Error & Issue Logger
 * Logs non-technical issues: data source failures, missing info, quality problems
 * Used for post-run analysis and self-improvement
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = '/root/.claude/logs/agents';
const ISSUES_DIR = '/root/.claude/logs/issues';

// Issue types (non-technical, semantic problems)
export type IssueType =
  | 'data_source_failed'      // Source returned empty/error
  | 'data_source_blocked'     // Source actively blocked us
  | 'data_incomplete'         // Got data but missing key fields
  | 'data_stale'              // Data is outdated
  | 'data_conflict'           // Multiple sources disagree
  | 'verification_failed'     // Couldn't verify with 2+ sources
  | 'quality_low'             // Result quality below threshold
  | 'timeout'                 // Operation took too long
  | 'rate_limited'            // Hit rate limit
  | 'missing_context'         // Needed info not available
  | 'tool_mismatch'           // Tool returned unexpected format
  | 'workflow_stuck'          // Agent couldn't proceed
  | 'user_feedback_negative'; // User indicated bad result

export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AgentIssue {
  timestamp: string;
  runId: string;
  agentType: string;
  stage: string;
  issueType: IssueType;
  severity: IssueSeverity;
  message: string;
  context: {
    source?: string;
    query?: string;
    expected?: string;
    actual?: string;
    suggestion?: string;
    [key: string]: unknown;
  };
}

export interface RunSummary {
  runId: string;
  agentType: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  topic?: string;
  stages: StageLog[];
  issues: AgentIssue[];
  metrics: {
    totalSources: number;
    successfulSources: number;
    failedSources: number;
    dataQualityScore?: number;
    verificationRate?: number;
  };
  deliverable?: {
    type: string;
    url?: string;
    path?: string;
  };
}

export interface StageLog {
  stage: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  details?: string;
}

// In-memory store for current runs
const activeRuns = new Map<string, RunSummary>();

function ensureDirs(): void {
  if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });
  if (!existsSync(ISSUES_DIR)) mkdirSync(ISSUES_DIR, { recursive: true });
}

/**
 * Start tracking a new agent run
 */
export function startRun(agentType: string, topic?: string): string {
  ensureDirs();
  const runId = `${agentType}-${Date.now()}`;

  const summary: RunSummary = {
    runId,
    agentType,
    startedAt: new Date().toISOString(),
    status: 'running',
    topic,
    stages: [],
    issues: [],
    metrics: {
      totalSources: 0,
      successfulSources: 0,
      failedSources: 0
    }
  };

  activeRuns.set(runId, summary);
  console.log(`[AgentLogger] Started run: ${runId}`);
  return runId;
}

/**
 * Log stage start
 */
export function startStage(runId: string, stage: string): void {
  const run = activeRuns.get(runId);
  if (!run) return;

  run.stages.push({
    stage,
    startedAt: new Date().toISOString(),
    status: 'running'
  });
}

/**
 * Log stage completion
 */
export function completeStage(
  runId: string,
  stage: string,
  status: 'completed' | 'failed' | 'skipped' = 'completed',
  details?: string
): void {
  const run = activeRuns.get(runId);
  if (!run) return;

  const stageLog = run.stages.find(s => s.stage === stage && s.status === 'running');
  if (stageLog) {
    stageLog.completedAt = new Date().toISOString();
    stageLog.status = status;
    stageLog.details = details;
  }
}

/**
 * Log an issue (the main function)
 */
export function logIssue(
  runId: string,
  issueType: IssueType,
  message: string,
  context: AgentIssue['context'] = {},
  severity: IssueSeverity = 'warning'
): void {
  const run = activeRuns.get(runId);
  const currentStage = run?.stages.find(s => s.status === 'running')?.stage || 'unknown';

  const issue: AgentIssue = {
    timestamp: new Date().toISOString(),
    runId,
    agentType: run?.agentType || 'unknown',
    stage: currentStage,
    issueType,
    severity,
    message,
    context
  };

  // Add to run summary
  if (run) {
    run.issues.push(issue);

    // Update metrics
    if (issueType === 'data_source_failed' || issueType === 'data_source_blocked') {
      run.metrics.failedSources++;
    }
  }

  // Also append to daily issues log
  const today = new Date().toISOString().split('T')[0];
  const issuesFile = join(ISSUES_DIR, `${today}.jsonl`);
  appendFileSync(issuesFile, JSON.stringify(issue) + '\n');

  // Console log for visibility
  const emoji = severity === 'critical' ? '🔴' :
                severity === 'error' ? '🟠' :
                severity === 'warning' ? '🟡' : '🔵';
  console.log(`${emoji} [${issueType}] ${message}`);
}

/**
 * Log successful data source
 */
export function logSourceSuccess(runId: string, source: string, recordCount?: number): void {
  const run = activeRuns.get(runId);
  if (run) {
    run.metrics.totalSources++;
    run.metrics.successfulSources++;
  }
  console.log(`[AgentLogger] Source OK: ${source}${recordCount ? ` (${recordCount} records)` : ''}`);
}

/**
 * Complete the run and save summary
 */
export function completeRun(
  runId: string,
  status: 'completed' | 'failed' | 'partial' = 'completed',
  deliverable?: RunSummary['deliverable']
): RunSummary | null {
  const run = activeRuns.get(runId);
  if (!run) return null;

  run.completedAt = new Date().toISOString();
  run.status = status;
  run.deliverable = deliverable;

  // Calculate quality score
  if (run.metrics.totalSources > 0) {
    run.metrics.dataQualityScore =
      run.metrics.successfulSources / run.metrics.totalSources;
  }

  // Calculate verification rate (issues with verification_failed)
  const verificationIssues = run.issues.filter(i => i.issueType === 'verification_failed').length;
  const totalFacts = run.metrics.successfulSources * 3; // rough estimate
  if (totalFacts > 0) {
    run.metrics.verificationRate = 1 - (verificationIssues / totalFacts);
  }

  // Save to file
  const runFile = join(LOGS_DIR, `${runId}.json`);
  writeFileSync(runFile, JSON.stringify(run, null, 2));

  // Remove from active
  activeRuns.delete(runId);

  console.log(`[AgentLogger] Run completed: ${runId} (${status})`);
  console.log(`[AgentLogger] Issues: ${run.issues.length}, Sources: ${run.metrics.successfulSources}/${run.metrics.totalSources}`);

  return run;
}

/**
 * Get current run summary (for progress display)
 */
export function getRunSummary(runId: string): RunSummary | null {
  return activeRuns.get(runId) || null;
}

/**
 * Get issues from today
 */
export function getTodayIssues(): AgentIssue[] {
  ensureDirs();
  const today = new Date().toISOString().split('T')[0];
  const issuesFile = join(ISSUES_DIR, `${today}.jsonl`);

  if (!existsSync(issuesFile)) return [];

  return readFileSync(issuesFile, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as AgentIssue);
}

/**
 * Get issues from last N days
 */
export function getRecentIssues(days: number = 7): AgentIssue[] {
  ensureDirs();
  const issues: AgentIssue[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const issuesFile = join(ISSUES_DIR, `${dateStr}.jsonl`);

    if (existsSync(issuesFile)) {
      const dayIssues = readFileSync(issuesFile, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as AgentIssue);
      issues.push(...dayIssues);
    }
  }

  return issues;
}

/**
 * Aggregate issues by type for analysis
 */
export function aggregateIssues(issues: AgentIssue[]): Record<IssueType, {
  count: number;
  sources: string[];
  suggestions: string[];
}> {
  const agg: Record<string, { count: number; sources: Set<string>; suggestions: Set<string> }> = {};

  for (const issue of issues) {
    if (!agg[issue.issueType]) {
      agg[issue.issueType] = { count: 0, sources: new Set(), suggestions: new Set() };
    }
    agg[issue.issueType].count++;
    if (issue.context.source) agg[issue.issueType].sources.add(issue.context.source);
    if (issue.context.suggestion) agg[issue.issueType].suggestions.add(issue.context.suggestion);
  }

  // Convert Sets to arrays
  const result: Record<string, { count: number; sources: string[]; suggestions: string[] }> = {};
  for (const [key, value] of Object.entries(agg)) {
    result[key] = {
      count: value.count,
      sources: Array.from(value.sources),
      suggestions: Array.from(value.suggestions)
    };
  }

  return result as Record<IssueType, { count: number; sources: string[]; suggestions: string[] }>;
}

/**
 * Generate improvement suggestions based on issues
 */
export function generateImprovementSuggestions(issues: AgentIssue[]): string[] {
  const suggestions: string[] = [];
  const agg = aggregateIssues(issues);

  // Data source failures
  if (agg.data_source_failed?.count > 3) {
    const sources = agg.data_source_failed.sources.join(', ');
    suggestions.push(`Multiple data source failures (${agg.data_source_failed.count}x). Review sources: ${sources}`);
  }

  // Blocked sources
  if (agg.data_source_blocked?.count > 0) {
    suggestions.push(`Sources actively blocking us: ${agg.data_source_blocked.sources.join(', ')}. Consider alternative sources or proxy rotation.`);
  }

  // Verification issues
  if (agg.verification_failed?.count > 2) {
    suggestions.push(`Verification failing often (${agg.verification_failed.count}x). Add more diverse sources or relax 2-source rule for specific data types.`);
  }

  // Rate limiting
  if (agg.rate_limited?.count > 0) {
    suggestions.push(`Hit rate limits on: ${agg.rate_limited.sources.join(', ')}. Implement better rate limiting or use cached data.`);
  }

  // Quality issues
  if (agg.quality_low?.count > 0) {
    suggestions.push(`Low quality results detected. Review prompts and add quality gates.`);
  }

  // Timeout issues
  if (agg.timeout?.count > 0) {
    suggestions.push(`Timeouts occurring. Consider parallel fetching or increasing limits.`);
  }

  return suggestions;
}
