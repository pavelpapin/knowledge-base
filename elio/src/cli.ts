#!/usr/bin/env node
/**
 * Elio CLI
 */

import { execSync } from 'child_process';
import * as memory from './managers/memory';
import * as jobs from './managers/jobs';
import * as skills from './managers/skills';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
};

function log(msg: string, color: keyof typeof colors = 'reset'): void {
  console.log(colors[color] + msg + colors.reset);
}

async function main(): Promise<void> {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'skill':
      await handleSkill(args);
      break;
    case 'job':
      await handleJob(args);
      break;
    case 'memory':
      await handleMemory(args);
      break;
    case 'status':
      showStatus();
      break;
    case 'help':
    default:
      showHelp();
  }
}

async function handleSkill(args: string[]): Promise<void> {
  const [name, ...skillArgs] = args;

  if (!name) {
    log('Available skills:', 'blue');
    skills.listSkills().forEach(s => log(`  - ${s.name}: ${s.description}`));
    return;
  }

  log(`Running skill: ${name}`, 'blue');
  try {
    const result = await skills.runSkill(name, skillArgs);
    console.log(result);
  } catch (err) {
    log(`Error: ${(err as Error).message}`, 'red');
  }
}

async function handleJob(args: string[]): Promise<void> {
  const [sub, ...subargs] = args;

  switch (sub) {
    case 'create': {
      const [skill, inputJson] = subargs;
      const inputs = inputJson ? JSON.parse(inputJson) : {};
      const job = jobs.createJob('skill', skill, inputs, 'cli');
      log(`Created job: ${job.id}`, 'green');
      break;
    }
    case 'run': {
      const result = await jobs.runJob(subargs[0]);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'status': {
      const job = jobs.loadJob(subargs[0]);
      console.log(JSON.stringify(job, null, 2));
      break;
    }
    case 'list': {
      const queued = jobs.getQueuedJobs();
      const active = jobs.getActiveJobs();
      log(`Queued: ${queued.length}, Active: ${active.length}`, 'blue');
      queued.forEach(j => log(`  [Q] ${j.id} - ${j.skill}`));
      active.forEach(j => log(`  [A] ${j.id} - ${j.skill}`));
      break;
    }
    default:
      log('Usage: elio job <create|run|status|list>', 'yellow');
  }
}

async function handleMemory(args: string[]): Promise<void> {
  const [sub, ...subargs] = args;

  switch (sub) {
    case 'search':
      console.log(JSON.stringify(memory.searchMemory(subargs.join(' ')), null, 2));
      break;
    case 'add-fact':
      const fact = memory.addFact('user', subargs.join(' '), 'cli');
      log(`Added fact: ${fact.id}`, 'green');
      break;
    case 'facts':
      console.log(JSON.stringify(memory.getFacts(subargs[0]), null, 2));
      break;
    case 'people':
      console.log(JSON.stringify(memory.listPeople(), null, 2));
      break;
    case 'projects':
      console.log(JSON.stringify(memory.listProjects(), null, 2));
      break;
    default:
      log('Usage: elio memory <search|add-fact|facts|people|projects>', 'yellow');
  }
}

function showStatus(): void {
  log('=== Elio OS Status ===', 'blue');

  try {
    const status = execSync('systemctl is-active elio-bot', { encoding: 'utf-8' }).trim();
    log(`Bot: ${status}`, status === 'active' ? 'green' : 'red');
  } catch {
    log('Bot: inactive', 'red');
  }

  const skillList = skills.listSkills();
  log(`Skills: ${skillList.length} (${skillList.map(s => s.name).join(', ')})`, 'dim');

  const queued = jobs.getQueuedJobs();
  const active = jobs.getActiveJobs();
  log(`Jobs: ${queued.length} queued, ${active.length} active`, 'dim');

  const facts = memory.getFacts();
  const people = memory.listPeople();
  const projects = memory.listProjects();
  log(`Memory: ${facts.length} facts, ${people.length} people, ${projects.length} projects`, 'dim');
}

function showHelp(): void {
  log('=== Elio CLI ===', 'blue');
  log('');
  log('Commands:', 'yellow');
  log('  elio skill [name] [args]    Run a skill');
  log('  elio job create <skill>     Create async job');
  log('  elio job run <id>           Run job');
  log('  elio job status <id>        Check job status');
  log('  elio job list               List jobs');
  log('  elio memory search <query>  Search memory');
  log('  elio memory add-fact <text> Add fact');
  log('  elio memory facts           List facts');
  log('  elio memory people          List people');
  log('  elio memory projects        List projects');
  log('  elio status                 System status');
  log('  elio help                   Show this help');
}

main().catch(err => {
  log(`Error: ${err.message}`, 'red');
  process.exit(1);
});
