/**
 * Progress Reporter
 * Sends real-time progress updates to Telegram
 */

import { fileLogger } from './file-logger.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export interface ProgressStage {
  name: string;
  percent: number;
}

export interface RunProgress {
  runId: string;
  task: string;
  stages: ProgressStage[];
  currentStage: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  error?: string;
  result?: {
    type: 'notion' | 'file' | 'message';
    url?: string;
    path?: string;
  };
}

// In-memory store for active runs
const activeRuns = new Map<string, RunProgress>();

/**
 * Send message to Telegram
 */
async function sendTelegram(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    fileLogger.warn('progress', 'Telegram not configured, skipping notification');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      fileLogger.error('progress', `Telegram send failed: ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    fileLogger.error('progress', `Telegram send error: ${error}`);
    return false;
  }
}

/**
 * Start a new tracked run
 */
export async function startRun(
  runId: string,
  task: string,
  stages: string[]
): Promise<void> {
  const progress: RunProgress = {
    runId,
    task,
    stages: stages.map((name, i) => ({
      name,
      percent: Math.round(((i + 1) / stages.length) * 100)
    })),
    currentStage: 0,
    status: 'running',
    startedAt: new Date()
  };

  activeRuns.set(runId, progress);

  fileLogger.info('progress', `Run started: ${runId}`, { task, stages });

  await sendTelegram(
    `🚀 <b>Started:</b> ${task}\n` +
    `📋 Stages: ${stages.length}\n` +
    `🆔 Run: <code>${runId}</code>`
  );
}

/**
 * Update progress to next stage
 */
export async function updateStage(
  runId: string,
  stageName: string,
  details?: string
): Promise<void> {
  const run = activeRuns.get(runId);
  if (!run) {
    fileLogger.warn('progress', `Unknown run: ${runId}`);
    return;
  }

  // Find stage index
  const stageIndex = run.stages.findIndex(s => s.name === stageName);
  if (stageIndex === -1) {
    // Add ad-hoc stage
    run.stages.push({ name: stageName, percent: 0 });
    run.currentStage = run.stages.length - 1;
  } else {
    run.currentStage = stageIndex;
  }

  const stage = run.stages[run.currentStage];
  const total = run.stages.length;
  const current = run.currentStage + 1;

  fileLogger.info('progress', `Stage: ${stageName}`, { runId, current, total, details });

  await sendTelegram(
    `📋 <b>${current}/${total}</b> ${stageName} (${stage.percent}%)\n` +
    (details ? `└ ${details}` : '')
  );
}

/**
 * Report progress within a stage (substeps)
 */
export async function reportSubstep(
  runId: string,
  message: string
): Promise<void> {
  const run = activeRuns.get(runId);
  if (!run) return;

  fileLogger.debug('progress', message, { runId });

  // Don't spam Telegram with substeps, just log
}

/**
 * Complete a run successfully
 */
export async function completeRun(
  runId: string,
  result: RunProgress['result']
): Promise<void> {
  const run = activeRuns.get(runId);
  if (!run) {
    fileLogger.warn('progress', `Unknown run: ${runId}`);
    return;
  }

  run.status = 'completed';
  run.result = result;

  const duration = Math.round((Date.now() - run.startedAt.getTime()) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  fileLogger.info('progress', `Run completed: ${runId}`, { duration, result });

  let resultText = '';
  if (result?.url) {
    resultText = `\n🔗 ${result.url}`;
  } else if (result?.path) {
    resultText = `\n📁 ${result.path}`;
  }

  await sendTelegram(
    `✅ <b>Completed:</b> ${run.task}\n` +
    `⏱ Duration: ${minutes}m ${seconds}s` +
    resultText
  );

  activeRuns.delete(runId);
}

/**
 * Fail a run
 */
export async function failRun(
  runId: string,
  error: string
): Promise<void> {
  const run = activeRuns.get(runId);
  if (!run) {
    fileLogger.warn('progress', `Unknown run: ${runId}`);
    return;
  }

  run.status = 'failed';
  run.error = error;

  fileLogger.error('progress', `Run failed: ${runId}`, { error });

  await sendTelegram(
    `❌ <b>Failed:</b> ${run.task}\n` +
    `🆔 Run: <code>${runId}</code>\n` +
    `⚠️ Error: ${error}`
  );

  activeRuns.delete(runId);
}

/**
 * Get current progress for a run
 */
export function getProgress(runId: string): RunProgress | undefined {
  return activeRuns.get(runId);
}

/**
 * List all active runs
 */
export function listActiveRuns(): RunProgress[] {
  return Array.from(activeRuns.values());
}

/**
 * Generate unique run ID
 */
export function generateRunId(prefix: string = 'run'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}

// Export for direct Telegram notifications (bypass run tracking)
export { sendTelegram as notifyTelegram };
