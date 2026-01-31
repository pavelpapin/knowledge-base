#!/usr/bin/env tsx
/**
 * Registry Drift Detection
 *
 * Checks if filesystem state matches registry declarations.
 * Runs as cron job (every 6h) and sends Telegram alerts on drift.
 *
 * Usage:
 *   npx tsx scripts/detect-registry-drift.ts
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

const ELIO_ROOT = '/root/.claude';
const REGISTRY_PATH = join(ELIO_ROOT, 'registry.yaml');

interface DriftReport {
  orphaned_workflows: string[];
  orphaned_skills: string[];
  deprecated_on_disk: string[];
  orphaned_adapters: string[];
  success: boolean;
}

async function detectDrift(): Promise<DriftReport> {
  const registry = parse(readFileSync(REGISTRY_PATH, 'utf8'));
  const report: DriftReport = {
    orphaned_workflows: [],
    orphaned_skills: [],
    deprecated_on_disk: [],
    orphaned_adapters: [],
    success: true,
  };

  // Check workflows on disk vs registry
  const workflowsPath = join(ELIO_ROOT, 'workflows');
  if (existsSync(workflowsPath)) {
    const workflowDirs = readdirSync(workflowsPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '_template')
      .map(d => d.name);

    for (const dir of workflowDirs) {
      if (!registry.workflows?.[dir]) {
        report.orphaned_workflows.push(dir);
        report.success = false;
      }
    }
  }

  // Check skills on disk vs registry
  const skillsPath = join(ELIO_ROOT, 'skills');
  if (existsSync(skillsPath)) {
    const skillDirs = readdirSync(skillsPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '_template')
      .map(d => d.name);

    for (const dir of skillDirs) {
      if (!registry.skills?.[dir]) {
        report.orphaned_skills.push(dir);
        report.success = false;
      }
    }
  }

  // Check deprecated workflows still on disk
  for (const [name, meta] of Object.entries(registry.workflows || {})) {
    if (meta.status === 'deprecated' && existsSync(join(workflowsPath, name))) {
      report.deprecated_on_disk.push(name);
      report.success = false;
    }
  }

  // Check MCP adapters
  const adaptersPath = join(ELIO_ROOT, 'mcp-server/src/adapters');
  if (existsSync(adaptersPath)) {
    const adapterDirs = readdirSync(adaptersPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('__'))
      .map(d => d.name);

    const yamlContent = readFileSync(REGISTRY_PATH, 'utf8');
    for (const dir of adapterDirs) {
      if (!yamlContent.includes(dir)) {
        report.orphaned_adapters.push(dir);
        report.success = false;
      }
    }
  }

  return report;
}

async function notify(message: string, priority: string = 'high') {
  // Use @elio/shared notify if available
  try {
    const { notify: sharedNotify } = await import('@elio/shared');
    await sharedNotify({ message, priority });
  } catch {
    // Fallback: just log
    console.log(message);
  }
}

async function main() {
  console.log('🔍 Checking registry drift...\n');

  const report = await detectDrift();

  if (report.success) {
    console.log('✅ No drift detected. Registry and filesystem in sync.\n');
    return;
  }

  // Build alert message
  let message = '⚠️ Registry Drift Detected!\n\n';

  if (report.orphaned_workflows.length > 0) {
    message += `Workflows on disk not in registry:\n${report.orphaned_workflows.map(w => `  - workflows/${w}/`).join('\n')}\n\n`;
  }

  if (report.orphaned_skills.length > 0) {
    message += `Skills on disk not in registry:\n${report.orphaned_skills.map(s => `  - skills/${s}/`).join('\n')}\n\n`;
  }

  if (report.deprecated_on_disk.length > 0) {
    message += `Deprecated workflows still on disk:\n${report.deprecated_on_disk.map(w => `  - workflows/${w}/`).join('\n')}\n\n`;
  }

  if (report.orphaned_adapters.length > 0) {
    message += `MCP adapters not referenced in registry:\n${report.orphaned_adapters.map(a => `  - mcp-server/src/adapters/${a}/`).join('\n')}\n\n`;
  }

  message += `Fix: Update registry.yaml or run ./scripts/lint-registry.sh`;

  // Log and notify
  console.error(message);
  await notify(message, 'high');

  process.exit(1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
