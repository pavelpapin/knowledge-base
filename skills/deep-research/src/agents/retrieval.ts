/**
 * Retrieval Agent
 * Gathers information from various sources
 *
 * Integrations:
 * - Web: Perplexity search, Jina Reader
 * - YouTube: Supadata transcripts with smart selection
 * - Papers: arXiv, Semantic Scholar
 */

import { Source, SourceType, ResearchPlan } from '../types';
import { execSync } from 'child_process';
import * as crypto from 'crypto';
import {
  getVideoTranscript,
  extractInsights,
  scoreVideoAuthority,
  shouldSkipVideo,
  generateSearchQueries
} from './youtube';

// Token budgets per source type
const TOKEN_BUDGETS: Record<SourceType, number> = {
  web: 30000,
  youtube: 50000,
  paper: 20000,
  social: 10000,
  perplexity: 40000
};

export async function retrieveSources(plan: ResearchPlan): Promise<Source[]> {
  const sources: Source[] = [];

  for (const sourceType of plan.sources_strategy) {
    const newSources = await retrieveFromSource(sourceType, plan);
    sources.push(...newSources);
  }

  return sources;
}

async function retrieveFromSource(type: SourceType, plan: ResearchPlan): Promise<Source[]> {
  switch (type) {
    case 'web':
      return retrieveWeb(plan.topic, plan.subtopics);
    case 'youtube':
      return retrieveYoutube(plan.topic, plan.depth);
    case 'paper':
      return retrievePapers(plan.topic);
    case 'perplexity':
      return retrievePerplexity(plan.topic, plan.subtopics);
    default:
      return [];
  }
}

function retrieveWeb(topic: string, subtopics: string[]): Source[] {
  // Note: In production, this triggers Claude's web_search or Jina Reader
  // Returns placeholder for orchestration
  return [{
    id: crypto.randomUUID(),
    url: `https://search.example.com/q=${encodeURIComponent(topic)}`,
    title: `Web search: ${topic}`,
    type: 'web',
    content: `[ACTION: Use web_search tool for: "${topic}"]\n[SUBTOPICS: ${subtopics.join(', ')}]`,
    retrieved_at: new Date().toISOString(),
    relevance_score: 0.8
  }];
}

/**
 * YouTube retrieval with smart selection
 *
 * Strategy:
 * 1. Generate targeted search queries
 * 2. Score videos by authority (skip low-value)
 * 3. Fetch transcripts for top 3-5 videos only
 * 4. Extract key insights (not full transcripts)
 */
async function retrieveYoutube(topic: string, depth: string): Promise<Source[]> {
  const sources: Source[] = [];
  const maxVideos = depth === 'deep' ? 5 : depth === 'medium' ? 3 : 2;
  const queries = generateSearchQueries(topic, depth as 'quick' | 'medium' | 'deep');

  // Generate search instruction for Claude
  const searchInstruction = {
    action: 'youtube_search',
    queries,
    selection_criteria: {
      min_views: 10000,
      preferred_channels: [
        'TED', 'Google', 'AWS', 'Y Combinator', 'Sequoia Capital',
        'Lex Fridman', 'Fireship', 'ThePrimeagen'
      ],
      preferred_content_types: ['conference', 'keynote', 'interview', 'tutorial'],
      duration_range: { min_minutes: 10, max_minutes: 60 },
      max_age_days: depth === 'deep' ? 730 : 365
    },
    max_videos: maxVideos,
    token_budget: TOKEN_BUDGETS.youtube
  };

  // Return orchestration instruction
  sources.push({
    id: crypto.randomUUID(),
    url: 'youtube://search',
    title: `YouTube Research: ${topic}`,
    type: 'youtube',
    content: JSON.stringify(searchInstruction, null, 2),
    retrieved_at: new Date().toISOString(),
    relevance_score: 0.85
  });

  return sources;
}

/**
 * Process YouTube videos after search
 * Called by orchestrator with actual video URLs
 */
export async function processYoutubeVideos(
  videos: Array<{
    id: string;
    url: string;
    title: string;
    channel: string;
    views?: number;
    duration?: number;
  }>,
  topic: string,
  maxVideos: number = 5
): Promise<Source[]> {
  const sources: Source[] = [];
  let processedCount = 0;
  let totalTokens = 0;
  const tokenBudget = TOKEN_BUDGETS.youtube;

  // Score and filter videos
  const scoredVideos = videos
    .map(v => ({
      ...v,
      score: scoreVideoAuthority({
        channel: v.channel,
        views: v.views,
        duration: v.duration
      }),
      skip: shouldSkipVideo({
        title: v.title,
        views: v.views,
        duration: v.duration
      })
    }))
    .filter(v => !v.skip.skip)
    .sort((a, b) => b.score - a.score);

  // Process top videos
  for (const video of scoredVideos) {
    if (processedCount >= maxVideos || totalTokens >= tokenBudget) break;

    try {
      const transcriptData = await getVideoTranscript(video.id);

      if (!transcriptData) {
        console.warn(`No transcript for ${video.id}: ${video.title}`);
        continue;
      }

      // Extract insights (token-efficient)
      const insights = extractInsights(transcriptData.transcript, topic, 5);
      totalTokens += insights.tokenCount;

      // Create source with extracted insights
      sources.push({
        id: crypto.randomUUID(),
        url: video.url,
        title: `[VIDEO] ${video.title} - ${video.channel}`,
        type: 'youtube',
        content: formatYoutubeInsights(video, insights),
        retrieved_at: new Date().toISOString(),
        relevance_score: Math.min(video.score / 10, 1)
      });

      processedCount++;
    } catch (error) {
      console.error(`Failed to process video ${video.id}:`, error);
    }
  }

  return sources;
}

/**
 * Format YouTube insights for research context
 */
function formatYoutubeInsights(
  video: { title: string; channel: string; url: string },
  insights: ReturnType<typeof extractInsights>
): string {
  const sections: string[] = [];

  sections.push(`## Video: ${video.title}`);
  sections.push(`**Channel:** ${video.channel}`);
  sections.push(`**URL:** ${video.url}`);
  sections.push(`**Tokens used:** ${insights.tokenCount}`);
  sections.push('');

  if (insights.insights.length > 0) {
    sections.push('### Key Insights');
    insights.insights.forEach((insight, i) => {
      sections.push(`${i + 1}. ${insight}`);
    });
    sections.push('');
  }

  if (insights.dataPoints.length > 0) {
    sections.push('### Data Points');
    insights.dataPoints.forEach(dp => {
      sections.push(`- ${dp}`);
    });
    sections.push('');
  }

  if (insights.quotes.length > 0) {
    sections.push('### Notable Quotes');
    insights.quotes.forEach(q => {
      sections.push(`> "${q.text}"`);
    });
  }

  return sections.join('\n');
}

function retrievePapers(topic: string): Source[] {
  // arXiv and Semantic Scholar search
  return [{
    id: crypto.randomUUID(),
    url: `https://arxiv.org/search/?query=${encodeURIComponent(topic)}`,
    title: `Academic papers: ${topic}`,
    type: 'paper',
    content: `[ACTION: Search arXiv and Semantic Scholar for: "${topic}"]
[FILTERS: cs.AI, cs.LG, recent 2 years]
[MAX_PAPERS: 5]`,
    retrieved_at: new Date().toISOString(),
    relevance_score: 0.9
  }];
}

function retrievePerplexity(topic: string, subtopics: string[]): Source[] {
  // Perplexity AI search
  return [{
    id: crypto.randomUUID(),
    url: 'perplexity://search',
    title: `Perplexity AI: ${topic}`,
    type: 'perplexity',
    content: `[ACTION: Use elio_perplexity_search tool]
[QUERY: "${topic}"]
[FOLLOW_UP_QUERIES: ${subtopics.map(s => `"${s}"`).join(', ')}]`,
    retrieved_at: new Date().toISOString(),
    relevance_score: 0.9
  }];
}

export function sourcesToContext(sources: Source[]): string {
  return sources.map(s =>
    `## ${s.title}\nSource: ${s.url}\nType: ${s.type}\n\n${s.content}`
  ).join('\n\n---\n\n');
}
