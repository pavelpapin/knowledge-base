/**
 * Base store operations
 */

import * as fs from 'fs';
import { ImprovementStore, Correction } from '../types.js';

const STORE_PATH = '/root/.claude/self-improvement/data/store.json';
const CLAUDE_MD_PATH = '/root/.claude/CLAUDE.md';

export { STORE_PATH, CLAUDE_MD_PATH };

export function loadStore(): ImprovementStore {
  if (fs.existsSync(STORE_PATH)) {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  }
  return { corrections: [], patterns: [] };
}

export function saveStore(store: ImprovementStore): void {
  const dir = STORE_PATH.substring(0, STORE_PATH.lastIndexOf('/'));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function readClaudeMd(): string {
  if (fs.existsSync(CLAUDE_MD_PATH)) {
    return fs.readFileSync(CLAUDE_MD_PATH, 'utf-8');
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
    fs.writeFileSync(CLAUDE_MD_PATH, updated);
  } else {
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
