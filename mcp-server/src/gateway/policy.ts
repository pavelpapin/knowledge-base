/**
 * Policy Engine
 * RBAC and rate limiting for MCP tools
 */

import { ToolPolicy, ToolType } from './types.js';

// Default policies by tool type
const TYPE_POLICIES: Record<ToolType, Omit<ToolPolicy, 'tool'>> = {
  read: { permission: 'read' },
  write: { permission: 'write' },
  dangerous: { permission: 'admin', requiresApproval: true },
  sandbox: { permission: 'admin', requiresApproval: true }
};

// Custom policies for specific tools with rate limits
const CUSTOM_POLICIES: ToolPolicy[] = [
  // Gmail - strict limits to prevent abuse
  {
    tool: 'gmail_send',
    permission: 'write',
    requiresApproval: true,
    rateLimit: { maxCalls: 10, windowMs: 3600000 } // 10 per hour
  },

  // Telegram - moderate limits
  {
    tool: 'telegram_send',
    permission: 'write',
    rateLimit: { maxCalls: 30, windowMs: 60000 } // 30 per minute
  },
  {
    tool: 'telegram_notify',
    permission: 'write',
    rateLimit: { maxCalls: 30, windowMs: 60000 }
  },

  // Slack - moderate limits
  {
    tool: 'slack_send',
    permission: 'write',
    rateLimit: { maxCalls: 20, windowMs: 60000 } // 20 per minute
  },

  // Calendar - strict limits
  {
    tool: 'calendar_create',
    permission: 'write',
    rateLimit: { maxCalls: 20, windowMs: 3600000 } // 20 per hour
  },

  // Notion - moderate limits
  {
    tool: 'notion_create_page',
    permission: 'write',
    rateLimit: { maxCalls: 30, windowMs: 60000 }
  },

  // Sheets - moderate limits
  {
    tool: 'sheets_write',
    permission: 'write',
    rateLimit: { maxCalls: 60, windowMs: 60000 }
  },
  {
    tool: 'sheets_append',
    permission: 'write',
    rateLimit: { maxCalls: 60, windowMs: 60000 }
  },

  // Docs - moderate limits
  {
    tool: 'docs_create',
    permission: 'write',
    rateLimit: { maxCalls: 20, windowMs: 3600000 }
  },
  {
    tool: 'docs_append',
    permission: 'write',
    rateLimit: { maxCalls: 60, windowMs: 60000 }
  },
  {
    tool: 'docs_replace',
    permission: 'write',
    rateLimit: { maxCalls: 60, windowMs: 60000 }
  },

  // n8n - strict limits on triggers
  {
    tool: 'n8n_trigger',
    permission: 'write',
    rateLimit: { maxCalls: 10, windowMs: 60000 } // 10 per minute
  },

  // Research tools - expensive operations
  {
    tool: 'deep_research',
    permission: 'read',
    rateLimit: { maxCalls: 5, windowMs: 3600000 } // 5 per hour
  },
  {
    tool: 'person_research',
    permission: 'read',
    rateLimit: { maxCalls: 10, windowMs: 3600000 } // 10 per hour
  },
  {
    tool: 'web_search',
    permission: 'read',
    rateLimit: { maxCalls: 60, windowMs: 60000 } // 60 per minute
  },
  {
    tool: 'perplexity_search',
    permission: 'read',
    rateLimit: { maxCalls: 30, windowMs: 60000 } // 30 per minute
  }
];

// Rate limit tracking
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function getPolicy(toolName: string, toolType: ToolType): ToolPolicy {
  // Check custom policies first
  const custom = CUSTOM_POLICIES.find(p => p.tool === toolName);
  if (custom) return custom;

  // Fall back to type-based policy
  return { tool: toolName, ...TYPE_POLICIES[toolType] };
}

export function checkRateLimit(toolName: string, policy: ToolPolicy): { allowed: boolean; retryAfter?: number } {
  if (!policy.rateLimit) {
    return { allowed: true };
  }

  const now = Date.now();
  const key = toolName;

  // Cleanup expired entries to prevent memory leak
  for (const [k, v] of rateLimitMap.entries()) {
    if (now > v.resetAt) {
      rateLimitMap.delete(k);
    }
  }

  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + policy.rateLimit.windowMs });
    return { allowed: true };
  }

  if (limit.count >= policy.rateLimit.maxCalls) {
    return { allowed: false, retryAfter: limit.resetAt - now };
  }

  limit.count++;
  return { allowed: true };
}

export function requiresApproval(toolName: string, toolType: ToolType): boolean {
  const policy = getPolicy(toolName, toolType);
  return policy.requiresApproval === true;
}

// Clear rate limits (for testing)
export function clearRateLimits(): void {
  rateLimitMap.clear();
}
