#!/usr/bin/env tsx
/**
 * Code Generation: registry.yaml → registry.generated.ts
 *
 * Генерирует TypeScript types и const объект из registry.yaml
 * для compile-time type safety при работе с workflows.
 *
 * Usage:
 *   npx tsx scripts/codegen-registry.ts
 *   pnpm codegen:registry
 */

import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'yaml';
import { join } from 'path';

const REGISTRY_PATH = join(__dirname, '../registry.yaml');
const OUTPUT_PATH = join(__dirname, '../packages/shared/src/registry.generated.ts');

interface WorkflowMeta {
  version?: string;
  updated_at?: string;
  description: string;
  status: string;
  code?: string;
  docs?: string;
  script?: string;
  stages?: string[];
  side_effects?: string[];
  replay_safety?: 'safe' | 'unsafe';
  replay_guard?: string;
  done_when?: string;
  failure_model?: {
    retries: number;
    timeout: string;
    on_failure: string;
  };
}

interface Registry {
  workflows: Record<string, WorkflowMeta>;
  skills: Record<string, any>;
  connectors: Record<string, any>;
}

function generateTypeScript(registry: Registry): string {
  const workflows = registry.workflows || {};
  const skills = registry.skills || {};
  const connectors = registry.connectors || {};

  // Extract workflow IDs
  const workflowIds = Object.keys(workflows);
  const activeWorkflowIds = workflowIds.filter(
    id => workflows[id].status !== 'deprecated'
  );
  const skillIds = Object.keys(skills);
  const connectorIds = Object.keys(connectors);

  // Generate TypeScript
  const output = `/**
 * AUTO-GENERATED from registry.yaml
 * DO NOT EDIT MANUALLY
 *
 * Generated at: ${new Date().toISOString()}
 *
 * To regenerate:
 *   pnpm codegen:registry
 */

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

/**
 * All workflow IDs in registry (including deprecated)
 */
export type WorkflowId =
${workflowIds.map(id => `  | '${id}'`).join('\n')};

/**
 * Active workflow IDs (excluding deprecated)
 */
export type ActiveWorkflowId =
${activeWorkflowIds.map(id => `  | '${id}'`).join('\n')};

export type WorkflowStatus = 'implemented' | 'prompt-only' | 'draft' | 'deprecated';

export type ReplaySafety = 'safe' | 'unsafe';

export interface FailureModel {
  retries: number;
  timeout: string;
  on_failure: 'telegram_notify' | 'email_notify' | 'log_only';
}

export interface WorkflowMeta {
  version?: string;
  updated_at?: string;
  description: string;
  status: WorkflowStatus;
  code?: string;
  docs?: string;
  script?: string;
  mcp_adapter?: string;
  stages?: string[];
  side_effects?: string[];
  replay_safety?: ReplaySafety;
  replay_guard?: string;
  done_when?: string;
  failure_model?: FailureModel;
  superseded_by?: string;
}

// ============================================================================
// SKILL TYPES
// ============================================================================

export type SkillId =
${skillIds.map(id => `  | '${id}'`).join('\n')};

export type SkillType = 'prompt-only' | 'package';

export interface SkillMeta {
  description: string;
  type: SkillType;
  package?: string;
  docs?: string;
  mcp_tools?: string[];
  version?: string;
  updated_at?: string;
}

// ============================================================================
// CONNECTOR TYPES
// ============================================================================

export type ConnectorId =
${connectorIds.map(id => `  | '${id}'`).join('\n')};

export interface ConnectorMeta {
  adapter: string | null;
  tools_prefix?: string;
  description?: string;
  credentials?: string;
  priority?: 'primary' | 'fallback';
  used_by?: string[];
}

// ============================================================================
// REGISTRY CONSTANT
// ============================================================================

export const WORKFLOWS: Record<WorkflowId, WorkflowMeta> = ${JSON.stringify(workflows, null, 2)} as const;

export const SKILLS: Record<SkillId, SkillMeta> = ${JSON.stringify(skills, null, 2)} as const;

export const CONNECTORS: Record<ConnectorId, ConnectorMeta> = ${JSON.stringify(connectors, null, 2)} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get workflow metadata by ID
 * @throws if workflow not found
 */
export function getWorkflow(id: WorkflowId): WorkflowMeta {
  const workflow = WORKFLOWS[id];
  if (!workflow) {
    throw new Error(\`Workflow '\${id}' not found in registry\`);
  }
  return workflow;
}

/**
 * Check if workflow is active (not deprecated)
 */
export function isWorkflowActive(id: WorkflowId): boolean {
  return WORKFLOWS[id]?.status !== 'deprecated';
}

/**
 * Get all active workflow IDs
 */
export function getActiveWorkflowIds(): ActiveWorkflowId[] {
  return Object.keys(WORKFLOWS).filter(id =>
    WORKFLOWS[id as WorkflowId].status !== 'deprecated'
  ) as ActiveWorkflowId[];
}

/**
 * Get workflow by ID, throw if deprecated
 */
export function getActiveWorkflow(id: WorkflowId): WorkflowMeta {
  const workflow = getWorkflow(id);
  if (workflow.status === 'deprecated') {
    const superseded = workflow.superseded_by;
    throw new Error(
      \`Workflow '\${id}' is deprecated. Use '\${superseded}' instead.\`
    );
  }
  return workflow;
}

/**
 * Get skill metadata by ID
 */
export function getSkill(id: SkillId): SkillMeta {
  const skill = SKILLS[id];
  if (!skill) {
    throw new Error(\`Skill '\${id}' not found in registry\`);
  }
  return skill;
}

/**
 * Get connector metadata by ID
 */
export function getConnector(id: ConnectorId): ConnectorMeta {
  const connector = CONNECTORS[id];
  if (!connector) {
    throw new Error(\`Connector '\${id}' not found in registry\`);
  }
  return connector;
}
`;

  return output;
}

function main() {
  console.log('📝 Generating TypeScript from registry.yaml...');

  // Read registry
  const registryContent = readFileSync(REGISTRY_PATH, 'utf8');
  const registry = parse(registryContent) as Registry;

  // Generate TypeScript
  const tsCode = generateTypeScript(registry);

  // Write output
  writeFileSync(OUTPUT_PATH, tsCode, 'utf8');

  console.log(`✅ Generated: ${OUTPUT_PATH}`);
  console.log(`   - ${Object.keys(registry.workflows || {}).length} workflows`);
  console.log(`   - ${Object.keys(registry.skills || {}).length} skills`);
  console.log(`   - ${Object.keys(registry.connectors || {}).length} connectors`);
}

main();
