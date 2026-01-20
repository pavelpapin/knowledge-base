/**
 * Base store operations
 * Uses @elio/shared for storage
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createStore, paths } from '@elio/shared';
import { ImprovementStore, Correction } from '../types.js';

const DEFAULT_STORE: ImprovementStore = {
  corrections: [],
  patterns: []
};

const store = createStore<ImprovementStore>(paths.data.selfImprovement, DEFAULT_STORE);

export const STORE_PATH = paths.data.selfImprovement;
export const CLAUDE_MD_PATH = paths.claudeMd;

export function loadStore(): ImprovementStore {
  return store.load();
}

export function saveStore(data: ImprovementStore): void {
  store.save(data);
}

export function readClaudeMd(): string {
  if (existsSync(CLAUDE_MD_PATH)) {
    return readFileSync(CLAUDE_MD_PATH, 'utf-8');
  }
  return '';
}

export function appendToClaudeMd(section: string, content: string): boolean {
  const claudeMd = readClaudeMd();
  const sectionHeader = `## ${section}`;

  if (claudeMd.includes(sectionHeader)) {
    const sectionIndex = claudeMd.indexOf(sectionHeader);
    const nextSectionMatch = claudeMd.substring(sectionIndex + sectionHeader.length).match(/\n## /);
    const insertIndex = nextSectionMatch
      ? sectionIndex + sectionHeader.length + (nextSectionMatch.index || 0)
      : claudeMd.length;

    const updated = claudeMd.substring(0, insertIndex) + '\n' + content + claudeMd.substring(insertIndex);
    writeFileSync(CLAUDE_MD_PATH, updated);
  } else {
    const updated = claudeMd + `\n\n${sectionHeader}\n${content}`;
    writeFileSync(CLAUDE_MD_PATH, updated);
  }

  return true;
}

export function getStats(): {
  totalCorrections: number;
  unappliedCorrections: number;
  patterns: number;
  lastAnalysis?: string;
} {
  const data = store.load();

  return {
    totalCorrections: data.corrections.length,
    unappliedCorrections: data.corrections.filter((c: Correction) => !c.applied).length,
    patterns: data.patterns.length,
    lastAnalysis: data.lastAnalysis
  };
}

export function setLastAnalysis(): void {
  store.update(current => ({
    ...current,
    lastAnalysis: new Date().toISOString()
  }));
}
