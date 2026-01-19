/**
 * Memory Manager
 * Persistent knowledge storage
 */

import * as path from 'path';
import * as crypto from 'crypto';
import { Fact, Person, Project } from '../types';
import { FACTS_FILE, PEOPLE_DIR, PROJECTS_DIR } from '../utils/paths';
import { readJson, writeJson, appendJsonl, readJsonl, listJsonFiles, safeName, ensureDir } from '../utils/fs';

function generateId(): string {
  return crypto.randomUUID();
}

// === FACTS ===

export function addFact(category: string, content: string, source = 'system', confidence = 0.8): Fact {
  const fact: Fact = {
    id: generateId(),
    created: new Date().toISOString().split('T')[0],
    category,
    content,
    source,
    confidence
  };
  appendJsonl(FACTS_FILE, fact);
  return fact;
}

export function getFacts(category?: string, limit = 100): Fact[] {
  let facts = readJsonl<Fact>(FACTS_FILE);
  if (category) {
    facts = facts.filter(f => f.category === category);
  }
  return facts.slice(-limit);
}

export function searchFacts(query: string): Fact[] {
  const q = query.toLowerCase();
  return getFacts().filter(f =>
    f.content.toLowerCase().includes(q) ||
    f.category.toLowerCase().includes(q)
  );
}

// === PEOPLE ===

function personPath(name: string): string {
  return path.join(PEOPLE_DIR, `${safeName(name)}.json`);
}

export function getPerson(name: string): Person | null {
  return readJson<Person>(personPath(name));
}

export function savePerson(person: Person): Person {
  person.last_updated = new Date().toISOString().split('T')[0];
  writeJson(personPath(person.name), person);
  return person;
}

export function createPerson(name: string, data: Partial<Person> = {}): Person {
  const person: Person = {
    name,
    aliases: data.aliases || [],
    first_seen: new Date().toISOString().split('T')[0],
    last_updated: new Date().toISOString().split('T')[0],
    relationship: data.relationship || 'unknown',
    context: data.context || '',
    facts: [],
    links: data.links || {},
    notes: data.notes || ''
  };
  return savePerson(person);
}

export function listPeople(): Array<{ name: string; relationship: string; context: string }> {
  ensureDir(PEOPLE_DIR);
  return listJsonFiles(PEOPLE_DIR).map(f => {
    const p = readJson<Person>(path.join(PEOPLE_DIR, f));
    return p ? { name: p.name, relationship: p.relationship, context: p.context } : null;
  }).filter((x): x is { name: string; relationship: string; context: string } => x !== null);
}

// === PROJECTS ===

function projectPath(name: string): string {
  return path.join(PROJECTS_DIR, `${safeName(name)}.json`);
}

export function getProject(name: string): Project | null {
  return readJson<Project>(projectPath(name));
}

export function saveProject(project: Project): Project {
  project.last_updated = new Date().toISOString().split('T')[0];
  writeJson(projectPath(project.name), project);
  return project;
}

export function createProject(name: string, data: Partial<Project> = {}): Project {
  const project: Project = {
    name,
    created: new Date().toISOString().split('T')[0],
    last_updated: new Date().toISOString().split('T')[0],
    description: data.description || '',
    status: data.status || 'active',
    goals: data.goals || [],
    architecture: data.architecture || {},
    decisions: [],
    todo: []
  };
  return saveProject(project);
}

export function listProjects(): Array<{ name: string; status: string; description: string }> {
  ensureDir(PROJECTS_DIR);
  return listJsonFiles(PROJECTS_DIR).map(f => {
    const p = readJson<Project>(path.join(PROJECTS_DIR, f));
    return p ? { name: p.name, status: p.status, description: p.description } : null;
  }).filter((x): x is { name: string; status: string; description: string } => x !== null);
}

// === SEARCH ===

export function searchMemory(query: string) {
  const q = query.toLowerCase();
  return {
    facts: searchFacts(query),
    people: listPeople().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.context.toLowerCase().includes(q)
    ).map(p => getPerson(p.name)).filter((x): x is Person => x !== null),
    projects: listProjects().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    ).map(p => getProject(p.name)).filter((x): x is Project => x !== null)
  };
}
