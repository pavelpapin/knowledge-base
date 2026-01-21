#!/usr/bin/env npx tsx
/**
 * Extract Conversations from Claude Session Files
 *
 * Extracts user messages from JSONL session files
 * and saves them to the daily conversation log.
 *
 * Run: npx tsx extract-conversations.ts [--date=2026-01-21]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const CONFIG = {
  projectsDir: '/root/.claude/projects',
  outputDir: '/root/.claude/logs/daily',
};

interface ConversationEntry {
  timestamp: string;
  type: 'user_message' | 'correction' | 'feedback' | 'request';
  content: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  session_id: string;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function detectType(content: string): ConversationEntry['type'] {
  const lower = content.toLowerCase();

  // Corrections
  if (lower.includes('не так') || lower.includes('неправильно') || lower.includes('исправь') ||
      lower.includes('wrong') || lower.includes('fix this') || lower.includes('that\'s not')) {
    return 'correction';
  }

  // Requests
  if (lower.includes('сделай') || lower.includes('создай') || lower.includes('добавь') ||
      lower.includes('помоги') || lower.includes('please') || lower.includes('can you') ||
      lower.includes('implement') || lower.includes('create') || lower.includes('add')) {
    return 'request';
  }

  // Feedback
  if (lower.includes('спасибо') || lower.includes('отлично') || lower.includes('хорошо') ||
      lower.includes('плохо') || lower.includes('не работает') || lower.includes('thanks') ||
      lower.includes('great') || lower.includes('perfect') || lower.includes('broken')) {
    return 'feedback';
  }

  return 'user_message';
}

function detectSentiment(content: string): ConversationEntry['sentiment'] {
  const lower = content.toLowerCase();

  const positive = ['спасибо', 'отлично', 'хорошо', 'круто', 'супер', 'thanks', 'great',
                    'perfect', 'awesome', 'nice', 'good job', 'well done'];
  const negative = ['плохо', 'не работает', 'сломал', 'ошибка', 'баг', 'wrong', 'broken',
                    'doesn\'t work', 'bug', 'error', 'fail', 'terrible'];

  if (positive.some(p => lower.includes(p))) return 'positive';
  if (negative.some(n => lower.includes(n))) return 'negative';
  return 'neutral';
}

async function processSessionFile(filepath: string, targetDate: string): Promise<ConversationEntry[]> {
  const entries: ConversationEntry[] = [];
  const sessionId = path.basename(filepath, '.jsonl');

  const fileStream = fs.createReadStream(filepath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line);

      // Look for user messages (Claude Code format)
      if (data.type === 'user' && data.message?.content) {
        // Get timestamp
        let timestamp = data.timestamp || new Date().toISOString();

        // Check if message is from target date
        const messageDate = timestamp.split('T')[0];
        if (messageDate !== targetDate) continue;

        // Extract text content
        const contentArray = data.message.content;
        let content = '';

        if (Array.isArray(contentArray)) {
          for (const item of contentArray) {
            if (item.type === 'text' && item.text) {
              // Skip IDE notifications
              if (item.text.includes('<ide_opened_file>')) continue;
              content += item.text + ' ';
            }
          }
        }

        content = content.trim();

        // Skip empty or very short messages
        if (content.length < 3) continue;

        entries.push({
          timestamp,
          type: detectType(content),
          content: content.substring(0, 2000), // Limit content length
          sentiment: detectSentiment(content),
          session_id: sessionId
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dateArg = args.find(a => a.startsWith('--date='));
  const targetDate = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];

  console.log(`\n📝 Extracting conversations for ${targetDate}`);
  console.log('═'.repeat(50));

  // Find all session files
  const sessionFiles: string[] = [];

  function scanDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.jsonl')) {
        // Check if file was modified recently (within last 2 days)
        const stat = fs.statSync(fullPath);
        const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
        if (stat.mtimeMs > twoDaysAgo) {
          sessionFiles.push(fullPath);
        }
      }
    }
  }

  scanDir(CONFIG.projectsDir);
  console.log(`Found ${sessionFiles.length} recent session files`);

  // Process each file
  const allEntries: ConversationEntry[] = [];

  for (const file of sessionFiles) {
    const entries = await processSessionFile(file, targetDate);
    if (entries.length > 0) {
      console.log(`  ${path.basename(file)}: ${entries.length} messages`);
      allEntries.push(...entries);
    }
  }

  // Sort by timestamp
  allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Save to daily log
  const outputDir = path.join(CONFIG.outputDir, targetDate);
  ensureDir(outputDir);

  const outputPath = path.join(outputDir, 'conversations.jsonl');
  const content = allEntries.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(outputPath, content + '\n');

  // Generate summary
  const corrections = allEntries.filter(e => e.type === 'correction').length;
  const requests = allEntries.filter(e => e.type === 'request').length;
  const feedback = allEntries.filter(e => e.type === 'feedback').length;
  const positive = allEntries.filter(e => e.sentiment === 'positive').length;
  const negative = allEntries.filter(e => e.sentiment === 'negative').length;

  console.log(`\n📊 Summary:`);
  console.log(`   Total messages: ${allEntries.length}`);
  console.log(`   Corrections: ${corrections}`);
  console.log(`   Requests: ${requests}`);
  console.log(`   Feedback: ${feedback} (${positive} positive, ${negative} negative)`);
  console.log(`\n✅ Saved to: ${outputPath}`);

  // Also output request contents for quick review
  if (requests > 0) {
    console.log(`\n📋 User requests today:`);
    allEntries
      .filter(e => e.type === 'request')
      .slice(0, 10)
      .forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.content.substring(0, 100)}...`);
      });
  }

  console.log('═'.repeat(50));
}

main().catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
