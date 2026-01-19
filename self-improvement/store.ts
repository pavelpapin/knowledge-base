/**
 * Self-Improvement Store
 * Re-exports from modular store files
 */

export {
  loadStore, saveStore, readClaudeMd, appendToClaudeMd, getStats, setLastAnalysis
} from './store/base.js';
export {
  logCorrection, getCorrections, markApplied
} from './store/correction.js';
export {
  updatePatterns, getPatterns, getSuggestedRules, generateDailyReport
} from './store/pattern.js';
