/**
 * Deep Research Agent
 * Main orchestrator
 */

import * as crypto from 'crypto';
import { ResearchJob, Depth, Status } from './types';
import { createPlan, planToPrompt } from './agents/planner';
import { retrieveSources, sourcesToContext } from './agents/retrieval';
import { generateReport, extractFindings } from './agents/synthesis';
import { exportMarkdown } from './outputs/markdown';
import { exportNotion } from './outputs/notion';

export async function research(
  topic: string,
  depth: Depth = 'medium',
  outputFormats: string[] = ['markdown']
): Promise<ResearchJob> {

  // Initialize job
  const job: ResearchJob = {
    id: crypto.randomUUID(),
    topic,
    depth,
    status: 'planning',
    progress: 0,
    plan: null,
    sources: [],
    findings: [],
    report: '',
    outputs: [],
    logs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  log(job, `Starting research on: ${topic}`);

  try {
    // Phase 1: Planning
    job.status = 'planning';
    job.progress = 10;
    job.plan = createPlan(topic, depth);
    log(job, `Plan created: ${job.plan.subtopics.length} subtopics`);

    // Phase 2: Retrieval
    job.status = 'retrieving';
    job.progress = 30;
    job.sources = await retrieveSources(job.plan);
    log(job, `Retrieved ${job.sources.length} sources`);

    // Phase 3: Analysis
    job.status = 'analyzing';
    job.progress = 50;
    const sourceIds = job.sources.map(s => s.id);
    job.findings = extractFindings(sourcesToContext(job.sources), sourceIds);
    log(job, `Extracted ${job.findings.length} findings`);

    // Phase 4: Synthesis
    job.status = 'synthesizing';
    job.progress = 70;
    job.report = generateReport(job);
    log(job, `Report generated: ${job.report.length} chars`);

    // Phase 5: Output
    job.progress = 90;

    if (outputFormats.includes('markdown')) {
      const mdResult = exportMarkdown(job);
      job.outputs.push(mdResult);
      log(job, `Markdown: ${mdResult.success ? mdResult.path : mdResult.error}`);
    }

    if (outputFormats.includes('notion')) {
      const notionResult = await exportNotion(job);
      job.outputs.push(notionResult);
      log(job, `Notion: ${notionResult.success ? notionResult.url : notionResult.error}`);
    }

    // Done
    job.status = 'done';
    job.progress = 100;
    log(job, 'Research completed');

  } catch (error) {
    job.status = 'failed';
    job.error = (error as Error).message;
    log(job, `Error: ${job.error}`);
  }

  job.updated_at = new Date().toISOString();
  return job;
}

function log(job: ResearchJob, message: string): void {
  const entry = `[${new Date().toISOString()}] ${message}`;
  job.logs.push(entry);
  console.log(entry);
}

// CLI
if (require.main === module) {
  const [,, topic, depthArg, ...formatArgs] = process.argv;

  if (!topic) {
    console.log('Usage: deep-research <topic> [depth] [formats...]');
    console.log('  depth: quick, medium, deep (default: medium)');
    console.log('  formats: markdown, notion (default: markdown)');
    process.exit(1);
  }

  const depth = (depthArg as Depth) || 'medium';
  const formats = formatArgs.length > 0 ? formatArgs : ['markdown'];

  research(topic, depth, formats).then(job => {
    console.log('\n=== Research Complete ===');
    console.log(JSON.stringify({
      id: job.id,
      topic: job.topic,
      status: job.status,
      sources: job.sources.length,
      findings: job.findings.length,
      outputs: job.outputs
    }, null, 2));
  });
}
