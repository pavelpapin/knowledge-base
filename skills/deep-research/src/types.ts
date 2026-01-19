/**
 * Deep Research Agent Types
 */

export type Depth = 'quick' | 'medium' | 'deep';
export type SourceType = 'web' | 'youtube' | 'paper' | 'social' | 'perplexity';
export type Status = 'planning' | 'retrieving' | 'analyzing' | 'synthesizing' | 'verifying' | 'done' | 'failed';

export interface ResearchPlan {
  topic: string;
  depth: Depth;
  subtopics: string[];
  questions: string[];
  sources_strategy: SourceType[];
  estimated_time_minutes: number;
}

export interface Source {
  id: string;
  url: string;
  title: string;
  type: SourceType;
  content: string;
  retrieved_at: string;
  relevance_score: number;
}

export interface Finding {
  id: string;
  claim: string;
  sources: string[];
  confidence: number;
  category: string;
}

export interface OutputResult {
  format: 'markdown' | 'notion' | 'notebooklm' | 'slides';
  path?: string;
  url?: string;
  success: boolean;
  error?: string;
}

export interface ResearchJob {
  id: string;
  topic: string;
  depth: Depth;
  status: Status;
  progress: number;
  plan: ResearchPlan | null;
  sources: Source[];
  findings: Finding[];
  report: string;
  outputs: OutputResult[];
  logs: string[];
  created_at: string;
  updated_at: string;
  error?: string;
}

export interface ResearchConfig {
  default_depth: Depth;
  max_sources: number;
  max_iterations: number;
  output_formats: string[];
}
