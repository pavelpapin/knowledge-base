/**
 * Markdown Output
 */

import * as fs from 'fs';
import * as path from 'path';
import { ResearchJob, OutputResult } from '../types';
import { generateReport } from '../agents/synthesis';

const OUTPUT_DIR = '/root/.claude/research-outputs';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function exportMarkdown(job: ResearchJob): OutputResult {
  try {
    ensureDir(OUTPUT_DIR);

    const report = generateReport(job);
    const filename = `${job.id}-${safeName(job.topic)}.md`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, report);

    return {
      format: 'markdown',
      path: filepath,
      success: true
    };
  } catch (error) {
    return {
      format: 'markdown',
      success: false,
      error: (error as Error).message
    };
  }
}

function safeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}
