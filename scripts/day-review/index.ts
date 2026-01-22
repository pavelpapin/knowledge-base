#!/usr/bin/env npx tsx
/**
 * Day Review
 * Collects all data from the day into a single JSON summary
 *
 * Run: npx tsx day-review/index.ts
 * Scheduled: 00:00 Tbilisi daily (before CTO/CPO/CEO)
 */

import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from './config.js';
import { ensureDir } from './utils.js';
import {
  collectErrors,
  collectGitChanges,
  collectConversations,
  collectWorkflowExecutions,
  collectSystemMetrics,
  checkApiHealth
} from './collectors.js';
import type { DaySummary } from './types.js';

async function main(): Promise<void> {
  const now = new Date();
  const date = now.toISOString().split('T')[0];

  console.log(`\n Day Review - ${date}`);
  console.log('='.repeat(50));

  // Ensure output directory
  const outputDir = path.join(CONFIG.outputDir, date);
  ensureDir(outputDir);

  // Collect all data
  console.log(' Collecting errors...');
  const errors = collectErrors(date);
  console.log(`   Found ${errors.total} errors (${errors.critical} critical)`);

  console.log(' Collecting git changes...');
  const git = collectGitChanges();
  console.log(`   Found ${git.commits} commits, +${git.lines_added}/-${git.lines_removed} lines`);

  console.log(' Collecting conversations...');
  const conversations = collectConversations(date);
  console.log(`   Found ${conversations.total_messages} messages, ${conversations.corrections} corrections`);

  console.log(' Collecting workflow executions...');
  const workflows = collectWorkflowExecutions();
  console.log(`   Found ${workflows.executed} executions (${workflows.succeeded} ok, ${workflows.failed} failed)`);

  console.log(' Collecting system metrics...');
  const system = collectSystemMetrics();
  console.log(`   Disk: ${system.disk_usage}, Memory: ${system.memory_usage}`);

  console.log(' Checking API health...');
  const api_health = checkApiHealth();
  const healthStatus = Object.entries(api_health)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
  console.log(`   ${healthStatus}`);

  // Build summary
  const summary: DaySummary = {
    date,
    generated_at: now.toISOString(),
    errors,
    git,
    conversations,
    workflows,
    system,
    api_health
  };

  // Save summary
  const summaryPath = path.join(outputDir, 'day-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n Summary saved to: ${summaryPath}`);

  // Print brief summary
  console.log('\n Summary:');
  console.log(`   Errors: ${errors.total} (${errors.critical} critical)`);
  console.log(`   Git: ${git.commits} commits, +${git.lines_added}/-${git.lines_removed}`);
  console.log(`   Conversations: ${conversations.total_messages} messages`);
  console.log(`   Workflows: ${workflows.succeeded}/${workflows.executed} succeeded`);
  console.log('='.repeat(50));
}

main().catch(error => {
  console.error(' Day Review failed:', error);
  process.exit(1);
});
