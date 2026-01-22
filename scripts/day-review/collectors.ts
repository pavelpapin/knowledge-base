/**
 * Day Review Collectors
 */

import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config.js';
import { exec, readJsonl, loadJson } from './utils.js';
import type {
  DaySummary,
  ErrorEntry,
  GitChange,
  ConversationEntry,
  WorkflowExecution,
  SystemMetrics,
  ApiHealth
} from './types.js';

export function collectErrors(date: string): DaySummary['errors'] {
  const errors: ErrorEntry[] = [];
  const bySource: Record<string, number> = {};
  const byLevel: Record<string, number> = {};

  // Check error log file
  const errorLogPath = path.join(CONFIG.logsDir, 'errors', `${date}.jsonl`);
  const errorEntries = readJsonl<{ timestamp: string; source: string; level: string; message: string }>(errorLogPath);

  for (const entry of errorEntries) {
    bySource[entry.source] = (bySource[entry.source] || 0) + 1;
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
    errors.push({ ...entry, count: 1 });
  }

  // Scan log files for ERROR pattern
  const logDirs = ['system-loop', 'nightly', 'team'];
  for (const dir of logDirs) {
    const logDir = path.join(CONFIG.logsDir, dir);
    if (!fs.existsSync(logDir)) continue;

    try {
      const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(logDir, file), 'utf-8');
        const errorLines = content.split('\n').filter(line =>
          line.includes('ERROR') || line.includes('[error]') || line.includes('Error:')
        );

        for (const line of errorLines) {
          bySource[dir] = (bySource[dir] || 0) + 1;
          byLevel['error'] = (byLevel['error'] || 0) + 1;

          // Extract timestamp and message
          const match = line.match(/\[([^\]]+)\].*?(ERROR|error|Error:)\s*(.+)/);
          if (match) {
            errors.push({
              timestamp: match[1],
              source: dir,
              level: 'error',
              message: match[3].substring(0, 200),
              count: 1
            });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Aggregate duplicate errors
  const aggregated: Record<string, ErrorEntry> = {};
  for (const error of errors) {
    const key = `${error.source}:${error.message}`;
    if (aggregated[key]) {
      aggregated[key].count++;
    } else {
      aggregated[key] = { ...error };
    }
  }

  const topErrors = Object.values(aggregated)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const total = Object.values(byLevel).reduce((sum, n) => sum + n, 0);
  const critical = errors.filter(e =>
    e.message.toLowerCase().includes('critical') ||
    e.message.toLowerCase().includes('fatal')
  ).length;

  return { total, critical, by_source: bySource, by_level: byLevel, top_errors: topErrors };
}

export function collectGitChanges(): DaySummary['git'] {
  const changes: GitChange[] = [];
  const authors = new Set<string>();
  let totalFiles = 0;
  let totalInsertions = 0;
  let totalDeletions = 0;

  // Get commits from last 24 hours
  const gitLog = exec(
    `cd ${CONFIG.claudeDir} && git log --since="24 hours ago" --pretty=format:'%H|%an|%s|%aI' --shortstat 2>/dev/null`,
    ''
  );

  if (gitLog) {
    const lines = gitLog.split('\n');
    let currentCommit: Partial<GitChange> | null = null;

    for (const line of lines) {
      if (line.includes('|')) {
        // New commit line
        if (currentCommit?.hash) {
          changes.push(currentCommit as GitChange);
        }
        const [hash, author, message, date] = line.split('|');
        currentCommit = {
          hash: hash.substring(0, 7),
          author,
          message,
          date,
          files: 0,
          insertions: 0,
          deletions: 0
        };
        authors.add(author);
      } else if (line.includes('file') || line.includes('insertion') || line.includes('deletion')) {
        // Stats line
        const filesMatch = line.match(/(\d+) files? changed/);
        const insertMatch = line.match(/(\d+) insertions?/);
        const deleteMatch = line.match(/(\d+) deletions?/);

        if (currentCommit) {
          currentCommit.files = filesMatch ? parseInt(filesMatch[1]) : 0;
          currentCommit.insertions = insertMatch ? parseInt(insertMatch[1]) : 0;
          currentCommit.deletions = deleteMatch ? parseInt(deleteMatch[1]) : 0;

          totalFiles += currentCommit.files;
          totalInsertions += currentCommit.insertions;
          totalDeletions += currentCommit.deletions;
        }
      }
    }

    // Push last commit
    if (currentCommit?.hash) {
      changes.push(currentCommit as GitChange);
    }
  }

  return {
    commits: changes.length,
    files_changed: totalFiles,
    lines_added: totalInsertions,
    lines_removed: totalDeletions,
    authors: Array.from(authors),
    changes
  };
}

export function collectConversations(date: string): DaySummary['conversations'] {
  const entries: ConversationEntry[] = [];
  const requests: string[] = [];
  let corrections = 0;
  let positive = 0;
  let negative = 0;

  // Read conversation log (format from extract-conversations.ts)
  const convPath = path.join(CONFIG.outputDir, date, 'conversations.jsonl');

  interface RawEntry {
    timestamp: string;
    type: string;
    content: string;
    sentiment?: string;
    session_id: string;
  }

  const rawEntries = readJsonl<RawEntry>(convPath);

  for (const raw of rawEntries) {
    if (!raw.content) continue;

    const entry: ConversationEntry = {
      timestamp: raw.timestamp,
      type: raw.type as ConversationEntry['type'] || 'message',
      content: raw.content.substring(0, 500),
      sentiment: raw.sentiment as ConversationEntry['sentiment']
    };

    // Count by type
    if (entry.type === 'correction') corrections++;
    if (entry.type === 'request') requests.push(entry.content.substring(0, 100));

    // Count sentiment
    if (entry.sentiment === 'positive') positive++;
    if (entry.sentiment === 'negative') negative++;

    entries.push(entry);
  }

  return {
    total_messages: entries.length,
    corrections,
    requests: requests.slice(0, 10),
    feedback: { positive, negative },
    entries: entries.slice(0, 50)
  };
}

export function collectWorkflowExecutions(): DaySummary['workflows'] {
  const details: WorkflowExecution[] = [];

  // Read system loop state
  interface ItemState {
    lastRun: string;
    lastStatus: string;
    workflowId?: string;
    error?: string;
    duration?: number;
  }
  interface LoopState {
    items: Record<string, ItemState>;
  }

  const state = loadJson<LoopState>(CONFIG.stateFile, { items: {} });
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const [id, item] of Object.entries(state.items)) {
    if (!item.lastRun) continue;

    const runDate = new Date(item.lastRun);
    if (runDate < dayAgo) continue;

    details.push({
      id,
      name: id.split(':')[1] || id,
      status: item.lastStatus === 'success' ? 'success' :
              item.lastStatus === 'failed' ? 'failed' : 'running',
      startedAt: item.lastRun,
      duration: item.duration,
      error: item.error
    });
  }

  const succeeded = details.filter(d => d.status === 'success').length;
  const failed = details.filter(d => d.status === 'failed').length;

  return {
    executed: details.length,
    succeeded,
    failed,
    details
  };
}

export function collectSystemMetrics(): SystemMetrics {
  // Disk usage
  const diskRaw = exec("df -h / | tail -1 | awk '{print $5}'", '0%');

  // Memory usage
  const memRaw = exec("free -m | grep Mem | awk '{print int($3/$2*100)\"%\"}'", '0%');

  // Redis memory
  const redisRaw = exec("redis-cli INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2", 'N/A');

  // Uptime
  const uptimeRaw = exec("uptime -p 2>/dev/null || uptime", 'unknown');

  // Load average
  const loadRaw = exec("cat /proc/loadavg | awk '{print $1, $2, $3}'", '0 0 0');

  return {
    disk_usage: diskRaw,
    memory_usage: memRaw,
    redis_memory: redisRaw.trim() || undefined,
    uptime: uptimeRaw,
    load_average: loadRaw
  };
}

export function checkApiHealth(): ApiHealth {
  const health: ApiHealth = {};

  // Telegram
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN ||
    (() => {
      try {
        const config = JSON.parse(fs.readFileSync('/root/.claude/secrets/telegram.json', 'utf-8'));
        return config.bot_token;
      } catch { return ''; }
    })();

  if (telegramToken) {
    const result = exec(`curl -s -o /dev/null -w "%{http_code}" "https://api.telegram.org/bot${telegramToken}/getMe"`, '0');
    health.telegram = result === '200' ? 'ok' : 'down';
  } else {
    health.telegram = 'unknown';
  }

  // Supabase
  const supabaseUrl = process.env.SUPABASE_URL ||
    (() => {
      try {
        const config = JSON.parse(fs.readFileSync('/root/.claude/secrets/supabase.json', 'utf-8'));
        return config.url;
      } catch { return ''; }
    })();

  if (supabaseUrl) {
    const result = exec(`curl -s -o /dev/null -w "%{http_code}" "${supabaseUrl}/rest/v1/"`, '0');
    health.supabase = result === '200' ? 'ok' : (result === '401' ? 'ok' : 'down');
  } else {
    health.supabase = 'unknown';
  }

  // Redis
  const redisResult = exec('redis-cli ping 2>/dev/null', '');
  health.redis = redisResult === 'PONG' ? 'ok' : 'down';

  // Notion - just check if we have credentials
  const hasNotion = fs.existsSync('/root/.claude/secrets/notion.json');
  health.notion = hasNotion ? 'ok' : 'unknown';

  return health;
}
