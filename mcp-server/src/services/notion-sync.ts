/**
 * Notion Sync Service
 * Bidirectional sync between local DB and Notion
 */

import { getDb } from '../db/index.js';
import { BacklogItem, BacklogType, BacklogPriority, BacklogStatus } from '../db/repositories/backlog.repository.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('notion-sync');

// Notion DB IDs from team config
const NOTION_DBS = {
  technical: '2ef33fbf-b00e-810b-aea3-cafeff3d9462',
  product: '2ef33fbf-b00e-813c-b77a-c9ab4d9450c3'
};

// API config
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionPage {
  id: string;
  url: string;
  properties: Record<string, unknown>;
  last_edited_time: string;
}

/**
 * Get Notion API key from secrets
 */
async function getApiKey(): Promise<string> {
  const fs = await import('fs');
  const path = '/root/.claude/secrets/notion.json';

  if (!fs.existsSync(path)) {
    throw new Error('Notion credentials not found');
  }

  const creds = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return creds.api_key;
}

/**
 * Make Notion API request
 */
async function notionRequest(
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<unknown> {
  const apiKey = await getApiKey();

  const response = await fetch(`${NOTION_API}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Map local priority to Notion select
 */
function mapPriorityToNotion(priority: BacklogPriority): string {
  const map: Record<BacklogPriority, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
  };
  return map[priority];
}

/**
 * Map Notion select to local priority
 */
function mapPriorityFromNotion(notionPriority: string): BacklogPriority {
  const map: Record<string, BacklogPriority> = {
    'Critical': 'critical',
    'High': 'high',
    'Medium': 'medium',
    'Low': 'low'
  };
  return map[notionPriority] || 'medium';
}

/**
 * Map local status to Notion select
 */
function mapStatusToNotion(status: BacklogStatus): string {
  const map: Record<BacklogStatus, string> = {
    backlog: 'Backlog',
    in_progress: 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
    cancelled: 'Cancelled'
  };
  return map[status];
}

/**
 * Map Notion select to local status
 */
function mapStatusFromNotion(notionStatus: string): BacklogStatus {
  const map: Record<string, BacklogStatus> = {
    'Backlog': 'backlog',
    'In Progress': 'in_progress',
    'Done': 'done',
    'Blocked': 'blocked',
    'Cancelled': 'cancelled'
  };
  return map[notionStatus] || 'backlog';
}

/**
 * Create Notion page from backlog item
 */
export async function syncItemToNotion(item: BacklogItem): Promise<{ pageId: string; url: string }> {
  const dbId = NOTION_DBS[item.backlog_type];

  const properties: Record<string, unknown> = {
    'Task': {
      title: [{ text: { content: item.title } }]
    },
    'Priority': {
      select: { name: mapPriorityToNotion(item.priority) }
    },
    'Status': {
      select: { name: mapStatusToNotion(item.status) }
    }
  };

  // Add optional fields
  if (item.category) {
    properties['Category'] = { select: { name: item.category } };
  }

  if (item.effort) {
    properties['Effort'] = { select: { name: item.effort.toUpperCase() } };
  }

  if (item.description) {
    properties['Description'] = {
      rich_text: [{ text: { content: item.description.slice(0, 2000) } }]
    };
  }

  // Source mapping
  const sourceMap: Record<string, string> = {
    cto_review: 'CTO Review',
    cpo_review: 'CPO Review',
    user_feedback: 'User Feedback',
    manual: 'Manual',
    bug_report: 'Bug Report',
    correction_log: 'Correction Log'
  };
  properties['Source'] = { select: { name: sourceMap[item.source] || 'Manual' } };

  // For product backlog, add user quote and impact
  if (item.backlog_type === 'product') {
    if (item.source_quote) {
      properties['User Quote'] = {
        rich_text: [{ text: { content: item.source_quote.slice(0, 2000) } }]
      };
    }
    if (item.impact) {
      properties['Impact'] = { select: { name: item.impact.charAt(0).toUpperCase() + item.impact.slice(1) } };
    }
  }

  let pageId: string;
  let url: string;

  if (item.notion_page_id) {
    // Update existing page
    logger.info('Updating Notion page', { pageId: item.notion_page_id, title: item.title });

    const response = await notionRequest(
      `/pages/${item.notion_page_id}`,
      'PATCH',
      { properties }
    ) as NotionPage;

    pageId = response.id;
    url = response.url;
  } else {
    // Create new page
    logger.info('Creating Notion page', { title: item.title, dbId });

    const response = await notionRequest(
      '/pages',
      'POST',
      {
        parent: { database_id: dbId },
        properties
      }
    ) as NotionPage;

    pageId = response.id;
    url = response.url;
  }

  // Update local record with Notion info
  const db = getDb();
  await db.backlog.updateNotionSync(item.id, pageId, dbId, url);

  logger.info('Synced to Notion', { itemId: item.id, pageId, url });

  return { pageId, url };
}

/**
 * Sync all unsynced items to Notion
 */
export async function syncAllToNotion(type?: BacklogType): Promise<{ synced: number; errors: number }> {
  const db = getDb();
  const items = await db.backlog.getUnsyncedItems(type);

  let synced = 0;
  let errors = 0;

  for (const item of items) {
    try {
      await syncItemToNotion(item);
      synced++;
    } catch (error) {
      logger.error('Failed to sync item to Notion', { itemId: item.id, error });
      errors++;
    }
  }

  logger.info('Sync to Notion complete', { synced, errors });
  return { synced, errors };
}

/**
 * Fetch updates from Notion and sync to local DB
 */
export async function syncFromNotion(type: BacklogType): Promise<{ updated: number; created: number; errors: number }> {
  const db = getDb();
  const dbId = NOTION_DBS[type];

  // Query Notion database
  const response = await notionRequest(
    `/databases/${dbId}/query`,
    'POST',
    {
      sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      page_size: 100
    }
  ) as { results: NotionPage[] };

  let updated = 0;
  let created = 0;
  let errors = 0;

  for (const page of response.results) {
    try {
      const props = page.properties as Record<string, {
        title?: Array<{ plain_text: string }>;
        select?: { name: string };
        rich_text?: Array<{ plain_text: string }>;
      }>;

      // Extract title
      const titleProp = props['Task']?.title;
      const title = titleProp?.[0]?.plain_text;
      if (!title) continue;

      // Extract other fields
      const priority = props['Priority']?.select?.name;
      const status = props['Status']?.select?.name;
      const category = props['Category']?.select?.name;
      const description = props['Description']?.rich_text?.[0]?.plain_text;
      const effort = props['Effort']?.select?.name?.toLowerCase();

      // Check if item exists locally
      const existingItem = await db.backlog.getByNotionPageId(page.id);

      if (existingItem) {
        // Update existing item
        const updateData: Partial<BacklogItem> = {
          title,
          priority: priority ? mapPriorityFromNotion(priority) : existingItem.priority,
          status: status ? mapStatusFromNotion(status) : existingItem.status,
          category: category || existingItem.category,
          description: description || existingItem.description,
          notion_synced_at: new Date().toISOString()
        };

        if (effort && ['xs', 's', 'm', 'l', 'xl'].includes(effort)) {
          updateData.effort = effort as BacklogItem['effort'];
        }

        await db.backlog.update(existingItem.id, updateData);
        updated++;
      } else {
        // Create new item from Notion
        await db.backlog.createItem(title, type, {
          priority: priority ? mapPriorityFromNotion(priority) : 'medium',
          status: status ? mapStatusFromNotion(status) : 'backlog',
          category,
          description,
          effort: effort as BacklogItem['effort'],
          source: 'manual',
          notion_page_id: page.id,
          notion_db_id: dbId,
          notion_url: page.url,
          notion_synced_at: new Date().toISOString()
        });
        created++;
      }
    } catch (error) {
      logger.error('Failed to sync item from Notion', { pageId: page.id, error });
      errors++;
    }
  }

  logger.info('Sync from Notion complete', { type, updated, created, errors });
  return { updated, created, errors };
}

/**
 * Full bidirectional sync
 */
export async function fullSync(type?: BacklogType): Promise<{
  toNotion: { synced: number; errors: number };
  fromNotion: { updated: number; created: number; errors: number };
}> {
  const types: BacklogType[] = type ? [type] : ['technical', 'product'];

  const toNotion = { synced: 0, errors: 0 };
  const fromNotion = { updated: 0, created: 0, errors: 0 };

  for (const t of types) {
    // First sync local → Notion
    const toResult = await syncAllToNotion(t);
    toNotion.synced += toResult.synced;
    toNotion.errors += toResult.errors;

    // Then sync Notion → local
    const fromResult = await syncFromNotion(t);
    fromNotion.updated += fromResult.updated;
    fromNotion.created += fromResult.created;
    fromNotion.errors += fromResult.errors;
  }

  return { toNotion, fromNotion };
}
