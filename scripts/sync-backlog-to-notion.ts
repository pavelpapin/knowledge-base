#!/usr/bin/env npx tsx
/**
 * Sync Backlog to Notion
 *
 * Syncs all unsynced backlog items from Supabase to Notion.
 * Run after nightly cycle to ensure all items are visible in Notion.
 *
 * Usage: npx tsx scripts/sync-backlog-to-notion.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Config
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getSupabaseConfig(): { url: string; key: string } {
  const path = '/root/.claude/secrets/supabase.json';
  if (!fs.existsSync(path)) {
    throw new Error('Supabase credentials not found at ' + path);
  }
  const creds = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return {
    url: creds.url,
    key: creds.anon_key || creds.service_role_key
  };
}

// Notion DB IDs
const NOTION_DBS = {
  technical: '2ef33fbf-b00e-810b-aea3-cafeff3d9462',
  product: '2ef33fbf-b00e-813c-b77a-c9ab4d9450c3'
};

// Types
interface BacklogItem {
  id: string;
  title: string;
  description?: string;
  backlog_type: 'technical' | 'product';
  category?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  effort?: string;
  impact?: string;
  source: string;
  source_quote?: string;
  notion_page_id?: string;
}

// Get Notion key

function getNotionKey(): string {
  const path = '/root/.claude/secrets/notion.json';
  if (!fs.existsSync(path)) {
    throw new Error('Notion credentials not found at ' + path);
  }
  const creds = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return creds.api_key;
}

// Priority/Status mapping
const priorityMap: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const statusMap: Record<string, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
  cancelled: 'Cancelled'
};

const sourceMap: Record<string, string> = {
  cto_review: 'CTO Review',
  cpo_review: 'CPO Review',
  ceo_decision: 'CEO Decision',
  user_feedback: 'User Feedback',
  manual: 'Manual',
  bug_report: 'Bug Report',
  correction_log: 'Correction Log'
};

// Notion API request
async function notionRequest(
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<unknown> {
  const apiKey = getNotionKey();

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

// Create Notion page from backlog item
async function createNotionPage(item: BacklogItem): Promise<{ pageId: string; url: string }> {
  const dbId = NOTION_DBS[item.backlog_type];

  const properties: Record<string, unknown> = {
    'Task': {
      title: [{ text: { content: item.title } }]
    },
    'Priority': {
      select: { name: priorityMap[item.priority] || 'Medium' }
    },
    'Status': {
      select: { name: statusMap[item.status] || 'Backlog' }
    }
  };

  // Add optional fields based on backlog type
  // Technical DB has: Task, Priority, Status, Category, Effort, Description, Source
  // Product DB has: Task, Priority, Status, Category, Impact, Description, Source, User Quote

  if (item.category) {
    properties['Category'] = { select: { name: item.category } };
  }

  // Effort only exists in Technical backlog DB
  if (item.effort && item.backlog_type === 'technical') {
    properties['Effort'] = { select: { name: item.effort.toUpperCase() } };
  }

  if (item.description) {
    properties['Description'] = {
      rich_text: [{ text: { content: item.description.slice(0, 2000) } }]
    };
  }

  properties['Source'] = {
    select: { name: sourceMap[item.source] || 'Manual' }
  };

  // For product backlog, add user quote and impact
  if (item.backlog_type === 'product') {
    if (item.source_quote) {
      properties['User Quote'] = {
        rich_text: [{ text: { content: item.source_quote.slice(0, 2000) } }]
      };
    }
    if (item.impact) {
      properties['Impact'] = {
        select: { name: item.impact.charAt(0).toUpperCase() + item.impact.slice(1) }
      };
    }
  }

  const response = await notionRequest('/pages', 'POST', {
    parent: { database_id: dbId },
    properties
  }) as { id: string; url: string };

  return { pageId: response.id, url: response.url };
}

// Main sync function
async function syncBacklogToNotion() {
  console.log('🔄 Starting backlog sync to Notion...\n');

  const sbConfig = getSupabaseConfig();
  const supabase = createClient(sbConfig.url, sbConfig.key);

  // Get unsynced items (where notion_page_id is null)
  const { data: items, error } = await supabase
    .from('backlog_items')
    .select('*')
    .is('notion_page_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch backlog items: ${error.message}`);
  }

  if (!items || items.length === 0) {
    console.log('✅ No unsynced items found. Everything is in sync!\n');
    return { synced: 0, errors: 0 };
  }

  console.log(`📋 Found ${items.length} unsynced items\n`);

  let synced = 0;
  let errors = 0;

  for (const item of items as BacklogItem[]) {
    try {
      console.log(`  → Syncing: ${item.title}`);

      const { pageId, url } = await createNotionPage(item);

      // Update Supabase with Notion info
      const { error: updateError } = await supabase
        .from('backlog_items')
        .update({
          notion_page_id: pageId,
          notion_db_id: NOTION_DBS[item.backlog_type],
          notion_url: url,
          notion_synced_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) {
        console.log(`    ⚠️  Created in Notion but failed to update DB: ${updateError.message}`);
        errors++;
      } else {
        console.log(`    ✅ Synced → ${url}`);
        synced++;
      }

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (err) {
      console.log(`    ❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 Sync complete: ${synced} synced, ${errors} errors`);
  console.log('═'.repeat(50) + '\n');

  return { synced, errors };
}

// Run
syncBacklogToNotion()
  .then(result => {
    if (result.errors > 0) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
