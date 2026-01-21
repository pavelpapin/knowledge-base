/**
 * Funding Detection Agent Types
 * Event-driven funding round detection from open sources
 */

export type RoundType =
  | 'Pre-Seed'
  | 'Seed'
  | 'Series A'
  | 'Series B'
  | 'Series C'
  | 'Series D+'
  | 'Extension'
  | 'Bridge'
  | 'Debt'
  | 'Grant'
  | 'Unknown';

export interface RawArticle {
  id: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string;
  source: string;
  fetchedAt: string;
}

export interface FundingEvent {
  id: string;
  companyName: string;
  companyWebsite: string | null;
  roundType: RoundType;
  amount: number | null;
  currency: string | null;
  investors: string[];
  leadInvestor: string | null;
  announcementDate: string;
  sourceUrl: string;
  sourceTitle: string;
  confidenceScore: number;
  extractedAt: string;
  rawArticleId: string;
}

export interface FundingDetectionConfig {
  sources: {
    gdelt: {
      enabled: boolean;
      keywords: string[];
      lookbackHours: number;
    };
    rss: {
      enabled: boolean;
      feeds: Array<{
        name: string;
        url: string;
        priority: number;
      }>;
    };
  };
  extraction: {
    minArticleLength: number;
    confidenceThreshold: number;
    dedupeWindowDays: number;
  };
  enrichment: {
    enabled: boolean;
    minConfidenceForEnrichment: number;
  };
}

export interface DetectionResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  articlesCollected: number;
  articlesFiltered: number;
  eventsDetected: number;
  eventsDeduplicated: number;
  events: FundingEvent[];
}

// GDELT API response types
export interface GDELTArticle {
  url: string;
  title: string;
  seendate: string;
  sourcecountry: string;
  language: string;
  domain: string;
  socialimage?: string;
}

export interface GDELTResponse {
  articles: GDELTArticle[];
}

// RSS Feed item
export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  content?: string;
}
