/**
 * NotebookLM Integration Types
 */

export interface NotebookSource {
  id: string;
  type: 'text' | 'url' | 'pdf' | 'gdoc';
  title: string;
  content?: string;
  url?: string;
  filePath?: string;
  addedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  description?: string;
  sources: NotebookSource[];
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotebooksStore {
  notebooks: Notebook[];
}

export interface ExportData {
  urls: string[];
  texts: Array<{ title: string; content: string }>;
  googleDocs: string[];
}

export interface NotebookStats {
  totalNotebooks: number;
  totalSources: number;
  totalNotes: number;
}
