/**
 * Gateway Module
 * Re-exports all gateway components
 */

export type {
  ToolType,
  AdapterTool,
  Adapter,
  ToolPolicy,
  AuditEntry,
  GatewayContext,
  ToolResult,
  MCPToolSchema
} from './types.js';

export { zodToMCPSchema } from './types.js';
export { getPolicy, checkRateLimit, requiresApproval, clearRateLimits } from './policy.js';
export { logAudit, createAuditContext } from './audit.js';
export { registerAdapter, getRegisteredTools, executeTool, isToolRegistered, getToolCount, clearRegistry } from './registry.js';
