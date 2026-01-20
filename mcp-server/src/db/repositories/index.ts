/**
 * Repositories Index
 * Centralized repository access
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { WorkflowRepository } from './workflow.repository.js';
import { ScheduleRepository } from './schedule.repository.js';
import { MessageRepository } from './message.repository.js';
import { TaskRepository } from './task.repository.js';
import { PersonRepository } from './person.repository.js';
import { AuditRepository } from './audit.repository.js';
import { StateRepository } from './state.repository.js';

export * from './base.repository.js';
export * from './workflow.repository.js';
export * from './schedule.repository.js';
export * from './message.repository.js';
export * from './task.repository.js';
export * from './person.repository.js';
export * from './audit.repository.js';
export * from './state.repository.js';

export interface Repositories {
  workflow: WorkflowRepository;
  schedule: ScheduleRepository;
  message: MessageRepository;
  task: TaskRepository;
  person: PersonRepository;
  audit: AuditRepository;
  state: StateRepository;
}

let repositories: Repositories | null = null;

export function createRepositories(client: SupabaseClient): Repositories {
  return {
    workflow: new WorkflowRepository(client),
    schedule: new ScheduleRepository(client),
    message: new MessageRepository(client),
    task: new TaskRepository(client),
    person: new PersonRepository(client),
    audit: new AuditRepository(client),
    state: new StateRepository(client)
  };
}

export function getRepositories(client: SupabaseClient): Repositories {
  if (!repositories) {
    repositories = createRepositories(client);
  }
  return repositories;
}

export function resetRepositories(): void {
  repositories = null;
}
