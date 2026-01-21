/**
 * Funding Detection Agent
 * Event-driven funding round detection from open sources
 *
 * Cognitive frame: We detect EVENTS, not build databases.
 * The database is a consequence. The event is the signal.
 */

import * as crypto from 'crypto';
import { FundingEvent, DetectionResult, FundingDetectionConfig, RawArticle } from './types';
import { DEFAULT_CONFIG } from './config';
import { collectArticles, fetchArticleBody } from './collector';
import { processArticles, deduplicateEvents } from './extractor';

/**
 * Run funding detection pipeline
 */
export async function runFundingDetection(
  config: Partial<FundingDetectionConfig> = {}
): Promise<DetectionResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const runId = `funding_${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log(`[FundingDetection] Starting run ${runId}`);

  // Step 1: Collect articles
  console.log('[FundingDetection] Step 1: Collecting articles...');
  let articles = await collectArticles({
    useGDELT: fullConfig.sources.gdelt.enabled,
    useRSS: fullConfig.sources.rss.enabled,
    lookbackHours: fullConfig.sources.gdelt.lookbackHours
  });

  const articlesCollected = articles.length;
  console.log(`[FundingDetection] Collected ${articlesCollected} articles`);

  // Step 2: Enrich articles with body content (for GDELT)
  console.log('[FundingDetection] Step 2: Enriching articles...');
  articles = await enrichArticleBodies(articles);

  // Step 3: Filter short articles
  articles = articles.filter(a => a.body.length >= fullConfig.extraction.minArticleLength);
  const articlesFiltered = articlesCollected - articles.length;
  console.log(`[FundingDetection] After filtering: ${articles.length} (filtered ${articlesFiltered})`);

  // Step 4: Process and extract events
  console.log('[FundingDetection] Step 4: Extracting funding events...');
  let events = await processArticles(articles);
  const eventsDetected = events.length;
  console.log(`[FundingDetection] Detected ${eventsDetected} events`);

  // Step 5: Deduplicate events
  console.log('[FundingDetection] Step 5: Deduplicating events...');
  events = deduplicateEvents(events, fullConfig.extraction.dedupeWindowDays);
  const eventsDeduplicated = eventsDetected - events.length;
  console.log(`[FundingDetection] After dedup: ${events.length} (removed ${eventsDeduplicated})`);

  // Step 6: Enrichment (optional)
  if (fullConfig.enrichment.enabled) {
    console.log('[FundingDetection] Step 6: Enriching low-confidence events...');
    events = await enrichLowConfidenceEvents(events, fullConfig.enrichment.minConfidenceForEnrichment);
  }

  // Sort by confidence (highest first)
  events.sort((a, b) => b.confidenceScore - a.confidenceScore);

  const completedAt = new Date().toISOString();

  return {
    runId,
    startedAt,
    completedAt,
    articlesCollected,
    articlesFiltered,
    eventsDetected,
    eventsDeduplicated,
    events
  };
}

/**
 * Enrich articles with body content
 */
async function enrichArticleBodies(articles: RawArticle[]): Promise<RawArticle[]> {
  const enriched: RawArticle[] = [];

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < articles.length; i += 5) {
    const batch = articles.slice(i, i + 5);

    const promises = batch.map(async article => {
      if (article.body.length < 200) {
        const body = await fetchArticleBody(article.url);
        return { ...article, body: body || article.body };
      }
      return article;
    });

    const results = await Promise.all(promises);
    enriched.push(...results);

    // Small delay between batches
    if (i + 5 < articles.length) {
      await sleep(500);
    }
  }

  return enriched;
}

/**
 * Enrich low-confidence events
 */
async function enrichLowConfidenceEvents(
  events: FundingEvent[],
  threshold: number
): Promise<FundingEvent[]> {
  const enriched: FundingEvent[] = [];

  for (const event of events) {
    if (event.confidenceScore < threshold && !event.companyWebsite) {
      // Try to find company website
      const website = await findCompanyWebsite(event.companyName);
      if (website) {
        enriched.push({
          ...event,
          companyWebsite: website,
          confidenceScore: event.confidenceScore + 0.1
        });
        continue;
      }
    }
    enriched.push(event);
  }

  return enriched;
}

/**
 * Find company website (simple search)
 */
async function findCompanyWebsite(companyName: string): Promise<string | null> {
  // In production, use DuckDuckGo or Google search
  // For now, return null
  return null;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format events as JSONL
 */
export function formatAsJSONL(events: FundingEvent[]): string {
  return events.map(e => JSON.stringify(e)).join('\n');
}

/**
 * Format events as markdown table
 */
export function formatAsMarkdown(result: DetectionResult): string {
  const lines: string[] = [
    `# Funding Detection Report`,
    '',
    `**Run ID**: ${result.runId}`,
    `**Started**: ${result.startedAt}`,
    `**Completed**: ${result.completedAt}`,
    '',
    `## Summary`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Articles Collected | ${result.articlesCollected} |`,
    `| Articles Filtered | ${result.articlesFiltered} |`,
    `| Events Detected | ${result.eventsDetected} |`,
    `| Events Deduplicated | ${result.eventsDeduplicated} |`,
    `| **Final Events** | **${result.events.length}** |`,
    '',
    `## Funding Events`,
    '',
    `| Company | Round | Amount | Lead Investor | Date | Confidence |`,
    `|---------|-------|--------|---------------|------|------------|`
  ];

  for (const event of result.events) {
    const amount = event.amount ? `${event.currency || '$'}${event.amount}M` : 'Undisclosed';
    const lead = event.leadInvestor || '-';
    const conf = `${Math.round(event.confidenceScore * 100)}%`;
    lines.push(`| ${event.companyName} | ${event.roundType} | ${amount} | ${lead} | ${event.announcementDate} | ${conf} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by Elio Funding Detection Agent*');

  return lines.join('\n');
}

// Export types
export * from './types';
export * from './config';
