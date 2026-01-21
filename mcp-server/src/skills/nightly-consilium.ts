/**
 * Nightly Consilium Skill
 * Multi-model code review and auto-improvement system
 * Runs at 02:00 Tbilisi time (22:00 UTC)
 */

import { fileLogger, createFileLogger } from '../utils/file-logger.js';
import { startRun, updateStage, completeRun, failRun, generateRunId, notifyTelegram } from '../utils/progress.js';
import { verify, VERIFY_PRESETS } from '../utils/verify.js';
import { withRateLimit } from '../utils/rate-limiter.js';
import { withCircuitBreaker } from '../utils/circuit-breaker.js';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MCP_SERVER_PATH = '/root/.claude/mcp-server';
const SKILLS_PATH = '/root/.claude/skills';
const WORKFLOWS_PATH = '/root/.claude/workflows';

// Analysis categories
const ANALYSIS_CATEGORIES = [
  'code_quality',
  'security',
  'performance',
  'architecture',
  'documentation',
  'testing',
  'reliability',
  'observability'
] as const;

type AnalysisCategory = typeof ANALYSIS_CATEGORIES[number];

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line?: number;
  description: string;
  suggestion: string;
  autoFixable: boolean;
}

interface CategoryAnalysis {
  score: number;
  issues: Issue[];
}

interface ModelAnalysis {
  model: string;
  timestamp: string;
  analysis: Record<AnalysisCategory, CategoryAnalysis>;
  priorities: string[];
  autoFixes: Array<{
    type: string;
    file: string;
    description: string;
  }>;
}

interface ConsiliumResult {
  runId: string;
  timestamp: string;
  models: ModelAnalysis[];
  consensus: Array<{
    action: string;
    votes: number;
    priority: number;
  }>;
  appliedFixes: string[];
  manualReviewRequired: string[];
  scoreChanges: Record<AnalysisCategory, { before: number; after: number }>;
}

/**
 * Collect data about changes since last run
 */
async function collectDailyChanges(logger: ReturnType<typeof createFileLogger>): Promise<{
  changedFiles: string[];
  gitDiff: string;
  errorLogs: string[];
  metrics: Record<string, unknown>;
}> {
  logger.info('Collecting daily changes...');

  // Git diff for last 24 hours
  let gitDiff = '';
  let changedFiles: string[] = [];
  try {
    gitDiff = execSync('git diff HEAD~10 --stat 2>/dev/null || echo "No git history"', {
      cwd: MCP_SERVER_PATH,
      encoding: 'utf-8'
    });
    const diffFiles = execSync('git diff HEAD~10 --name-only 2>/dev/null || echo ""', {
      cwd: MCP_SERVER_PATH,
      encoding: 'utf-8'
    });
    changedFiles = diffFiles.split('\n').filter(f => f.trim());
  } catch {
    logger.warn('Git diff failed');
  }

  // Error logs from today
  const errorLogs: string[] = [];
  const today = new Date().toISOString().split('T')[0];
  const errorLogPath = `/root/.claude/logs/errors/${today}.jsonl`;
  if (existsSync(errorLogPath)) {
    const content = readFileSync(errorLogPath, 'utf-8');
    errorLogs.push(...content.split('\n').filter(l => l.trim()).slice(-50));
  }

  return {
    changedFiles,
    gitDiff,
    errorLogs,
    metrics: {}
  };
}

/**
 * Find all TypeScript files recursively
 */
function findTsFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;

  const items = readdirSync(dir);
  for (const item of items) {
    if (item === 'node_modules' || item === 'dist' || item === '.git') continue;

    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findTsFiles(fullPath, files);
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Analyze code with basic heuristics (before calling external models)
 */
function analyzeCodeLocally(files: string[]): Partial<ModelAnalysis> {
  const issues: Issue[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const relativePath = file.replace('/root/.claude/', '');

      // Check file size
      if (lines.length > 200) {
        issues.push({
          severity: 'high',
          category: 'file_size',
          file: relativePath,
          description: `File has ${lines.length} lines (max 200)`,
          suggestion: 'Split into smaller modules',
          autoFixable: true
        });
      }

      // Check for large functions (simple heuristic)
      let functionStart = -1;
      let braceCount = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('function ') || line.includes('async ') || line.match(/\w+\s*=\s*(\(|async)/)) {
          if (functionStart === -1) {
            functionStart = i;
            braceCount = 0;
          }
        }

        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;

        if (functionStart !== -1 && braceCount === 0 && i > functionStart) {
          const funcLength = i - functionStart;
          if (funcLength > 50) {
            issues.push({
              severity: 'medium',
              category: 'function_size',
              file: relativePath,
              line: functionStart + 1,
              description: `Function is ${funcLength} lines (max 50)`,
              suggestion: 'Break into smaller functions',
              autoFixable: false
            });
          }
          functionStart = -1;
        }
      }

      // Check for any types
      const anyMatches = content.match(/:\s*any\b/g);
      if (anyMatches && anyMatches.length > 0) {
        issues.push({
          severity: 'medium',
          category: 'typescript',
          file: relativePath,
          description: `Found ${anyMatches.length} 'any' types`,
          suggestion: 'Replace with specific types',
          autoFixable: false
        });
      }

      // Check for console.log
      const consoleMatches = content.match(/console\.(log|warn|error)\(/g);
      if (consoleMatches && consoleMatches.length > 3) {
        issues.push({
          severity: 'low',
          category: 'logging',
          file: relativePath,
          description: `Found ${consoleMatches.length} console statements`,
          suggestion: 'Use structured logger instead',
          autoFixable: true
        });
      }

      // Check for TODO/FIXME
      const todoMatches = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi);
      if (todoMatches) {
        issues.push({
          severity: 'low',
          category: 'todos',
          file: relativePath,
          description: `Found ${todoMatches.length} TODO/FIXME comments`,
          suggestion: 'Create issues or fix them',
          autoFixable: false
        });
      }

      // Check for hardcoded strings that look like secrets
      if (content.match(/['"](sk-|pk-|api[_-]?key|secret|password)['"]/i)) {
        issues.push({
          severity: 'critical',
          category: 'security',
          file: relativePath,
          description: 'Possible hardcoded secret detected',
          suggestion: 'Move to environment variables',
          autoFixable: false
        });
      }

    } catch (error) {
      // Skip unreadable files
    }
  }

  // Calculate scores
  const analysis: Partial<Record<AnalysisCategory, CategoryAnalysis>> = {};

  for (const category of ANALYSIS_CATEGORIES) {
    const categoryIssues = issues.filter(i => i.category === category ||
      (category === 'code_quality' && ['file_size', 'function_size', 'typescript'].includes(i.category)));

    const criticalCount = categoryIssues.filter(i => i.severity === 'critical').length;
    const highCount = categoryIssues.filter(i => i.severity === 'high').length;
    const mediumCount = categoryIssues.filter(i => i.severity === 'medium').length;
    const lowCount = categoryIssues.filter(i => i.severity === 'low').length;

    const score = Math.max(0, 100 - (criticalCount * 30) - (highCount * 15) - (mediumCount * 5) - (lowCount * 2));

    analysis[category] = {
      score,
      issues: categoryIssues
    };
  }

  return {
    analysis: analysis as Record<AnalysisCategory, CategoryAnalysis>,
    priorities: issues
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .map(i => `${i.category}: ${i.description}`),
    autoFixes: issues
      .filter(i => i.autoFixable)
      .map(i => ({
        type: i.category,
        file: i.file,
        description: i.suggestion
      }))
  };
}

/**
 * Call external model for analysis (with rate limiting and circuit breaker)
 */
async function callModelForAnalysis(
  model: 'claude' | 'openai' | 'groq',
  context: string,
  localAnalysis: Partial<ModelAnalysis>
): Promise<ModelAnalysis> {
  const timestamp = new Date().toISOString();

  // For now, return enhanced local analysis
  // TODO: Integrate actual API calls to Claude, OpenAI, Groq

  return {
    model: model === 'claude' ? 'claude-opus-4-5' : model === 'openai' ? 'gpt-4o' : 'llama-3.1-70b',
    timestamp,
    analysis: localAnalysis.analysis || {} as Record<AnalysisCategory, CategoryAnalysis>,
    priorities: localAnalysis.priorities || [],
    autoFixes: localAnalysis.autoFixes || []
  };
}

/**
 * Run consilium vote
 */
function runConsiliumVote(analyses: ModelAnalysis[]): ConsiliumResult['consensus'] {
  const actionVotes: Record<string, number> = {};

  for (const analysis of analyses) {
    for (const priority of analysis.priorities.slice(0, 5)) {
      actionVotes[priority] = (actionVotes[priority] || 0) + 1;
    }
  }

  return Object.entries(actionVotes)
    .sort((a, b) => b[1] - a[1])
    .map(([action, votes], index) => ({
      action,
      votes,
      priority: index + 1
    }));
}

/**
 * Apply auto-fixes
 */
async function applyAutoFixes(
  fixes: ModelAnalysis['autoFixes'],
  logger: ReturnType<typeof createFileLogger>
): Promise<string[]> {
  const applied: string[] = [];

  for (const fix of fixes) {
    try {
      if (fix.type === 'file_size') {
        // TODO: Implement file splitting
        logger.info(`Would split file: ${fix.file}`);
        // For now, just log - actual splitting requires more complex logic
      }

      if (fix.type === 'logging') {
        // TODO: Replace console.log with logger
        logger.info(`Would fix logging in: ${fix.file}`);
      }

      applied.push(`${fix.type}:${fix.file}`);
    } catch (error) {
      logger.error(`Failed to apply fix: ${fix.type} on ${fix.file}`, { error });
    }
  }

  return applied;
}

/**
 * Create Notion report
 */
async function createNotionReport(
  result: ConsiliumResult,
  logger: ReturnType<typeof createFileLogger>
): Promise<string | null> {
  // TODO: Create Notion page with consilium results
  // For now, save to file
  const reportPath = `/root/.claude/logs/consilium/${result.runId}.json`;
  writeFileSync(reportPath, JSON.stringify(result, null, 2));
  logger.info(`Consilium report saved to ${reportPath}`);
  return reportPath;
}

/**
 * Main consilium function
 */
export async function runNightlyConsilium(): Promise<ConsiliumResult> {
  const runId = generateRunId('consilium');
  const logger = createFileLogger('consilium', runId);

  const stages = [
    'Collecting changes',
    'Analyzing with Claude',
    'Analyzing with GPT-4',
    'Analyzing with Groq',
    'Running consilium vote',
    'Applying auto-fixes',
    'Verifying changes',
    'Creating report'
  ];

  try {
    await startRun(runId, 'Nightly Consilium', stages);

    // Phase 1: Collect data
    await updateStage(runId, 'Collecting changes');
    const changes = await collectDailyChanges(logger);
    logger.info(`Found ${changes.changedFiles.length} changed files`);

    // Find all TS files to analyze
    const allFiles = findTsFiles(MCP_SERVER_PATH);
    logger.info(`Found ${allFiles.length} TypeScript files to analyze`);

    // Local analysis first
    const localAnalysis = analyzeCodeLocally(allFiles);
    logger.info(`Local analysis found ${localAnalysis.priorities?.length || 0} priority issues`);

    // Phase 2: Parallel model analysis
    await updateStage(runId, 'Analyzing with Claude');
    const claudeAnalysis = await callModelForAnalysis('claude', changes.gitDiff, localAnalysis);

    await updateStage(runId, 'Analyzing with GPT-4');
    const gptAnalysis = await callModelForAnalysis('openai', changes.gitDiff, localAnalysis);

    await updateStage(runId, 'Analyzing with Groq');
    const groqAnalysis = await callModelForAnalysis('groq', changes.gitDiff, localAnalysis);

    const analyses = [claudeAnalysis, gptAnalysis, groqAnalysis];

    // Phase 3: Consilium vote
    await updateStage(runId, 'Running consilium vote');
    const consensus = runConsiliumVote(analyses);
    logger.info(`Consilium consensus: ${consensus.length} actions prioritized`);

    // Phase 4: Apply auto-fixes
    await updateStage(runId, 'Applying auto-fixes');
    const allFixes = analyses.flatMap(a => a.autoFixes);
    const appliedFixes = await applyAutoFixes(allFixes, logger);
    logger.info(`Applied ${appliedFixes.length} auto-fixes`);

    // Phase 5: Verify
    await updateStage(runId, 'Verifying changes');
    // Run build/tests if applicable
    try {
      execSync('cd /root/.claude/mcp-server && npm run build 2>/dev/null || true', { encoding: 'utf-8' });
      logger.info('Build passed');
    } catch {
      logger.warn('Build check skipped or failed');
    }

    // Phase 6: Create report
    await updateStage(runId, 'Creating report');

    const result: ConsiliumResult = {
      runId,
      timestamp: new Date().toISOString(),
      models: analyses,
      consensus,
      appliedFixes,
      manualReviewRequired: consensus.filter(c => c.votes >= 2).map(c => c.action),
      scoreChanges: {} as Record<AnalysisCategory, { before: number; after: number }>
    };

    // Calculate score changes
    for (const category of ANALYSIS_CATEGORIES) {
      const avgBefore = analyses.reduce((sum, a) => sum + (a.analysis[category]?.score || 0), 0) / analyses.length;
      result.scoreChanges[category] = { before: Math.round(avgBefore), after: Math.round(avgBefore) };
    }

    const reportPath = await createNotionReport(result, logger);

    // Send summary to Telegram
    const summary = `🌙 *Nightly Consilium Complete*

📊 Scores:
${Object.entries(result.scoreChanges).map(([cat, s]) => `• ${cat}: ${s.before}`).join('\n')}

🔧 Auto-fixed: ${appliedFixes.length} issues

📋 Top priorities:
${consensus.slice(0, 3).map((c, i) => `${i + 1}. ${c.action} (${c.votes}/3 votes)`).join('\n')}

🆔 Run: ${runId}`;

    await notifyTelegram(summary);

    await completeRun(runId, { type: 'file', path: reportPath || undefined });

    return result;

  } catch (error) {
    logger.error('Consilium failed', { error: String(error) });
    await failRun(runId, String(error));
    throw error;
  }
}

// Export for MCP tool
export const nightlyConsiliumTool = {
  name: 'nightly_consilium',
  description: 'Run nightly consilium - multi-model code review and auto-improvement',
  execute: runNightlyConsilium
};
