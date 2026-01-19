/**
 * Info commands: executions, stats, settings
 */

import * as store from '../store.js';
import { printExecution } from './utils.js';

export function executions(): void {
  const execs = store.getRecentExecutions(20);

  console.log('\n🔄 Recent Executions');
  console.log('====================');
  if (execs.length === 0) {
    console.log('No executions yet');
  } else {
    execs.forEach(printExecution);
  }
}

export function stats(): void {
  const s = store.getStats();

  console.log('\n📊 Headless Stats');
  console.log('=================');
  console.log(`Total tasks: ${s.total}`);
  console.log(`  ⏳ Pending:   ${s.pending}`);
  console.log(`  🔄 Running:   ${s.running}`);
  console.log(`  ✅ Completed: ${s.completed}`);
  console.log(`  ❌ Failed:    ${s.failed}`);
  console.log(`  📅 Scheduled: ${s.scheduled}`);
}

export function settings(): void {
  const s = store.getSettings();

  console.log('\n⚙️  Settings');
  console.log('============');
  console.log(`Max concurrent: ${s.maxConcurrent}`);
  console.log(`Default timeout: ${s.defaultTimeout}ms`);
  console.log(`Notify on complete: ${s.notifyOnComplete}`);
  console.log(`Notify on error: ${s.notifyOnError}`);
  if (s.telegramChatId) {
    console.log(`Telegram chat: ${s.telegramChatId}`);
  }
}
