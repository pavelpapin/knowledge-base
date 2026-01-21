/**
 * Funding Detection Agent Configuration
 * Keywords, sources, and thresholds
 */

import { FundingDetectionConfig } from './types';

// Funding-related keywords for detection
export const FUNDING_KEYWORDS = [
  'raised funding',
  'secured funding',
  'closed a round',
  'Series A',
  'Series B',
  'Series C',
  'Seed round',
  'Pre-Seed',
  'seed funding',
  'led by',
  'investment round',
  'funding round',
  'million in funding',
  'announces funding',
  'closes funding',
  'secures investment',
  'venture capital',
  'VC funding',
  'equity financing'
];

// RSS feeds for startup news
export const RSS_FEEDS = [
  {
    name: 'TechCrunch Startups',
    url: 'https://techcrunch.com/category/startups/feed/',
    priority: 1
  },
  {
    name: 'VentureBeat',
    url: 'https://venturebeat.com/feed/',
    priority: 2
  },
  {
    name: 'Sifted',
    url: 'https://sifted.eu/feed/',
    priority: 1
  },
  {
    name: 'EU-Startups',
    url: 'https://www.eu-startups.com/feed/',
    priority: 2
  },
  {
    name: 'PR Newswire Tech',
    url: 'https://www.prnewswire.com/rss/technology-latest-news.rss',
    priority: 3
  },
  {
    name: 'BusinessWire Tech',
    url: 'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeGVtUXg==',
    priority: 3
  },
  {
    name: 'The Information',
    url: 'https://www.theinformation.com/feed',
    priority: 1
  },
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    priority: 2
  }
];

// Default configuration
export const DEFAULT_CONFIG: FundingDetectionConfig = {
  sources: {
    gdelt: {
      enabled: true,
      keywords: FUNDING_KEYWORDS,
      lookbackHours: 72
    },
    rss: {
      enabled: true,
      feeds: RSS_FEEDS
    }
  },
  extraction: {
    minArticleLength: 300,
    confidenceThreshold: 0.5,
    dedupeWindowDays: 3
  },
  enrichment: {
    enabled: true,
    minConfidenceForEnrichment: 0.6
  }
};

// GDELT API base URL
export const GDELT_API_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Build GDELT query
export function buildGDELTQuery(keywords: string[], lookbackHours: number): string {
  const keywordQuery = keywords.slice(0, 5).map(k => `"${k}"`).join(' OR ');
  const params = new URLSearchParams({
    query: keywordQuery,
    mode: 'artlist',
    maxrecords: '100',
    format: 'json',
    sourcelang: 'eng',
    timespan: `${lookbackHours}h`
  });
  return `${GDELT_API_BASE}?${params.toString()}`;
}

// LLM prompts for extraction
export const PROMPTS = {
  classification: `You are a funding event classifier.
Analyze this article and determine if it describes a company raising investment capital.

Article title: {title}
Article body: {body}

Answer ONLY "yes" or "no".
- "yes" if the article explicitly describes a company announcing or closing a funding round
- "no" if it's about anything else (acquisitions, IPO prep, revenue, product launches, etc.)

Answer:`,

  extraction: `Extract funding round details from this article. Return JSON only.

Article: {article}

Extract these fields (use null if not found):
- company_name: The startup/company that raised funding
- company_website: Their website if mentioned
- round_type: One of [Pre-Seed, Seed, Series A, Series B, Series C, Series D+, Extension, Bridge, Debt, Grant, Unknown]
- amount: Number only (e.g., 50 for "$50 million")
- currency: USD, EUR, GBP, etc.
- investors: Array of investor names
- lead_investor: The lead investor if specified
- announcement_date: YYYY-MM-DD format

Return ONLY valid JSON:
{
  "company_name": "",
  "company_website": null,
  "round_type": "",
  "amount": null,
  "currency": null,
  "investors": [],
  "lead_investor": null,
  "announcement_date": ""
}`
};

// Confidence scoring weights
export const CONFIDENCE_WEIGHTS = {
  hasAmount: 0.25,
  hasRoundType: 0.20,
  hasLeadInvestor: 0.15,
  hasMultipleInvestors: 0.15,
  hasCompanyWebsite: 0.10,
  hasExactDate: 0.10,
  fromPrimarySource: 0.05
};

// Calculate confidence score
export function calculateConfidence(event: {
  amount: number | null;
  roundType: string;
  leadInvestor: string | null;
  investors: string[];
  companyWebsite: string | null;
  announcementDate: string;
  source: string;
}): number {
  let score = 0;

  if (event.amount !== null && event.amount > 0) {
    score += CONFIDENCE_WEIGHTS.hasAmount;
  }

  if (event.roundType && event.roundType !== 'Unknown') {
    score += CONFIDENCE_WEIGHTS.hasRoundType;
  }

  if (event.leadInvestor) {
    score += CONFIDENCE_WEIGHTS.hasLeadInvestor;
  }

  if (event.investors.length > 1) {
    score += CONFIDENCE_WEIGHTS.hasMultipleInvestors;
  }

  if (event.companyWebsite) {
    score += CONFIDENCE_WEIGHTS.hasCompanyWebsite;
  }

  if (event.announcementDate && event.announcementDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    score += CONFIDENCE_WEIGHTS.hasExactDate;
  }

  // Primary sources get bonus
  const primarySources = ['techcrunch.com', 'venturebeat.com', 'prnewswire.com', 'businesswire.com'];
  if (primarySources.some(s => event.source.includes(s))) {
    score += CONFIDENCE_WEIGHTS.fromPrimarySource;
  }

  return Math.min(1.0, score);
}
