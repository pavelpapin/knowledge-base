/**
 * MCP Server Types
 */

export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  entrypoint: string;
  inputs: Record<string, {
    type: string;
    required: boolean;
    default?: unknown;
    description: string;
  }>;
  outputs: Record<string, {
    type: string;
    description: string;
  }>;
  timeout?: number;
  tags?: string[];
}

export interface SkillResult {
  success: boolean;
  output?: unknown;
  error?: string;
}
