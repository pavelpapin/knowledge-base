/**
 * Path constants
 */

import * as path from 'path';

export const ELIO_ROOT = '/root/.claude';
export const ELIO_DIR = path.join(ELIO_ROOT, 'elio');
export const SKILLS_DIR = path.join(ELIO_ROOT, 'skills');
export const JOBS_DIR = path.join(ELIO_ROOT, 'jobs');
export const MEMORY_DIR = path.join(ELIO_ROOT, 'memory');

export const JOBS_QUEUE = path.join(JOBS_DIR, 'queue');
export const JOBS_ACTIVE = path.join(JOBS_DIR, 'active');
export const JOBS_COMPLETED = path.join(JOBS_DIR, 'completed');
export const JOBS_FAILED = path.join(JOBS_DIR, 'failed');

export const FACTS_FILE = path.join(MEMORY_DIR, 'facts.jsonl');
export const PEOPLE_DIR = path.join(MEMORY_DIR, 'people');
export const PROJECTS_DIR = path.join(MEMORY_DIR, 'projects');
