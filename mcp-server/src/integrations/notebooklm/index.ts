/**
 * NotebookLM Integration
 * Interact with Google NotebookLM for research and summarization
 */

export type { Notebook, NotebookSource, ExportData, NotebookStats } from './types.js';
export { isConfigured, getInstructions } from './store.js';

// Notebook management
export {
  createNotebook,
  getNotebook,
  listNotebooks,
  deleteNotebook,
  addNote,
  getNotes
} from './notebooks.js';

// Source management
export {
  addTextSource,
  addUrlSource,
  addGoogleDocSource,
  removeSource
} from './sources.js';

// Export and analysis
export {
  exportForNotebookLM,
  generateAnalysisPrompt,
  getStats
} from './export.js';
