/**
 * Perplexity Types
 */

export interface PerplexityCredentials {
  api_key: string;
}

export interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  citations?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface SearchResult {
  answer: string;
  citations: string[];
  model: string;
  tokensUsed: number;
  cached?: boolean;
}

export type PerplexityModel =
  | 'sonar'           // Lightweight, fast search (Llama 3.3 70B based)
  | 'sonar-pro'       // Advanced search with more citations
  | 'sonar-reasoning' // Real-time reasoning with search
  | 'sonar-deep-research'; // Long-form research reports

export type SearchRecency = 'month' | 'week' | 'day' | 'hour';
export type ResearchDepth = 'quick' | 'standard' | 'deep';
export type ResearchFocus = 'general' | 'academic' | 'news' | 'code';

export interface SearchOptions {
  model?: PerplexityModel;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  searchRecency?: SearchRecency;
}

export interface ResearchOptions {
  depth?: ResearchDepth;
  focus?: ResearchFocus;
}

export type FactCheckVerdict = 'true' | 'false' | 'partially_true' | 'unverifiable';

export interface FactCheckResult {
  verdict: FactCheckVerdict;
  explanation: string;
  citations: string[];
  cached?: boolean;
}
