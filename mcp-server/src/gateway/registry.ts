/**
 * Tool Registry
 * Central registry for all MCP tools from adapters
 */

import { Adapter, AdapterTool, MCPToolSchema, zodToMCPSchema, ToolResult } from './types.js';
import { getPolicy, checkRateLimit, requiresApproval } from './policy.js';
import { createAuditContext } from './audit.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('registry');

interface RegisteredTool {
  adapter: string;
  tool: AdapterTool;
  mcpName: string;
  mcpSchema: MCPToolSchema;
}

const registry = new Map<string, RegisteredTool>();

export function registerAdapter(adapter: Adapter): void {
  for (const tool of adapter.tools) {
    const mcpName = `${adapter.name}_${tool.name}`;
    const mcpSchema = zodToMCPSchema(tool.schema);

    registry.set(mcpName, {
      adapter: adapter.name,
      tool,
      mcpName,
      mcpSchema
    });
  }
}

export function getRegisteredTools(): Array<{
  name: string;
  description: string;
  inputSchema: MCPToolSchema;
}> {
  return Array.from(registry.values()).map(({ mcpName, tool, mcpSchema }) => ({
    name: `elio_${mcpName}`,
    description: tool.description,
    inputSchema: mcpSchema
  }));
}

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  // Remove elio_ prefix
  const internalName = toolName.replace(/^elio_/, '');
  const registered = registry.get(internalName);

  if (!registered) {
    return { status: 'blocked', reason: `Unknown tool: ${toolName}` };
  }

  const { tool } = registered;
  const policy = getPolicy(internalName, tool.type);

  // Check rate limit
  const rateCheck = checkRateLimit(internalName, policy);
  if (!rateCheck.allowed) {
    return { status: 'rate_limited', retryAfter: rateCheck.retryAfter! };
  }

  // Check approval requirement
  if (requiresApproval(internalName, tool.type)) {
    // For now, log but allow - future: implement approval flow
    logger.warn(`Tool ${internalName} requires approval - allowing in personal mode`);
  }

  // Start audit context
  const audit = createAuditContext(internalName, params);

  try {
    // Validate params with Zod schema
    const validatedParams = tool.schema.parse(params);

    // Execute tool
    const result = await tool.execute(validatedParams);

    audit.complete('success');

    return {
      status: 'success',
      data: result,
      duration: Date.now() - audit.startTime
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    audit.complete('error', errorMessage);

    return {
      status: 'error',
      error: errorMessage,
      duration: Date.now() - audit.startTime
    };
  }
}

export function isToolRegistered(toolName: string): boolean {
  const internalName = toolName.replace(/^elio_/, '');
  return registry.has(internalName);
}

export function getToolCount(): number {
  return registry.size;
}

export function clearRegistry(): void {
  registry.clear();
}
