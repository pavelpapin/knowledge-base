/**
 * Correction operations
 */

import * as crypto from 'crypto';
import { loadStore, saveStore } from './base.js';
import { updatePatterns } from './pattern.js';
import { Correction, CorrectionType } from '../types.js';

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
