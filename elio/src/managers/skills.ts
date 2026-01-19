/**
 * Skills Manager
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { SkillConfig } from '../types';
import { SKILLS_DIR } from '../utils/paths';
import { readJson, listJsonFiles } from '../utils/fs';

export function listSkills(): SkillConfig[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];

  return fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.existsSync(path.join(SKILLS_DIR, d, 'skill.json')))
    .map(d => readJson<SkillConfig>(path.join(SKILLS_DIR, d, 'skill.json')))
    .filter((s): s is SkillConfig => s !== null);
}

export function getSkill(name: string): SkillConfig | null {
  return readJson<SkillConfig>(path.join(SKILLS_DIR, name, 'skill.json'));
}

export function runSkill(name: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const skill = getSkill(name);
    if (!skill) {
      reject(new Error(`Skill not found: ${name}`));
      return;
    }

    const entrypoint = path.join(SKILLS_DIR, name, skill.entrypoint);
    const proc = spawn(entrypoint, args, {
      cwd: path.join(SKILLS_DIR, name),
      timeout: (skill.timeout || 300) * 1000
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Exit code ${code}: ${stderr}`));
    });

    proc.on('error', reject);
  });
}
