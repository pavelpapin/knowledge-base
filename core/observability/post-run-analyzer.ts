/**
 * Post-Run Analyzer
 * Runs after each agent execution to:
 * 1. Analyze issues from the run
 * 2. Generate improvement suggestions
 * 3. Create improvement tasks for nightly processing
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  type RunSummary,
  type AgentIssue,
  aggregateIssues,
  generateImprovementSuggestions
} from './agent-logger.js';

const IMPROVEMENTS_DIR = '/root/.claude/logs/improvements';
const LOGS_DIR = '/root/.claude/logs/agents';

export interface ImprovementTask {
  id: string;
  createdAt: string;
  sourceRunId: string;
  agentType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'data_source' | 'workflow' | 'quality' | 'performance' | 'config';
  title: string;
  description: string;
  suggestedFix?: string;
  relatedIssues: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'wont_fix';
  resolution?: string;
}

export interface AnalysisReport {
  runId: string;
  analyzedAt: string;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    dataQuality: number;
    verificationRate: number;
    overallHealth: 'good' | 'degraded' | 'poor';
  };
  issueBreakdown: Record<string, number>;
  topProblems: string[];
  suggestions: string[];
  improvementTasks: ImprovementTask[];
  nightlyTasks: string[];
}

function ensureDir(): void {
  if (!existsSync(IMPROVEMENTS_DIR)) {
    mkdirSync(IMPROVEMENTS_DIR, { recursive: true });
  }
}

/**
 * Analyze a completed run and generate report
 */
export function analyzeRun(runSummary: RunSummary): AnalysisReport {
  const issues = runSummary.issues;
  const aggregated = aggregateIssues(issues);
  const suggestions = generateImprovementSuggestions(issues);

  // Determine overall health
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const dataQuality = runSummary.metrics.dataQualityScore || 0;

  let overallHealth: 'good' | 'degraded' | 'poor' = 'good';
  if (criticalCount > 0 || dataQuality < 0.5) {
    overallHealth = 'poor';
  } else if (errorCount > 2 || dataQuality < 0.7) {
    overallHealth = 'degraded';
  }

  // Generate improvement tasks
  const improvementTasks = generateImprovementTasks(runSummary, aggregated);

  // Identify tasks for nightly processing
  const nightlyTasks = identifyNightlyTasks(improvementTasks, aggregated);

  // Top problems
  const topProblems = Object.entries(aggregated)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([type, data]) => `${type}: ${data.count} occurrences`);

  const report: AnalysisReport = {
    runId: runSummary.runId,
    analyzedAt: new Date().toISOString(),
    summary: {
      totalIssues: issues.length,
      criticalIssues: criticalCount,
      dataQuality,
      verificationRate: runSummary.metrics.verificationRate || 0,
      overallHealth
    },
    issueBreakdown: Object.fromEntries(
      Object.entries(aggregated).map(([k, v]) => [k, v.count])
    ),
    topProblems,
    suggestions,
    improvementTasks,
    nightlyTasks
  };

  // Save report
  ensureDir();
  const reportFile = join(IMPROVEMENTS_DIR, `analysis-${runSummary.runId}.json`);
  writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Save improvement tasks
  for (const task of improvementTasks) {
    saveImprovementTask(task);
  }

  return report;
}

/**
 * Generate improvement tasks from aggregated issues
 */
function generateImprovementTasks(
  run: RunSummary,
  aggregated: Record<string, { count: number; sources: string[]; suggestions: string[] }>
): ImprovementTask[] {
  const tasks: ImprovementTask[] = [];
  const timestamp = Date.now();

  // Data source failures -> investigate and fix
  if (aggregated.data_source_failed?.count > 0) {
    for (const source of aggregated.data_source_failed.sources) {
      tasks.push({
        id: `improve-${timestamp}-${tasks.length}`,
        createdAt: new Date().toISOString(),
        sourceRunId: run.runId,
        agentType: run.agentType,
        priority: aggregated.data_source_failed.count > 3 ? 'high' : 'medium',
        category: 'data_source',
        title: `Fix data source: ${source}`,
        description: `Data source "${source}" failed ${aggregated.data_source_failed.count} times during ${run.agentType} run.`,
        suggestedFix: `1. Check if API key is valid\n2. Check if endpoint changed\n3. Add fallback source`,
        relatedIssues: run.issues.filter(i => i.context.source === source).map(i => i.timestamp),
        status: 'pending'
      });
    }
  }

  // Blocked sources -> find alternatives
  if (aggregated.data_source_blocked?.count > 0) {
    tasks.push({
      id: `improve-${timestamp}-${tasks.length}`,
      createdAt: new Date().toISOString(),
      sourceRunId: run.runId,
      agentType: run.agentType,
      priority: 'high',
      category: 'data_source',
      title: `Find alternatives for blocked sources`,
      description: `Sources blocking access: ${aggregated.data_source_blocked.sources.join(', ')}`,
      suggestedFix: `1. Research alternative APIs\n2. Try different proxy\n3. Use web search workaround`,
      relatedIssues: [],
      status: 'pending'
    });
  }

  // Quality issues -> review prompts
  if (aggregated.quality_low?.count > 0) {
    tasks.push({
      id: `improve-${timestamp}-${tasks.length}`,
      createdAt: new Date().toISOString(),
      sourceRunId: run.runId,
      agentType: run.agentType,
      priority: 'medium',
      category: 'quality',
      title: `Improve output quality for ${run.agentType}`,
      description: `${aggregated.quality_low.count} low quality outputs detected`,
      suggestedFix: `1. Review and improve prompts\n2. Add quality validation step\n3. Increase source diversity`,
      relatedIssues: [],
      status: 'pending'
    });
  }

  // Verification failures -> add sources
  if (aggregated.verification_failed?.count > 2) {
    tasks.push({
      id: `improve-${timestamp}-${tasks.length}`,
      createdAt: new Date().toISOString(),
      sourceRunId: run.runId,
      agentType: run.agentType,
      priority: 'medium',
      category: 'quality',
      title: `Improve fact verification coverage`,
      description: `${aggregated.verification_failed.count} facts couldn't be verified with 2+ sources`,
      suggestedFix: `1. Add more diverse sources\n2. Implement fuzzy matching for verification\n3. Tag low-confidence facts`,
      relatedIssues: [],
      status: 'pending'
    });
  }

  // Rate limiting -> implement better throttling
  if (aggregated.rate_limited?.count > 0) {
    tasks.push({
      id: `improve-${timestamp}-${tasks.length}`,
      createdAt: new Date().toISOString(),
      sourceRunId: run.runId,
      agentType: run.agentType,
      priority: 'medium',
      category: 'performance',
      title: `Improve rate limiting for ${aggregated.rate_limited.sources.join(', ')}`,
      description: `Hit rate limits during execution`,
      suggestedFix: `1. Add exponential backoff\n2. Implement request queue\n3. Cache more aggressively`,
      relatedIssues: [],
      status: 'pending'
    });
  }

  return tasks;
}

/**
 * Identify which tasks should be processed by nightly agent
 */
function identifyNightlyTasks(
  tasks: ImprovementTask[],
  aggregated: Record<string, { count: number; sources: string[]; suggestions: string[] }>
): string[] {
  const nightlyTasks: string[] = [];

  // Code-related fixes that can be automated
  for (const task of tasks) {
    if (task.category === 'data_source' && task.title.includes('Fix data source')) {
      nightlyTasks.push(`[AUTO-FIX] ${task.title}: Check API connectivity, update endpoints if changed`);
    }

    if (task.category === 'config') {
      nightlyTasks.push(`[AUTO-FIX] ${task.title}: Review and update configuration`);
    }
  }

  // Pattern analysis
  if (Object.keys(aggregated).length > 3) {
    nightlyTasks.push(`[ANALYSIS] Multiple issue types detected. Run pattern analysis across recent runs.`);
  }

  // Source health check
  const failedSources = aggregated.data_source_failed?.sources || [];
  const blockedSources = aggregated.data_source_blocked?.sources || [];
  const allProblematicSources = [...new Set([...failedSources, ...blockedSources])];

  if (allProblematicSources.length > 0) {
    nightlyTasks.push(`[HEALTH-CHECK] Test connectivity to: ${allProblematicSources.join(', ')}`);
  }

  // Documentation update
  if (aggregated.data_source_blocked?.count > 0) {
    nightlyTasks.push(`[DOCS] Update DATA_SOURCES.md with blocked sources status`);
  }

  return nightlyTasks;
}

/**
 * Save improvement task to file
 */
function saveImprovementTask(task: ImprovementTask): void {
  ensureDir();
  const tasksFile = join(IMPROVEMENTS_DIR, 'pending-tasks.json');

  let tasks: ImprovementTask[] = [];
  if (existsSync(tasksFile)) {
    tasks = JSON.parse(readFileSync(tasksFile, 'utf-8'));
  }

  // Check if similar task exists
  const existing = tasks.find(t =>
    t.title === task.title &&
    t.status === 'pending'
  );

  if (!existing) {
    tasks.push(task);
    writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
  }
}

/**
 * Get all pending improvement tasks
 */
export function getPendingTasks(): ImprovementTask[] {
  ensureDir();
  const tasksFile = join(IMPROVEMENTS_DIR, 'pending-tasks.json');

  if (!existsSync(tasksFile)) return [];

  const tasks: ImprovementTask[] = JSON.parse(readFileSync(tasksFile, 'utf-8'));
  return tasks.filter(t => t.status === 'pending');
}

/**
 * Update task status
 */
export function updateTaskStatus(
  taskId: string,
  status: ImprovementTask['status'],
  resolution?: string
): void {
  ensureDir();
  const tasksFile = join(IMPROVEMENTS_DIR, 'pending-tasks.json');

  if (!existsSync(tasksFile)) return;

  const tasks: ImprovementTask[] = JSON.parse(readFileSync(tasksFile, 'utf-8'));
  const task = tasks.find(t => t.id === taskId);

  if (task) {
    task.status = status;
    if (resolution) task.resolution = resolution;
    writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
  }
}

/**
 * Get recent analysis reports
 */
export function getRecentReports(days: number = 7): AnalysisReport[] {
  ensureDir();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const reports: AnalysisReport[] = [];

  const files = readdirSync(IMPROVEMENTS_DIR)
    .filter(f => f.startsWith('analysis-') && f.endsWith('.json'));

  for (const file of files) {
    const report: AnalysisReport = JSON.parse(
      readFileSync(join(IMPROVEMENTS_DIR, file), 'utf-8')
    );
    if (new Date(report.analyzedAt).getTime() > cutoff) {
      reports.push(report);
    }
  }

  return reports.sort((a, b) =>
    new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
  );
}

/**
 * Generate weekly improvement summary
 */
export function generateWeeklySummary(): {
  period: { from: string; to: string };
  totalRuns: number;
  healthDistribution: Record<string, number>;
  topIssues: Array<{ type: string; count: number }>;
  completedImprovements: number;
  pendingImprovements: number;
  recommendations: string[];
} {
  const reports = getRecentReports(7);
  const tasks = getPendingTasks();

  const healthDist: Record<string, number> = { good: 0, degraded: 0, poor: 0 };
  const issueCounts: Record<string, number> = {};

  for (const report of reports) {
    healthDist[report.summary.overallHealth]++;

    for (const [type, count] of Object.entries(report.issueBreakdown)) {
      issueCounts[type] = (issueCounts[type] || 0) + count;
    }
  }

  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  const recommendations: string[] = [];

  if (healthDist.poor > healthDist.good) {
    recommendations.push('Agent health is declining. Prioritize fixing data sources.');
  }

  if (topIssues[0]?.count > 10) {
    recommendations.push(`Focus on fixing "${topIssues[0].type}" - most common issue.`);
  }

  if (tasks.length > 10) {
    recommendations.push('Too many pending improvements. Schedule dedicated fix session.');
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    period: {
      from: weekAgo.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    },
    totalRuns: reports.length,
    healthDistribution: healthDist,
    topIssues,
    completedImprovements: tasks.filter(t => t.status === 'completed').length,
    pendingImprovements: tasks.filter(t => t.status === 'pending').length,
    recommendations
  };
}
