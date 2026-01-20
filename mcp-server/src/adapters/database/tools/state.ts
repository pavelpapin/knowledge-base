/**
 * State Tools
 * Tools for system state and messages
 */

import { z } from 'zod';
import { AdapterTool } from '../../../gateway/types.js';
import { getDb } from '../../../db/index.js';
import { stateGetSchema, stateSetSchema, messagesSchema, safeJsonParse } from '../schemas.js';

export const stateTools: AdapterTool[] = [
  {
    name: 'state_get',
    description: 'Get system state value by key',
    type: 'read',
    schema: stateGetSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof stateGetSchema>;
      const value = await getDb().state.get(p.key);
      return JSON.stringify({ key: p.key, value });
    }
  },
  {
    name: 'state_set',
    description: 'Set system state value',
    type: 'write',
    schema: stateSetSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof stateSetSchema>;
      const value = safeJsonParse(p.value);
      await getDb().state.set(p.key, value);
      return JSON.stringify({ success: true });
    }
  },
  {
    name: 'messages_unprocessed',
    description: 'Get unprocessed messages from inbox',
    type: 'read',
    schema: messagesSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof messagesSchema>;
      const messages = await getDb().message.getUnprocessed(p.source, { limit: p.limit });
      return JSON.stringify(messages, null, 2);
    }
  },
  {
    name: 'health',
    description: 'Check database connection health',
    type: 'read',
    schema: z.object({}),
    execute: async () => {
      const healthy = await getDb().healthCheck();
      const cacheStats = getDb().cache.stats();
      return JSON.stringify({
        database: healthy ? 'connected' : 'disconnected',
        cache: cacheStats
      }, null, 2);
    }
  }
];
