/**
 * Tool type definitions
 */

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    default?: unknown;
  }>;
  required?: string[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  handler: (params: Record<string, unknown>) => Promise<string>;
}

/**
 * Helper to safely parse JSON with fallback
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Helper to convert unknown param to string
 */
export function paramString(value: unknown, defaultValue = ''): string {
  return value !== undefined ? String(value) : defaultValue;
}

/**
 * Helper to convert unknown param to number
 */
export function paramNumber(value: unknown, defaultValue: number): number {
  return value !== undefined ? Number(value) : defaultValue;
}
