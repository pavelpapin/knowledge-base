/**
 * Gateway Types
 * Core type definitions for MCP Gateway
 */

import { z } from 'zod';

// Tool classification
export type ToolType = 'read' | 'write' | 'dangerous' | 'sandbox';

// Tool definition for adapters
export interface AdapterTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  type: ToolType;
  schema: z.ZodType<TInput>;
  execute: (params: TInput) => Promise<TOutput>;
}

// Adapter interface
export interface Adapter {
  name: string;
  isAuthenticated: () => boolean;
  tools: AdapterTool[];
}

// Policy definition
export interface ToolPolicy {
  tool: string;
  permission: 'read' | 'write' | 'admin';
  requiresApproval?: boolean;
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

// Audit entry
export interface AuditEntry {
  id: string;
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;
  result: 'success' | 'error' | 'blocked' | 'rate_limited';
  error?: string;
  duration: number;
}

// Gateway context passed to tools
export interface GatewayContext {
  requestId: string;
  timestamp: string;
}

// Tool execution result
export type ToolResult<T = unknown> =
  | { status: 'success'; data: T; duration: number }
  | { status: 'error'; error: string; duration: number }
  | { status: 'blocked'; reason: string }
  | { status: 'rate_limited'; retryAfter: number };

// MCP Tool schema format
export interface MCPToolSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    default?: unknown;
    enum?: string[];
  }>;
  required?: string[];
}

// Convert Zod schema to MCP format using zod-to-json-schema
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodToMCPSchema(schema: z.ZodType): MCPToolSchema {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonSchema = zodToJsonSchema(schema as any, { target: 'jsonSchema7' }) as {
      type?: string;
      properties?: Record<string, { type?: string; description?: string; default?: unknown; enum?: string[] }>;
      required?: string[];
    };

    // Convert properties to required format
    const properties: MCPToolSchema['properties'] = {};
    if (jsonSchema.properties) {
      for (const [key, value] of Object.entries(jsonSchema.properties)) {
        properties[key] = {
          type: value.type || 'string',
          description: value.description,
          default: value.default,
          enum: value.enum
        };
      }
    }

    return {
      type: 'object',
      properties,
      required: jsonSchema.required
    };
  } catch {
    return { type: 'object', properties: {} };
  }
}
