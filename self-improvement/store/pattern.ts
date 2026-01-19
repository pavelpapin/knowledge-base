/**
 * Pattern detection and analysis
 */

import * as crypto from 'crypto';
import { loadStore, saveStore } from './base.js';
import { ImprovementStore, Pattern, Correction, CorrectionType, DailyReport } from '../types.js';

export function updatePatterns(store: ImprovementStore): void {
  const recent = store.corrections.slice(-50);
  const typeGroups = new Map<CorrectionType, Correction[]>();

  for (const correction of recent) {
    const group = typeGroups.get(correction.type) || [];
    group.push(correction);
    typeGroups.set(correction.type, group);
  }

  for (const [type, corrections] of typeGroups) {
    if (corrections.length >= 3) {
      const existingPattern = store.patterns.find((p: Pattern) => p.type === type);

      if (existingPattern) {
        existingPattern.occurrences = corrections.length;
        existingPattern.examples = corrections.slice(-3).map(c => c.corrected);
        existingPattern.updatedAt = new Date().toISOString();
      } else {
        store.patterns.push({
          id: crypto.randomUUID(),
          type,
          description: `Repeated ${type} corrections detected`,
          occurrences: corrections.length,
          examples: corrections.slice(-3).map(c => c.corrected),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  saveStore(store);
}

export function getPatterns(): Pattern[] {
  return loadStore().patterns;
}

export function getSuggestedRules(): string[] {
  const patterns = getPatterns();
  const suggestions: string[] = [];

  for (const pattern of patterns) {
    if (pattern.occurrences >= 3) {
      switch (pattern.type) {
        case 'style':
          suggestions.push(`Style preference detected: Review communication patterns in CLAUDE.md`);
          break;
        case 'preference':
          suggestions.push(`User preference: Add explicit rule about ${pattern.examples[0]?.substring(0, 50)}...`);
          break;
        case 'tone':
          suggestions.push(`Tone adjustment needed: Review tone guidelines`);
          break;
        case 'format':
          suggestions.push(`Format preference: Add formatting rule to CLAUDE.md`);
          break;
        default:
          suggestions.push(`Pattern detected (${pattern.type}): ${pattern.description}`);
      }
    }
  }

  return suggestions;
}

export function generateDailyReport(date?: string): DailyReport {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const store = loadStore();

  const dayStart = new Date(targetDate);
  const dayEnd = new Date(targetDate);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dayCorrections = store.corrections.filter((c: Correction) => {
    const ts = new Date(c.timestamp);
    return ts >= dayStart && ts < dayEnd;
  });

  const byType: Record<CorrectionType, number> = {
    factual: 0,
    style: 0,
    preference: 0,
    technical: 0,
    context: 0,
    tone: 0,
    format: 0,
    other: 0
  };

  for (const correction of dayCorrections) {
    byType[correction.type]++;
  }

  return {
    date: targetDate,
    totalCorrections: dayCorrections.length,
    byType,
    patterns: store.patterns.filter((p: Pattern) =>
      new Date(p.updatedAt).toISOString().startsWith(targetDate)
    ),
    suggestedUpdates: getSuggestedRules()
  };
}
