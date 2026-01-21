/**
 * Observability Module
 * Exports all logging, analysis, and improvement tools
 */

// Agent logging
export {
  type IssueType,
  type IssueSeverity,
  type AgentIssue,
  type RunSummary,
  type StageLog,
  startRun,
  startStage,
  completeStage,
  logIssue,
  logSourceSuccess,
  completeRun,
  getRunSummary,
  getTodayIssues,
  getRecentIssues,
  aggregateIssues,
  generateImprovementSuggestions
} from './agent-logger.js';

// Post-run analysis
export {
  type ImprovementTask,
  type AnalysisReport,
  analyzeRun,
  getPendingTasks,
  updateTaskStatus,
  getRecentReports,
  generateWeeklySummary
} from './post-run-analyzer.js';

// Nightly agent
export {
  runNightlyImprovement,
  getLastNightlyReport,
  shouldRunNightly
} from './nightly-agent.js';

/**
 * Quick helper to wrap agent execution with logging
 */
export async function withObservability<T>(
  agentType: string,
  topic: string,
  fn: (runId: string) => Promise<T>
): Promise<{ result: T; runId: string; summary: RunSummary | null }> {
  const { startRun, completeRun, getRunSummary } = await import('./agent-logger.js');
  const { analyzeRun } = await import('./post-run-analyzer.js');

  const runId = startRun(agentType, topic);

  try {
    const result = await fn(runId);
    const summary = completeRun(runId, 'completed');

    // Run post-analysis
    if (summary) {
      analyzeRun(summary);
    }

    return { result, runId, summary };
  } catch (error) {
    const summary = completeRun(runId, 'failed');

    if (summary) {
      analyzeRun(summary);
    }

    throw error;
  }
}
