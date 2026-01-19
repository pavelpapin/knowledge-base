/**
 * Self-Improvement Store
 * Persistence layer for corrections and patterns
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  ImprovementStore,
  Correction,
  Pattern,
  CorrectionType,
  DailyReport
} from './types.js';

const STORE_PATH = '/root/.claude/self-improvement/store.json';
const CLAUDE_MD_PATH = '/root/.claude/CLAUDE.md';

function loadStore(): ImprovementStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return { corrections: [], patterns: [] };
}

function saveStore(store: ImprovementStore): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Correction operations

export function logCorrection(
  type: CorrectionType,
  original: string,
  corrected: string,
  context?: string,
  tags: string[] = []
): Correction {
  const store = loadStore();

  const correction: Correction = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    original,
    corrected,
    context,
    tags,
    applied: false
  };

  store.corrections.push(correction);
  saveStore(store);

  // Check if this creates/strengthens a pattern
  updatePatterns(store);

  return correction;
}

export function getCorrections(options: {
  type?: CorrectionType;
  since?: string;
  limit?: number;
} = {}): Correction[] {
  const store = loadStore();
  let corrections = store.corrections;

  if (options.type) {
    corrections = corrections.filter((c: Correction) => c.type === options.type);
  }

  if (options.since) {
    const sinceDate = new Date(options.since);
    corrections = corrections.filter((c: Correction) => new Date(c.timestamp) >= sinceDate);
  }

  if (options.limit) {
    corrections = corrections.slice(-options.limit);
  }

  return corrections;
}

export function markApplied(correctionId: string): boolean {
  const store = loadStore();
  const correction = store.corrections.find((c: Correction) => c.id === correctionId);

  if (correction) {
    correction.applied = true;
    saveStore(store);
    return true;
  }

  return false;
}

// Pattern detection

function updatePatterns(store: ImprovementStore): void {
  const recent = store.corrections.slice(-50);
  const typeGroups = new Map<CorrectionType, Correction[]>();

  // Group by type
  for (const correction of recent) {
    const group = typeGroups.get(correction.type) || [];
    group.push(correction);
    typeGroups.set(correction.type, group);
  }

  // Detect patterns (3+ occurrences of same type)
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

// Daily analysis

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

// CLAUDE.md integration

export function readClaudeMd(): string {
  if (fs.existsSync(CLAUDE_MD_PATH)) {
    return fs.readFileSync(CLAUDE_MD_PATH, 'utf-8');
  }
  return '';
}

export function appendToClaudeMd(section: string, content: string): boolean {
  const claudeMd = readClaudeMd();

  // Find section or append at end
  const sectionHeader = `## ${section}`;

  if (claudeMd.includes(sectionHeader)) {
    // Append to existing section
    const sectionIndex = claudeMd.indexOf(sectionHeader);
    const nextSectionMatch = claudeMd.substring(sectionIndex + sectionHeader.length).match(/\n## /);
    const insertIndex = nextSectionMatch
      ? sectionIndex + sectionHeader.length + (nextSectionMatch.index || 0)
      : claudeMd.length;

    const updated = claudeMd.substring(0, insertIndex) + '\n' + content + claudeMd.substring(insertIndex);
    fs.writeFileSync(CLAUDE_MD_PATH, updated);
  } else {
    // Add new section at end
    const updated = claudeMd + `\n\n${sectionHeader}\n${content}`;
    fs.writeFileSync(CLAUDE_MD_PATH, updated);
  }

  return true;
}

export function getStats(): {
  totalCorrections: number;
  unappliedCorrections: number;
  patterns: number;
  lastAnalysis?: string;
} {
  const store = loadStore();

  return {
    totalCorrections: store.corrections.length,
    unappliedCorrections: store.corrections.filter((c: Correction) => !c.applied).length,
    patterns: store.patterns.length,
    lastAnalysis: store.lastAnalysis
  };
}

export function setLastAnalysis(): void {
  const store = loadStore();
  store.lastAnalysis = new Date().toISOString();
  saveStore(store);
}
