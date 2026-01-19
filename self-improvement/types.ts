/**
 * Self-Improvement Types
 * Tracking corrections and learning patterns
 */

export type CorrectionType =
  | 'factual'        // Wrong information
  | 'style'          // Communication style
  | 'preference'     // User preference not followed
  | 'technical'      // Technical mistake
  | 'context'        // Missing context
  | 'tone'           // Wrong tone
  | 'format'         // Wrong format
  | 'other';

export interface Correction {
  id: string;
  timestamp: string;
  type: CorrectionType;
  original: string;       // What was said
  corrected: string;      // How it should have been
  context?: string;       // Additional context
  tags: string[];
  applied: boolean;       // Whether it was applied to CLAUDE.md
}

export interface Pattern {
  id: string;
  type: CorrectionType;
  description: string;
  occurrences: number;
  examples: string[];
  suggestedRule?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  date: string;
  totalCorrections: number;
  byType: Record<CorrectionType, number>;
  patterns: Pattern[];
  suggestedUpdates: string[];
}

export interface ImprovementStore {
  corrections: Correction[];
  patterns: Pattern[];
  lastAnalysis?: string;
}
