/**
 * System Adapter - Infrastructure Monitoring
 *
 * Provides tools for checking system health, resource usage,
 * and performing maintenance operations.
 */

import { z } from 'zod';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import type { Adapter, AdapterTool } from '../../gateway/types.js';
import { getHealth } from '../../utils/health.js';

interface SystemMetrics {
  disk: {
    usage_percent: number;
    free_gb: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  ram: {
    usage_percent: number;
    used_mb: number;
    total_mb: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  swap: {
    usage_percent: number;
    used_mb: number;
    total_mb: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  oom_kills: number;
  failed_services: string[];
  top_processes: Array<{
    pid: number;
    name: string;
    mem_percent: number;
  }>;
}

function getStatus(value: number, warn: number, crit: number): 'healthy' | 'warning' | 'critical' {
  if (value >= crit) return 'critical';
  if (value >= warn) return 'warning';
  return 'healthy';
}

function execSafe(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return '';
  }
}

function getSystemMetrics(): SystemMetrics {
  // Disk
  const diskOutput = execSafe("df / | awk 'NR==2 {gsub(/%/,\"\"); print $5, $4}'");
  const [diskUsed, diskFree] = diskOutput.split(' ').map(Number);
  const diskFreeGb = Math.round(diskFree / 1024 / 1024);

  // RAM
  const ramOutput = execSafe("free -m | awk '/Mem:/ {print $2, $3}'");
  const [ramTotal, ramUsed] = ramOutput.split(' ').map(Number);
  const ramPercent = Math.round((ramUsed / ramTotal) * 100);

  // Swap
  const swapOutput = execSafe("free -m | awk '/Swap:/ {print $2, $3}'");
  const [swapTotal, swapUsed] = swapOutput.split(' ').map(Number);
  const swapPercent = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;

  // OOM kills
  const oomKills = parseInt(execSafe("dmesg 2>/dev/null | grep -ci 'oom' || echo 0"));

  // Failed services
  const failedOutput = execSafe("systemctl --failed --no-pager --no-legend 2>/dev/null | awk '{print $1}'");
  const failedServices = failedOutput ? failedOutput.split('\n').filter(Boolean) : [];

  // Top processes
  const psOutput = execSafe("ps aux --sort=-%mem | head -6 | tail -5");
  const topProcesses = psOutput.split('\n').map(line => {
    const parts = line.split(/\s+/);
    return {
      pid: parseInt(parts[1]),
      name: parts[10] || 'unknown',
      mem_percent: parseFloat(parts[3]) || 0
    };
  }).filter(p => p.pid);

  return {
    disk: {
      usage_percent: diskUsed || 0,
      free_gb: diskFreeGb,
      status: getStatus(diskUsed || 0, 70, 85)
    },
    ram: {
      usage_percent: ramPercent,
      used_mb: ramUsed,
      total_mb: ramTotal,
      status: getStatus(ramPercent, 80, 90)
    },
    swap: {
      usage_percent: swapPercent,
      used_mb: swapUsed,
      total_mb: swapTotal,
      status: getStatus(swapPercent, 50, 70)
    },
    oom_kills: oomKills,
    failed_services: failedServices,
    top_processes: topProcesses
  };
}

// Schemas
const emptySchema = z.object({});
const cleanupSchema = z.object({
  force: z.boolean().optional().describe('Force cleanup even if disk is below threshold')
});
const serviceSchema = z.object({
  service: z.string().describe('Service name (e.g., netdata, elio-mcp)')
});

const tools: AdapterTool[] = [
  {
    name: 'health',
    description: 'Get MCP server health status including memory, disk, and dependency checks',
    type: 'read',
    schema: emptySchema,
    execute: async () => {
      const health = await getHealth();
      return JSON.stringify(health, null, 2);
    }
  },
  {
    name: 'infra',
    description: 'Get infrastructure metrics: disk, RAM, swap, OOM kills, failed services, top processes',
    type: 'read',
    schema: emptySchema,
    execute: async () => {
      const metrics = getSystemMetrics();

      // Determine overall status
      const statuses = [metrics.disk.status, metrics.ram.status, metrics.swap.status];
      let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (statuses.includes('critical') || metrics.oom_kills > 0 || metrics.failed_services.length > 0) {
        overall = 'critical';
      } else if (statuses.includes('warning')) {
        overall = 'warning';
      }

      return JSON.stringify({
        overall_status: overall,
        timestamp: new Date().toISOString(),
        ...metrics
      }, null, 2);
    }
  },
  {
    name: 'cleanup',
    description: 'Run disk cleanup script to free space (clears pip cache, npm cache, old logs)',
    type: 'write',
    schema: cleanupSchema,
    execute: async () => {
      const scriptPath = '/root/.claude/scripts/disk-cleanup.sh';

      if (!existsSync(scriptPath)) {
        return JSON.stringify({ error: 'Cleanup script not found' });
      }

      try {
        const output = execSync(`bash ${scriptPath}`, {
          encoding: 'utf-8',
          timeout: 60000
        });

        return JSON.stringify({
          success: true,
          output: output.trim(),
          message: 'Cleanup completed'
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        return JSON.stringify({ error: err.message || 'Cleanup failed' });
      }
    }
  },
  {
    name: 'restart',
    description: 'Restart a systemd service (allowed: netdata, elio-mcp, cron)',
    type: 'dangerous',
    schema: serviceSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof serviceSchema>;
      const allowedServices = ['netdata', 'elio-mcp', 'cron'];

      if (!allowedServices.includes(p.service)) {
        return JSON.stringify({
          error: `Service not allowed. Allowed: ${allowedServices.join(', ')}`
        });
      }

      try {
        execSync(`systemctl restart ${p.service}`, { timeout: 30000 });
        const status = execSync(`systemctl is-active ${p.service}`, {
          encoding: 'utf-8'
        }).trim();

        return JSON.stringify({
          success: true,
          service: p.service,
          status,
          message: `Service ${p.service} restarted successfully`
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        return JSON.stringify({ error: err.message || 'Restart failed' });
      }
    }
  }
];

export const systemAdapter: Adapter = {
  name: 'system',
  isAuthenticated: () => true, // System tools don't need external auth
  tools
};

export default systemAdapter;
