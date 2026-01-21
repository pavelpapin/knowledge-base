/**
 * YouTube Analyst Agent
 * Finds and analyzes high-quality YouTube videos for research
 *
 * Strategy: Token-efficient selection of best videos only
 * - Search via web (not YouTube API) to find relevant videos
 * - Score videos by authority, engagement, content type
 * - Fetch transcripts only for top 3-5 videos
 * - Extract key insights, not full transcripts
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';

export interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  channel: string;
  views?: string;
  duration?: string;
  published?: string;
  authorityScore: number;
  relevanceScore: number;
}

export interface VideoInsights {
  video: YouTubeVideo;
  keyInsights: string[];
  quotes: Array<{
    text: string;
    speaker?: string;
    timestamp?: string;
  }>;
  dataPoints: string[];
  uniqueValue: string;
  transcriptTokens: number;
}

export interface YouTubeAnalysisResult {
  searchQueriesUsed: string[];
  videosFound: number;
  videosAnalyzed: number;
  totalTokensUsed: number;
  selectedVideos: VideoInsights[];
  skippedVideos: Array<{
    id: string;
    reason: string;
    betterSource?: string;
  }>;
}

// High-authority channels for different topics
const AUTHORITY_CHANNELS: Record<string, string[]> = {
  tech: [
    'Google', 'Microsoft', 'AWS', 'Meta', 'TED', 'Sequoia Capital',
    'a]6z', 'Y Combinator', 'Fireship', 'ThePrimeagen', 'Lex Fridman'
  ],
  business: [
    'TED', 'Stanford Graduate School of Business', 'Harvard Business Review',
    'Y Combinator', 'Tim Ferriss', 'Gary Vaynerchuk'
  ],
  science: [
    'Veritasium', 'SmarterEveryDay', 'PBS Space Time', 'Kurzgesagt',
    '3Blue1Brown', 'Two Minute Papers'
  ]
};

// Content types ranked by value
const CONTENT_TYPE_SCORES: Record<string, number> = {
  'conference': 1.0,
  'keynote': 1.0,
  'interview': 0.9,
  'tutorial': 0.85,
  'deep dive': 0.85,
  'documentary': 0.8,
  'analysis': 0.75,
  'review': 0.6,
  'reaction': 0.2,
  'top 10': 0.3,
};

/**
 * Generate smart search queries for a topic
 */
export function generateSearchQueries(topic: string, depth: 'quick' | 'medium' | 'deep' = 'medium'): string[] {
  const baseQueries = [
    `"${topic}" conference talk keynote site:youtube.com`,
    `"${topic}" interview expert founder CTO site:youtube.com`,
    `"${topic}" tutorial deep dive 2024 2025 site:youtube.com`,
  ];

  if (depth === 'quick') {
    return baseQueries.slice(0, 1);
  } else if (depth === 'deep') {
    return [
      ...baseQueries,
      `"${topic}" documentary explained site:youtube.com`,
      `"${topic}" academic lecture university site:youtube.com`,
    ];
  }

  return baseQueries;
}

/**
 * Score a video by authority signals
 */
export function scoreVideoAuthority(video: {
  channel: string;
  views?: number;
  subscriberCount?: number;
  isVerified?: boolean;
  duration?: number; // in seconds
  publishedDaysAgo?: number;
}, topicCategory: string = 'tech'): number {
  let score = 5.0; // Base score

  // Channel authority (30%)
  const authorityChannels = AUTHORITY_CHANNELS[topicCategory] || AUTHORITY_CHANNELS.tech;
  if (authorityChannels.some(ch => video.channel.toLowerCase().includes(ch.toLowerCase()))) {
    score += 3.0;
  }
  if (video.isVerified) {
    score += 0.5;
  }
  if (video.subscriberCount) {
    if (video.subscriberCount > 1000000) score += 1.5;
    else if (video.subscriberCount > 100000) score += 1.0;
    else if (video.subscriberCount > 10000) score += 0.5;
  }

  // Engagement (25%)
  if (video.views) {
    if (video.views > 1000000) score += 1.5;
    else if (video.views > 100000) score += 1.0;
    else if (video.views > 10000) score += 0.5;
  }

  // Duration sweet spot (10%)
  if (video.duration) {
    const minutes = video.duration / 60;
    if (minutes >= 10 && minutes <= 60) {
      score += 1.0; // Optimal length
    } else if (minutes < 5 || minutes > 120) {
      score -= 1.0; // Too short or too long
    }
  }

  // Recency (15%)
  if (video.publishedDaysAgo !== undefined) {
    if (video.publishedDaysAgo < 30) score += 1.5;
    else if (video.publishedDaysAgo < 180) score += 1.0;
    else if (video.publishedDaysAgo < 365) score += 0.5;
    else if (video.publishedDaysAgo > 730) score -= 0.5;
  }

  return Math.min(10, Math.max(1, score));
}

/**
 * Detect content type from title
 */
export function detectContentType(title: string): { type: string; score: number } {
  const lowerTitle = title.toLowerCase();

  for (const [type, score] of Object.entries(CONTENT_TYPE_SCORES)) {
    if (lowerTitle.includes(type)) {
      return { type, score };
    }
  }

  return { type: 'general', score: 0.5 };
}

/**
 * Check if video should be skipped
 */
export function shouldSkipVideo(video: {
  title: string;
  views?: number;
  duration?: number;
  publishedDaysAgo?: number;
  subscriberCount?: number;
}): { skip: boolean; reason?: string } {
  const lowerTitle = video.title.toLowerCase();

  // Skip reaction/low-value content
  if (lowerTitle.includes('reaction') || lowerTitle.includes('reacts')) {
    return { skip: true, reason: 'reaction_video' };
  }

  // Skip clickbait patterns
  if (lowerTitle.match(/you won't believe|shocking|gone wrong|destroyed/i)) {
    return { skip: true, reason: 'clickbait' };
  }

  // Skip too short
  if (video.duration && video.duration < 300) { // < 5 minutes
    return { skip: true, reason: 'too_short' };
  }

  // Skip too long
  if (video.duration && video.duration > 7200) { // > 2 hours
    return { skip: true, reason: 'too_long' };
  }

  // Skip old + low views
  if (video.publishedDaysAgo && video.publishedDaysAgo > 365 && video.views && video.views < 1000) {
    return { skip: true, reason: 'old_low_engagement' };
  }

  // Skip very small channels (unless recent)
  if (video.subscriberCount && video.subscriberCount < 10000 && video.publishedDaysAgo && video.publishedDaysAgo > 30) {
    return { skip: true, reason: 'low_authority_channel' };
  }

  return { skip: false };
}

/**
 * Get transcript using Supadata (via skill)
 */
export async function getVideoTranscript(videoId: string, language: string = 'en'): Promise<{
  transcript: string;
  language: string;
  source: string;
} | null> {
  const url = `https://youtube.com/watch?v=${videoId}`;

  try {
    const result = execSync(
      `cd /root/.claude/skills/youtube-transcript && python3 transcript.py "${url}" "${language}"`,
      { encoding: 'utf8', timeout: 60000 }
    );

    const data = JSON.parse(result);

    if (data.error) {
      console.error(`Transcript error for ${videoId}: ${data.error}`);
      return null;
    }

    return {
      transcript: data.transcript,
      language: data.language || language,
      source: data.source || 'unknown'
    };
  } catch (error) {
    console.error(`Failed to get transcript for ${videoId}:`, error);
    return null;
  }
}

/**
 * Extract key insights from transcript (token-efficient)
 */
export function extractInsights(
  transcript: string,
  topic: string,
  maxInsights: number = 5
): {
  insights: string[];
  quotes: Array<{ text: string; speaker?: string }>;
  dataPoints: string[];
  tokenCount: number;
} {
  const insights: string[] = [];
  const quotes: Array<{ text: string; speaker?: string }> = [];
  const dataPoints: string[] = [];

  // Rough token count (1 token ~= 4 chars)
  const tokenCount = Math.ceil(transcript.length / 4);

  // Split into sentences
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 20);

  // Find sentences with topic keywords
  const topicKeywords = topic.toLowerCase().split(/\s+/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();

    // Check if relevant to topic
    const relevance = topicKeywords.filter(kw => lowerSentence.includes(kw)).length / topicKeywords.length;

    if (relevance > 0.3) {
      // Check for data points (numbers, stats)
      if (sentence.match(/\d+%|\d+ percent|\$\d+|million|billion|\d{4}/)) {
        dataPoints.push(sentence.trim());
      }

      // Check for insights (patterns indicating key points)
      if (sentence.match(/important|key|critical|fundamental|essential|the.*is|turns out|actually|surprising/i)) {
        insights.push(sentence.trim());
      }

      // Check for quotes (first person statements)
      if (sentence.match(/^".*"|I think|I believe|in my experience|what I've seen/i)) {
        quotes.push({ text: sentence.trim() });
      }
    }

    if (insights.length >= maxInsights) break;
  }

  return {
    insights: insights.slice(0, maxInsights),
    quotes: quotes.slice(0, 3),
    dataPoints: dataPoints.slice(0, 5),
    tokenCount
  };
}

/**
 * Main function: Analyze YouTube for a research topic
 */
export async function analyzeYouTubeForTopic(
  topic: string,
  options: {
    maxVideos?: number;
    maxTokens?: number;
    depth?: 'quick' | 'medium' | 'deep';
    topicCategory?: string;
  } = {}
): Promise<YouTubeAnalysisResult> {
  const {
    maxVideos = 5,
    maxTokens = 50000,
    depth = 'medium',
    topicCategory = 'tech'
  } = options;

  const result: YouTubeAnalysisResult = {
    searchQueriesUsed: [],
    videosFound: 0,
    videosAnalyzed: 0,
    totalTokensUsed: 0,
    selectedVideos: [],
    skippedVideos: []
  };

  // Generate search queries
  result.searchQueriesUsed = generateSearchQueries(topic, depth);

  // Note: In production, this would use web search to find videos
  // For now, return structure for manual/MCP-based video collection

  return result;
}

/**
 * Process a list of video candidates
 */
export async function processVideoCandidates(
  candidates: YouTubeVideo[],
  topic: string,
  maxVideos: number = 5,
  maxTokens: number = 50000,
  topicCategory: string = 'tech'
): Promise<YouTubeAnalysisResult> {
  const result: YouTubeAnalysisResult = {
    searchQueriesUsed: [],
    videosFound: candidates.length,
    videosAnalyzed: 0,
    totalTokensUsed: 0,
    selectedVideos: [],
    skippedVideos: []
  };

  // Score and sort candidates
  const scoredCandidates = candidates.map(video => ({
    video,
    authorityScore: video.authorityScore || scoreVideoAuthority(
      { channel: video.channel },
      topicCategory
    ),
    contentType: detectContentType(video.title),
    skipCheck: shouldSkipVideo({ title: video.title })
  }));

  // Filter and sort by score
  const validCandidates = scoredCandidates
    .filter(c => {
      if (c.skipCheck.skip) {
        result.skippedVideos.push({
          id: c.video.id,
          reason: c.skipCheck.reason || 'unknown'
        });
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const scoreA = a.authorityScore * a.contentType.score * a.video.relevanceScore;
      const scoreB = b.authorityScore * b.contentType.score * b.video.relevanceScore;
      return scoreB - scoreA;
    });

  // Process top candidates
  for (const candidate of validCandidates.slice(0, maxVideos)) {
    if (result.totalTokensUsed >= maxTokens) {
      result.skippedVideos.push({
        id: candidate.video.id,
        reason: 'token_budget_exceeded'
      });
      continue;
    }

    // Get transcript
    const transcriptData = await getVideoTranscript(candidate.video.id);

    if (!transcriptData) {
      result.skippedVideos.push({
        id: candidate.video.id,
        reason: 'no_transcript'
      });
      continue;
    }

    // Extract insights
    const extraction = extractInsights(transcriptData.transcript, topic);

    result.totalTokensUsed += extraction.tokenCount;
    result.videosAnalyzed++;

    result.selectedVideos.push({
      video: {
        ...candidate.video,
        authorityScore: candidate.authorityScore
      },
      keyInsights: extraction.insights,
      quotes: extraction.quotes,
      dataPoints: extraction.dataPoints,
      uniqueValue: `${candidate.contentType.type} content from ${candidate.video.channel}`,
      transcriptTokens: extraction.tokenCount
    });
  }

  return result;
}
