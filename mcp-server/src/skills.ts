/**
 * Skills Registry for MCP Server
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { paths } from '@elio/shared';
import { SkillMetadata, SkillResult } from './types.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('skills');

const SKILLS_DIR = paths.skills;

export function loadSkills(): Map<string, SkillMetadata> {
  const skills = new Map<string, SkillMetadata>();

  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillJsonPath = path.join(SKILLS_DIR, dir, 'skill.json');
    if (fs.existsSync(skillJsonPath)) {
      try {
        const metadata = JSON.parse(
          fs.readFileSync(skillJsonPath, 'utf-8')
        ) as SkillMetadata;
        skills.set(dir, metadata);
      } catch {
        logger.warn(`Failed to load skill: ${dir}`);
      }
    }
  }

  return skills;
}

export async function runSkill(
  skillName: string,
  args: string[]
): Promise<SkillResult> {
  const skillDir = path.join(SKILLS_DIR, skillName);
  const runScript = path.join(skillDir, 'run.sh');

  if (!fs.existsSync(runScript)) {
    return { success: false, error: `Skill not found: ${skillName}` };
  }

  return new Promise((resolve) => {
    const proc = spawn('bash', [runScript, ...args], {
      cwd: skillDir,
      timeout: 120000
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const output = JSON.parse(stdout);
          resolve({ success: true, output });
        } catch {
          resolve({ success: true, output: stdout.trim() });
        }
      } else {
        resolve({ success: false, error: stderr || stdout });
      }
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}
