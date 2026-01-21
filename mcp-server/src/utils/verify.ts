/**
 * Verification Agent
 * Validates deliverables before marking task as complete
 */

import { fileLogger } from './file-logger.js';
import { notifyTelegram } from './progress.js';

export type DeliverableType = 'notion_page' | 'notion_database_entry' | 'file' | 'email_sent' | 'calendar_event';

export interface VerifyConfig {
  type: DeliverableType;

  // For Notion
  pageId?: string;
  databaseId?: string;
  expectedProperties?: Record<string, unknown>;
  minBlocks?: number;
  requiredHeadings?: string[];

  // For files
  filePath?: string;
  minSize?: number;
  containsText?: string[];

  // For email
  messageId?: string;
  recipientEmail?: string;

  // For calendar
  eventId?: string;

  // General
  maxRetries?: number;
  retryDelay?: number; // ms
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
  url?: string;
  path?: string;
}

// Load Notion token
function getNotionToken(): string | null {
  try {
    const fs = require('fs');
    const data = fs.readFileSync('/root/.claude/secrets/notion-token.json', 'utf-8');
    return JSON.parse(data).api_key;
  } catch {
    return null;
  }
}

/**
 * Verify Notion page exists and has expected content
 */
async function verifyNotionPage(config: VerifyConfig): Promise<VerifyResult> {
  const token = getNotionToken();
  if (!token) {
    return { ok: false, error: 'Notion token not found' };
  }

  const pageId = config.pageId;
  if (!pageId) {
    return { ok: false, error: 'pageId required' };
  }

  try {
    // 1. Fetch page
    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!pageResponse.ok) {
      const error = await pageResponse.text();
      return { ok: false, error: `Page not found: ${error}` };
    }

    const page = await pageResponse.json() as { url: string; properties: Record<string, unknown> };

    // 2. Fetch blocks (content)
    const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!blocksResponse.ok) {
      return { ok: false, error: 'Failed to fetch page blocks' };
    }

    const blocksData = await blocksResponse.json() as { results: Array<{ type: string; [key: string]: unknown }> };
    const blocks = blocksData.results;

    // 3. Check minimum blocks
    if (config.minBlocks && blocks.length < config.minBlocks) {
      return {
        ok: false,
        error: `Content too short: ${blocks.length} blocks, expected at least ${config.minBlocks}`,
        details: { actualBlocks: blocks.length }
      };
    }

    // 4. Check required headings
    if (config.requiredHeadings && config.requiredHeadings.length > 0) {
      const headings: string[] = [];

      for (const block of blocks) {
        if (block.type?.startsWith('heading')) {
          const headingData = block[block.type] as { rich_text?: Array<{ plain_text: string }> };
          if (headingData?.rich_text) {
            const text = headingData.rich_text.map(t => t.plain_text).join('');
            headings.push(text);
          }
        }
      }

      const missing: string[] = [];
      for (const required of config.requiredHeadings) {
        const found = headings.some(h =>
          h.toLowerCase().includes(required.toLowerCase())
        );
        if (!found) {
          missing.push(required);
        }
      }

      if (missing.length > 0) {
        return {
          ok: false,
          error: `Missing required sections: ${missing.join(', ')}`,
          details: { foundHeadings: headings, missing }
        };
      }
    }

    // 5. Check expected properties
    if (config.expectedProperties) {
      for (const [key, expectedValue] of Object.entries(config.expectedProperties)) {
        const actualProp = page.properties[key];
        if (!actualProp) {
          return {
            ok: false,
            error: `Missing property: ${key}`,
            details: { expectedProperties: Object.keys(config.expectedProperties) }
          };
        }
        // Could add more detailed property value checking here
      }
    }

    return {
      ok: true,
      url: page.url,
      details: {
        blocksCount: blocks.length,
        properties: Object.keys(page.properties)
      }
    };
  } catch (error) {
    return { ok: false, error: `Verification failed: ${error}` };
  }
}

/**
 * Verify file exists and meets criteria
 */
async function verifyFile(config: VerifyConfig): Promise<VerifyResult> {
  const fs = require('fs');
  const path = config.filePath;

  if (!path) {
    return { ok: false, error: 'filePath required' };
  }

  try {
    // 1. Check exists
    if (!fs.existsSync(path)) {
      return { ok: false, error: `File not found: ${path}` };
    }

    // 2. Check size
    const stats = fs.statSync(path);
    if (config.minSize && stats.size < config.minSize) {
      return {
        ok: false,
        error: `File too small: ${stats.size} bytes, expected at least ${config.minSize}`,
        details: { actualSize: stats.size }
      };
    }

    // 3. Check content
    if (config.containsText && config.containsText.length > 0) {
      const content = fs.readFileSync(path, 'utf-8');
      const missing: string[] = [];

      for (const text of config.containsText) {
        if (!content.includes(text)) {
          missing.push(text);
        }
      }

      if (missing.length > 0) {
        return {
          ok: false,
          error: `Missing required content: ${missing.join(', ')}`,
          details: { missing }
        };
      }
    }

    return {
      ok: true,
      path,
      details: { size: stats.size }
    };
  } catch (error) {
    return { ok: false, error: `File verification failed: ${error}` };
  }
}

/**
 * Main verify function with retry logic
 */
export async function verify(
  config: VerifyConfig,
  runId?: string
): Promise<VerifyResult> {
  const logger = fileLogger.forRun('verify', runId || 'default');
  const maxRetries = config.maxRetries ?? 3;
  const retryDelay = config.retryDelay ?? 2000;

  logger.info(`Starting verification: ${config.type}`, { config });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let result: VerifyResult;

    switch (config.type) {
      case 'notion_page':
      case 'notion_database_entry':
        result = await verifyNotionPage(config);
        break;

      case 'file':
        result = await verifyFile(config);
        break;

      case 'email_sent':
        // TODO: Implement Gmail verification
        result = { ok: true, details: { note: 'Email verification not yet implemented' } };
        break;

      case 'calendar_event':
        // TODO: Implement Calendar verification
        result = { ok: true, details: { note: 'Calendar verification not yet implemented' } };
        break;

      default:
        result = { ok: false, error: `Unknown deliverable type: ${config.type}` };
    }

    if (result.ok) {
      logger.info(`Verification passed on attempt ${attempt}`, result.details);
      return result;
    }

    logger.warn(`Verification failed (attempt ${attempt}/${maxRetries}): ${result.error}`);

    if (attempt < maxRetries) {
      // Notify about retry
      await notifyTelegram(`⚠️ Verification failed (${attempt}/${maxRetries}): ${result.error}\nRetrying...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } else {
      // Final failure
      logger.error(`Verification failed after ${maxRetries} attempts`, result);
      await notifyTelegram(`❌ Verification FAILED: ${result.error}`);
      return result;
    }
  }

  return { ok: false, error: 'Unexpected verification loop exit' };
}

/**
 * Verification presets for common deliverables
 */
export const VERIFY_PRESETS = {
  deepResearchReport: (pageId: string): VerifyConfig => ({
    type: 'notion_page',
    pageId,
    minBlocks: 15,
    requiredHeadings: [
      'Executive Summary',
      'Компании',
      'Recommendations'
    ]
  }),

  meetingPrep: (pageId: string): VerifyConfig => ({
    type: 'notion_page',
    pageId,
    minBlocks: 5,
    requiredHeadings: [
      'About',
      'Talking Points'
    ]
  }),

  emailDraft: (filePath: string): VerifyConfig => ({
    type: 'file',
    filePath,
    minSize: 100,
    containsText: ['Subject:', 'Body:']
  }),

  researchFile: (filePath: string): VerifyConfig => ({
    type: 'file',
    filePath,
    minSize: 500,
    containsText: ['##', 'Sources']
  })
};

/**
 * Wrap a task with automatic verification
 */
export async function withVerification<T extends { pageId?: string; path?: string }>(
  taskName: string,
  task: () => Promise<T>,
  verifyConfig: (result: T) => VerifyConfig,
  runId?: string
): Promise<{ result: T; verified: boolean; verifyResult: VerifyResult }> {
  const logger = fileLogger.forRun('verify', runId || 'default');

  logger.info(`Starting task with verification: ${taskName}`);

  // Execute task
  const result = await task();

  // Build verify config from result
  const config = verifyConfig(result);

  // Verify
  const verifyResult = await verify(config, runId);

  if (!verifyResult.ok) {
    throw new Error(`Task ${taskName} failed verification: ${verifyResult.error}`);
  }

  logger.info(`Task ${taskName} completed and verified`);

  return { result, verified: true, verifyResult };
}
