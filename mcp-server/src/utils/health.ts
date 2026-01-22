/**
 * Health Check Module for Elio MCP Server
 *
 * Provides health status for monitoring and self-healing.
 * Can be called from adapters or external scripts.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    memory: MemoryCheck;
    disk: DiskCheck;
    database: boolean;
    dependencies: boolean;
  };
  metrics: {
    rss_mb: number;
    heap_used_mb: number;
    heap_total_mb: number;
    cpu_percent: number;
  };
}

interface MemoryCheck {
  ok: boolean;
  rss_mb: number;
  limit_mb: number;
  percent: number;
}

interface DiskCheck {
  ok: boolean;
  used_percent: number;
  free_gb: number;
}

const HEALTH_FILE = '/root/.claude/logs/mcp-health.json';
const MEMORY_LIMIT_MB = 2048; // Match systemd MemoryMax
const startTime = Date.now();

/**
 * Get current memory usage
 */
function getMemoryUsage(): MemoryCheck {
  const mem = process.memoryUsage();
  const rss_mb = Math.round(mem.rss / 1024 / 1024);

  return {
    ok: rss_mb < MEMORY_LIMIT_MB * 0.8, // Alert at 80% of limit
    rss_mb,
    limit_mb: MEMORY_LIMIT_MB,
    percent: Math.round((rss_mb / MEMORY_LIMIT_MB) * 100)
  };
}

/**
 * Get disk usage
 */
function getDiskUsage(): DiskCheck {
  try {
    const output = execSync("df / | awk 'NR==2 {print $5, $4}'", {
      encoding: 'utf-8'
    }).trim();
    const [usedStr, freeStr] = output.split(' ');
    const used_percent = parseInt(usedStr.replace('%', ''));
    const free_gb = Math.round(parseInt(freeStr) / 1024 / 1024);

    return {
      ok: used_percent < 85,
      used_percent,
      free_gb
    };
  } catch {
    return { ok: false, used_percent: 100, free_gb: 0 };
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<boolean> {
  try {
    // Simple check - try to read Supabase config
    const configPath = '/root/.claude/secrets/supabase.json';
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      return !!(config.url && config.service_key);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check dependencies availability
 */
function checkDependencies(): boolean {
  try {
    // Check critical files exist
    const criticalFiles = [
      '/root/.claude/mcp-server/dist/index.js',
      '/root/.claude/secrets/telegram.json'
    ];
    return criticalFiles.every(f => existsSync(f));
  } catch {
    return false;
  }
}

/**
 * Get full health status
 */
export async function getHealth(): Promise<HealthStatus> {
  const memory = getMemoryUsage();
  const disk = getDiskUsage();
  const database = await checkDatabase();
  const dependencies = checkDependencies();

  const allOk = memory.ok && disk.ok && database && dependencies;
  const someOk = memory.ok || disk.ok || database || dependencies;

  const status: HealthStatus = {
    status: allOk ? 'healthy' : someOk ? 'degraded' : 'unhealthy',
    version: '3.0.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      memory,
      disk,
      database,
      dependencies
    },
    metrics: {
      rss_mb: memory.rss_mb,
      heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      cpu_percent: 0 // Would need more complex tracking
    }
  };

  // Write to file for external monitoring
  try {
    writeFileSync(HEALTH_FILE, JSON.stringify(status, null, 2));
  } catch {
    // Ignore write errors
  }

  return status;
}

/**
 * Quick health check - returns true if healthy
 */
export async function isHealthy(): Promise<boolean> {
  const health = await getHealth();
  return health.status === 'healthy';
}

/**
 * Export for CLI usage
 */
export async function printHealth(): Promise<void> {
  const health = await getHealth();
  console.log(JSON.stringify(health, null, 2));
}
