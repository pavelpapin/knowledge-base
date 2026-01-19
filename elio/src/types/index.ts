/**
 * Elio Core Types
 */

export interface Job {
  id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  type: string;
  skill: string;
  inputs: Record<string, unknown>;
  progress: number;
  logs: JobLog[];
  result: unknown;
  error: string | null;
  requested_by: string;
  priority: number;
  timeout: number;
}

export interface JobLog {
  timestamp: string;
  message: string;
}

export interface Fact {
  id: string;
  created: string;
  category: string;
  content: string;
  source: string;
  confidence: number;
}

export interface Person {
  name: string;
  aliases: string[];
  first_seen: string;
  last_updated: string;
  relationship: string;
  context: string;
  facts: PersonFact[];
  links: Record<string, string>;
  notes: string;
}

export interface PersonFact {
  date: string;
  fact: string;
}

export interface Project {
  name: string;
  created: string;
  last_updated: string;
  description: string;
  status: string;
  goals: string[];
  architecture: Record<string, unknown>;
  decisions: ProjectDecision[];
  todo: string[];
}

export interface ProjectDecision {
  date: string;
  decision: string;
}

export interface SkillConfig {
  name: string;
  version: string;
  description: string;
  author: string;
  entrypoint: string;
  inputs: Record<string, SkillInput>;
  outputs: Record<string, SkillOutput>;
  dependencies: string[];
  timeout: number;
  tags: string[];
}

export interface SkillInput {
  type: string;
  required: boolean;
  default?: unknown;
  description: string;
}

export interface SkillOutput {
  type: string;
  description: string;
}
