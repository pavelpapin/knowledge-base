/**
 * Day Review Types
 */

export interface ErrorEntry {
  timestamp: string;
  source: string;
  level: string;
  message: string;
  count: number;
}

export interface GitChange {
  hash: string;
  author: string;
  message: string;
  date: string;
  files: number;
  insertions: number;
  deletions: number;
}

export interface ConversationEntry {
  timestamp: string;
  type: 'message' | 'correction' | 'feedback' | 'request';
  content: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface WorkflowExecution {
  id: string;
  name: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  duration?: number;
  error?: string;
}

export interface SystemMetrics {
  disk_usage: string;
  memory_usage: string;
  redis_memory?: string;
  uptime: string;
  load_average: string;
}

export interface ApiHealth {
  [key: string]: 'ok' | 'degraded' | 'down' | 'unknown';
}

export interface DaySummary {
  date: string;
  generated_at: string;

  errors: {
    total: number;
    critical: number;
    by_source: Record<string, number>;
    by_level: Record<string, number>;
    top_errors: ErrorEntry[];
  };

  git: {
    commits: number;
    files_changed: number;
    lines_added: number;
    lines_removed: number;
    authors: string[];
    changes: GitChange[];
  };

  conversations: {
    total_messages: number;
    corrections: number;
    requests: string[];
    feedback: { positive: number; negative: number };
    entries: ConversationEntry[];
  };

  workflows: {
    executed: number;
    succeeded: number;
    failed: number;
    details: WorkflowExecution[];
  };

  system: SystemMetrics;

  api_health: ApiHealth;
}
