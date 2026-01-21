/**
 * Funding Detection - Event Extractor
 * LLM-based classification and extraction
 */

import * as crypto from 'crypto';
import { RawArticle, FundingEvent, RoundType } from './types';
import { PROMPTS, calculateConfidence } from './config';

/**
 * Classify if article is about funding event
 */
export async function classifyArticle(article: RawArticle): Promise<boolean> {
  const prompt = PROMPTS.classification
    .replace('{title}', article.title)
    .replace('{body}', article.body.slice(0, 2000));

  // In production, call Claude/GPT here
  // For now, use keyword heuristics
  return classifyByKeywords(article);
}

/**
 * Keyword-based classification (fallback)
 */
function classifyByKeywords(article: RawArticle): boolean {
  const text = `${article.title} ${article.body}`.toLowerCase();

  // Must-have patterns
  const fundingPatterns = [
    /raised?\s+\$?\d+/i,
    /funding\s+round/i,
    /series\s+[a-d]/i,
    /seed\s+(round|funding)/i,
    /secured?\s+\$?\d+/i,
    /closed?\s+(a\s+)?\$?\d+/i,
    /million\s+(in\s+)?funding/i,
    /venture\s+capital/i
  ];

  // Must have at least one funding pattern
  const hasFundingPattern = fundingPatterns.some(p => p.test(text));

  // Should not have exclusion patterns
  const exclusionPatterns = [
    /acquired\s+by/i,
    /merger\s+with/i,
    /ipo\s+fil/i,
    /goes?\s+public/i,
    /bankruptcy/i,
    /laid\s+off/i
  ];

  const hasExclusion = exclusionPatterns.some(p => p.test(text));

  return hasFundingPattern && !hasExclusion;
}

/**
 * Extract funding event from article
 */
export async function extractFundingEvent(article: RawArticle): Promise<FundingEvent | null> {
  // In production, call Claude/GPT with PROMPTS.extraction
  // For now, use regex-based extraction
  return extractByRegex(article);
}

/**
 * Regex-based extraction (fallback)
 */
function extractByRegex(article: RawArticle): FundingEvent | null {
  const text = `${article.title} ${article.body}`;

  // Extract company name (first capitalized phrase before "raised/secured")
  const companyMatch = text.match(/([A-Z][a-zA-Z0-9\s]{2,30})\s+(raised|secured|closed|announces)/i);
  const companyName = companyMatch ? companyMatch[1].trim() : extractCompanyFromTitle(article.title);

  if (!companyName) {
    return null;
  }

  // Extract amount
  const amountMatch = text.match(/\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i);
  let amount: number | null = null;
  let currency: string | null = null;

  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
    const unit = amountMatch[2].toLowerCase();
    if (unit === 'billion' || unit === 'b') {
      amount *= 1000;
    }
    currency = 'USD';
  }

  // Try EUR
  if (!amount) {
    const eurMatch = text.match(/€(\d+(?:\.\d+)?)\s*(million|billion|m|b)/i);
    if (eurMatch) {
      amount = parseFloat(eurMatch[1]);
      const unit = eurMatch[2].toLowerCase();
      if (unit === 'billion' || unit === 'b') {
        amount *= 1000;
      }
      currency = 'EUR';
    }
  }

  // Extract round type
  const roundType = extractRoundType(text);

  // Extract investors
  const investors = extractInvestors(text);

  // Extract lead investor
  const leadInvestor = extractLeadInvestor(text, investors);

  // Extract date
  const announcementDate = extractDate(article);

  // Calculate confidence
  const confidenceScore = calculateConfidence({
    amount,
    roundType,
    leadInvestor,
    investors,
    companyWebsite: null,
    announcementDate,
    source: article.source
  });

  return {
    id: crypto.randomUUID(),
    companyName,
    companyWebsite: null,
    roundType,
    amount,
    currency,
    investors,
    leadInvestor,
    announcementDate,
    sourceUrl: article.url,
    sourceTitle: article.title,
    confidenceScore,
    extractedAt: new Date().toISOString(),
    rawArticleId: article.id
  };
}

/**
 * Extract company name from title
 */
function extractCompanyFromTitle(title: string): string | null {
  // Common patterns: "CompanyName raises $X", "CompanyName secures funding"
  const patterns = [
    /^([A-Z][a-zA-Z0-9\.\s]{1,30}?)\s+(raises?|secures?|closes?|announces?)/i,
    /^([A-Z][a-zA-Z0-9\.]{1,20})\s+/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract round type from text
 */
function extractRoundType(text: string): RoundType {
  const textLower = text.toLowerCase();

  if (textLower.includes('pre-seed') || textLower.includes('preseed')) {
    return 'Pre-Seed';
  }
  if (textLower.includes('series d') || textLower.includes('series e') || textLower.includes('series f')) {
    return 'Series D+';
  }
  if (textLower.includes('series c')) {
    return 'Series C';
  }
  if (textLower.includes('series b')) {
    return 'Series B';
  }
  if (textLower.includes('series a')) {
    return 'Series A';
  }
  if (textLower.includes('seed round') || textLower.includes('seed funding') || textLower.match(/\bseed\b/)) {
    return 'Seed';
  }
  if (textLower.includes('extension')) {
    return 'Extension';
  }
  if (textLower.includes('bridge')) {
    return 'Bridge';
  }
  if (textLower.includes('debt financing') || textLower.includes('debt round')) {
    return 'Debt';
  }
  if (textLower.includes('grant')) {
    return 'Grant';
  }

  return 'Unknown';
}

/**
 * Extract investors from text
 */
function extractInvestors(text: string): string[] {
  const investors: string[] = [];

  // Pattern: "led by InvestorName" or "with participation from InvestorName"
  const ledByMatch = text.match(/led\s+by\s+([A-Z][a-zA-Z0-9\s&]+?)(?:,|\.|with|and\s+participated)/i);
  if (ledByMatch) {
    investors.push(ledByMatch[1].trim());
  }

  // Pattern: "investors include X, Y, Z"
  const investorsMatch = text.match(/investors?\s+(?:include|are|such as)\s+([A-Z][^.]+?)(?:\.|and\s+others)/i);
  if (investorsMatch) {
    const names = investorsMatch[1].split(/,|and/).map(s => s.trim()).filter(s => s.length > 2);
    investors.push(...names);
  }

  // Pattern: well-known VC names
  const knownVCs = [
    'Sequoia', 'Andreessen Horowitz', 'a16z', 'Accel', 'Index Ventures',
    'Bessemer', 'General Catalyst', 'Lightspeed', 'NEA', 'Greylock',
    'Benchmark', 'GV', 'Kleiner Perkins', 'Tiger Global', 'Insight Partners',
    'Ribbit Capital', 'ICONIQ', 'Y Combinator', 'Founders Fund', 'Khosla'
  ];

  for (const vc of knownVCs) {
    if (text.includes(vc) && !investors.includes(vc)) {
      investors.push(vc);
    }
  }

  // Dedupe and clean
  return [...new Set(investors)].slice(0, 10);
}

/**
 * Extract lead investor
 */
function extractLeadInvestor(text: string, investors: string[]): string | null {
  // Pattern: "led by X"
  const ledByMatch = text.match(/led\s+by\s+([A-Z][a-zA-Z0-9\s&]+?)(?:,|\.|with)/i);
  if (ledByMatch) {
    return ledByMatch[1].trim();
  }

  // Pattern: "X led the round"
  const ledRoundMatch = text.match(/([A-Z][a-zA-Z0-9\s&]+?)\s+led\s+the\s+round/i);
  if (ledRoundMatch) {
    return ledRoundMatch[1].trim();
  }

  // If only one investor, they're probably lead
  if (investors.length === 1) {
    return investors[0];
  }

  return null;
}

/**
 * Extract announcement date
 */
function extractDate(article: RawArticle): string {
  // Try to extract date from article text
  const text = article.body;

  // Pattern: "announced today", "announced on Month Day"
  const todayMatch = text.match(/announced?\s+today/i);
  if (todayMatch) {
    return new Date().toISOString().split('T')[0];
  }

  // Pattern: "announced on January 15" or "January 15, 2026"
  const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i);
  if (dateMatch) {
    const month = dateMatch[1];
    const day = dateMatch[2];
    const year = dateMatch[3] || new Date().getFullYear().toString();

    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Fallback to article published date
  if (article.publishedAt) {
    return article.publishedAt.split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Process batch of articles
 */
export async function processArticles(articles: RawArticle[]): Promise<FundingEvent[]> {
  const events: FundingEvent[] = [];

  for (const article of articles) {
    // Skip short articles
    if (article.body.length < 300) {
      continue;
    }

    // Classify
    const isFunding = await classifyArticle(article);
    if (!isFunding) {
      continue;
    }

    // Extract
    const event = await extractFundingEvent(article);
    if (event && event.confidenceScore >= 0.3) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Deduplicate funding events
 */
export function deduplicateEvents(events: FundingEvent[], windowDays: number = 3): FundingEvent[] {
  const seen = new Map<string, FundingEvent>();

  for (const event of events) {
    // Create dedupe key
    const key = createDedupeKey(event);

    const existing = seen.get(key);
    if (!existing || event.confidenceScore > existing.confidenceScore) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values());
}

/**
 * Create deduplication key
 */
function createDedupeKey(event: FundingEvent): string {
  const namePart = event.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const roundPart = event.roundType.toLowerCase();
  const amountPart = event.amount ? Math.round(event.amount / 5) * 5 : 'unknown'; // Round to nearest 5

  return `${namePart}|${roundPart}|${amountPart}`;
}
