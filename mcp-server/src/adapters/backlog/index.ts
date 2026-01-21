/**
 * Backlog Adapter
 * MCP tools for CTO/CPO backlog management with Notion sync
 */

import { z } from 'zod';
import type { Adapter, AdapterTool } from '../../gateway/types.js';
import { getDb } from '../../db/index.js';
import { createLogger } from '../../utils/logger.js';
import {
  syncItemToNotion,
  syncAllToNotion,
  syncFromNotion,
  fullSync
} from '../../services/notion-sync.js';

const logger = createLogger('backlog');

function isAuthenticated(): boolean {
  return true; // Uses local DB
}

// Schemas
const createItemSchema = z.object({
  title: z.string().describe('Task title'),
  type: z.enum(['technical', 'product']).describe('Backlog type'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Priority level'),
  category: z.string().optional().describe('Category (e.g., Architecture, UX, Security)'),
  description: z.string().optional().describe('Detailed description'),
  effort: z.enum(['xs', 's', 'm', 'l', 'xl']).optional().describe('Effort estimate'),
  impact: z.enum(['high', 'medium', 'low']).optional().describe('Impact level (for product backlog)'),
  source: z.enum(['cto_review', 'cpo_review', 'user_feedback', 'manual', 'bug_report', 'correction_log']).optional(),
  source_quote: z.string().optional().describe('Original user quote if from feedback'),
  sync_to_notion: z.boolean().optional().default(true).describe('Sync to Notion immediately')
});

const listItemsSchema = z.object({
  type: z.enum(['technical', 'product']).optional().describe('Filter by backlog type'),
  status: z.enum(['backlog', 'in_progress', 'done', 'blocked', 'cancelled']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.number().optional().default(50)
});

const updateItemSchema = z.object({
  id: z.string().describe('Backlog item ID'),
  title: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['backlog', 'in_progress', 'done', 'blocked', 'cancelled']).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  effort: z.enum(['xs', 's', 'm', 'l', 'xl']).optional(),
  sync_to_notion: z.boolean().optional().default(true)
});

const syncSchema = z.object({
  type: z.enum(['technical', 'product']).optional().describe('Sync specific backlog type'),
  direction: z.enum(['to_notion', 'from_notion', 'full']).optional().default('full')
});

const tools: AdapterTool[] = [
  {
    name: 'backlog_create',
    description: 'Create a new backlog item (technical or product). Syncs to Notion by default.',
    type: 'write',
    schema: createItemSchema,
    execute: async (params) => {
      const args = params as z.infer<typeof createItemSchema>;
      logger.info('Creating backlog item', { title: args.title, type: args.type });

      const db = getDb();
      const item = await db.backlog.createItem(args.title, args.type, {
        priority: args.priority,
        category: args.category,
        description: args.description,
        effort: args.effort,
        impact: args.impact,
        source: args.source || (args.type === 'technical' ? 'cto_review' : 'cpo_review'),
        source_quote: args.source_quote
      });

      let notionUrl: string | undefined;
      if (args.sync_to_notion) {
        try {
          const sync = await syncItemToNotion(item);
          notionUrl = sync.url;
        } catch (error) {
          logger.error('Failed to sync to Notion', { error });
        }
      }

      return JSON.stringify({
        success: true,
        item: {
          id: item.id,
          title: item.title,
          type: item.backlog_type,
          priority: item.priority,
          status: item.status,
          notion_url: notionUrl
        }
      }, null, 2);
    }
  },

  {
    name: 'backlog_list',
    description: 'List backlog items with optional filters',
    type: 'read',
    schema: listItemsSchema,
    execute: async (params) => {
      const args = params as z.infer<typeof listItemsSchema>;
      logger.info('Listing backlog items', args);

      const db = getDb();
      let items;

      if (args.status) {
        items = await db.backlog.getByStatus(args.status, args.type);
      } else {
        items = await db.backlog.getActive(args.type);
      }

      // Filter by priority if specified
      if (args.priority) {
        items = items.filter(i => i.priority === args.priority);
      }

      // Apply limit
      items = items.slice(0, args.limit);

      return JSON.stringify({
        count: items.length,
        items: items.map(i => ({
          id: i.id,
          title: i.title,
          type: i.backlog_type,
          priority: i.priority,
          status: i.status,
          category: i.category,
          effort: i.effort,
          notion_url: i.notion_url,
          created_at: i.created_at
        }))
      }, null, 2);
    }
  },

  {
    name: 'backlog_update',
    description: 'Update a backlog item',
    type: 'write',
    schema: updateItemSchema,
    execute: async (params) => {
      const args = params as z.infer<typeof updateItemSchema>;
      logger.info('Updating backlog item', { id: args.id });

      const db = getDb();

      const updateData: Record<string, unknown> = {};
      if (args.title) updateData.title = args.title;
      if (args.priority) updateData.priority = args.priority;
      if (args.status) updateData.status = args.status;
      if (args.category) updateData.category = args.category;
      if (args.description) updateData.description = args.description;
      if (args.effort) updateData.effort = args.effort;

      if (args.status === 'done') {
        updateData.completed_at = new Date().toISOString();
      }

      const item = await db.backlog.update(args.id, updateData);

      let notionUrl = item.notion_url;
      if (args.sync_to_notion && item.notion_page_id) {
        try {
          const sync = await syncItemToNotion(item);
          notionUrl = sync.url;
        } catch (error) {
          logger.error('Failed to sync to Notion', { error });
        }
      }

      return JSON.stringify({
        success: true,
        item: {
          id: item.id,
          title: item.title,
          type: item.backlog_type,
          priority: item.priority,
          status: item.status,
          notion_url: notionUrl
        }
      }, null, 2);
    }
  },

  {
    name: 'backlog_stats',
    description: 'Get backlog statistics',
    type: 'read',
    schema: z.object({}),
    execute: async () => {
      logger.info('Getting backlog stats');

      const db = getDb();
      const stats = await db.backlog.getStats();

      return JSON.stringify({
        stats,
        summary: {
          total_active: stats.reduce((sum, s) => sum + s.backlog + s.in_progress + s.blocked, 0),
          total_done: stats.reduce((sum, s) => sum + s.done, 0),
          high_priority: stats.reduce((sum, s) => sum + s.high_priority, 0)
        }
      }, null, 2);
    }
  },

  {
    name: 'backlog_sync',
    description: 'Sync backlog with Notion (bidirectional)',
    type: 'write',
    schema: syncSchema,
    execute: async (params) => {
      const args = params as z.infer<typeof syncSchema>;
      logger.info('Syncing backlog with Notion', args);

      let result;

      switch (args.direction) {
        case 'to_notion':
          result = { toNotion: await syncAllToNotion(args.type) };
          break;
        case 'from_notion':
          if (args.type) {
            result = { fromNotion: await syncFromNotion(args.type) };
          } else {
            const technical = await syncFromNotion('technical');
            const product = await syncFromNotion('product');
            result = {
              fromNotion: {
                updated: technical.updated + product.updated,
                created: technical.created + product.created,
                errors: technical.errors + product.errors
              }
            };
          }
          break;
        default:
          result = await fullSync(args.type);
      }

      return JSON.stringify({
        success: true,
        ...result
      }, null, 2);
    }
  },

  {
    name: 'backlog_complete',
    description: 'Mark a backlog item as done',
    type: 'write',
    schema: z.object({
      id: z.string().describe('Backlog item ID'),
      sync_to_notion: z.boolean().optional().default(true)
    }),
    execute: async (params) => {
      const args = params as { id: string; sync_to_notion?: boolean };
      logger.info('Completing backlog item', { id: args.id });

      const db = getDb();
      const item = await db.backlog.complete(args.id);

      if (args.sync_to_notion !== false) {
        try {
          await syncItemToNotion(item);
        } catch (error) {
          logger.error('Failed to sync to Notion', { error });
        }
      }

      return JSON.stringify({
        success: true,
        message: `Item "${item.title}" marked as done`
      });
    }
  }
];

export const backlogAdapter: Adapter = {
  name: 'backlog',
  isAuthenticated,
  tools
};
