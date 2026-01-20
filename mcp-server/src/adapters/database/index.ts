/**
 * Database Adapter
 * Exposes database operations as MCP tools using Repository pattern
 */

import { Adapter } from '../../gateway/types.js';
import { isAuthenticated } from '../../integrations/supabase/client.js';
import { workflowTools, scheduleTools, taskTools, stateTools } from './tools/index.js';

export const databaseAdapter: Adapter = {
  name: 'database',
  isAuthenticated,
  tools: [
    ...workflowTools,
    ...scheduleTools,
    ...taskTools,
    ...stateTools
  ]
};
