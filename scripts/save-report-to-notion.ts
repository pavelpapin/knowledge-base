#!/usr/bin/env npx tsx
/**
 * Save Report to Notion
 *
 * Creates a Notion page from a markdown report file.
 *
 * Usage: npx tsx scripts/save-report-to-notion.ts <report-type> <date>
 * Example: npx tsx scripts/save-report-to-notion.ts cto 2026-01-22
 */

import * as fs from 'fs';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Report database IDs in Notion
const REPORT_DATABASES: Record<string, string> = {
  cto: '2ee33fbf-b00e-81c2-88ee-ffa070b82eb7', // Nightly CTO Reports
  cpo: '2ef33fbf-b00e-818a-8268-df1d1449448b', // CPO Reports
  ceo: '2ef33fbf-b00e-8191-bfb6-c6c9ac166423'  // CEO Reports
};

function getNotionKey(): string {
  const path = '/root/.claude/secrets/notion.json';
  if (!fs.existsSync(path)) {
    throw new Error('Notion credentials not found');
  }
  const creds = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return creds.api_key;
}

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

function markdownToBlocks(markdown: string): unknown[] {
  const blocks: unknown[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      blocks.push({
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
        }
      });
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: line.slice(3) } }]
        }
      });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: line.slice(4) } }]
        }
      });
      i++;
      continue;
    }

    // Divider
    if (line.startsWith('---')) {
      blocks.push({ type: 'divider', divider: {} });
      i++;
      continue;
    }

    // Table (simplified - collect all table lines and create as code block)
    if (line.startsWith('|')) {
      let tableContent = '';
      while (i < lines.length && lines[i].startsWith('|')) {
        tableContent += lines[i] + '\n';
        i++;
      }
      blocks.push({
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: tableContent.trim() } }],
          language: 'plain text'
        }
      });
      continue;
    }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
        }
      });
      i++;
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      blocks.push({
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: [{ type: 'text', text: { content: numberedMatch[2] } }]
        }
      });
      i++;
      continue;
    }

    // Quote
    if (line.startsWith('> ')) {
      blocks.push({
        type: 'quote',
        quote: {
          rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
        }
      });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3) || 'plain text';
      let codeContent = '';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeContent += lines[i] + '\n';
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: codeContent.trim() } }],
          language: lang === 'typescript' ? 'typescript' : lang === 'json' ? 'json' : 'plain text'
        }
      });
      continue;
    }

    // Regular paragraph
    // Truncate to 2000 chars (Notion limit)
    const content = line.slice(0, 2000);
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content } }]
      }
    });
    i++;
  }

  // Notion API has a limit of 100 blocks per request
  return blocks.slice(0, 100);
}

async function createReportPage(
  reportType: string,
  date: string,
  title: string,
  markdown: string
): Promise<{ url: string }> {
  const dbId = REPORT_DATABASES[reportType];
  if (!dbId) {
    throw new Error(`Unknown report type: ${reportType}. Valid types: ${Object.keys(REPORT_DATABASES).join(', ')}`);
  }

  const blocks = markdownToBlocks(markdown);

  // All report DBs have 'Date' as title property
  const properties: Record<string, unknown> = {
    'Date': {
      title: [{ type: 'text', text: { content: date } }]
    },
    'Status': {
      select: { name: 'Completed' }
    }
  };

  // Add type-specific properties
  if (reportType === 'cto') {
    properties['Auto-Fixes Applied'] = { number: 1 };
  } else if (reportType === 'cpo') {
    properties['Auto-Fixes Applied'] = { number: 0 };
    properties['Proposals'] = { number: 4 };
  } else if (reportType === 'ceo') {
    properties['Mission Progress'] = { select: { name: 'Advancing' } };
    properties['Team Health'] = { select: { name: 'Healthy' } };
  }

  const page = await notionRequest('/pages', 'POST', {
    parent: { database_id: dbId },
    properties,
    children: blocks
  }) as { url: string };

  return { url: page.url };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/save-report-to-notion.ts <report-type> <date>');
    console.log('Example: npx tsx scripts/save-report-to-notion.ts cto 2026-01-22');
    console.log('Report types: cto, cpo, ceo');
    process.exit(1);
  }

  const [reportType, date] = args;
  const reportPath = `/root/.claude/logs/team/${reportType}/${date}.md`;

  if (!fs.existsSync(reportPath)) {
    console.error(`❌ Report not found: ${reportPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading report: ${reportPath}`);
  const markdown = fs.readFileSync(reportPath, 'utf-8');

  // Extract title from first line
  const firstLine = markdown.split('\n')[0];
  const title = firstLine.startsWith('#') ? firstLine.replace(/^#+\s*/, '') : `${reportType.toUpperCase()} Report - ${date}`;

  console.log(`📤 Creating Notion page: ${title}`);

  try {
    const { url } = await createReportPage(reportType, date, title, markdown);
    console.log(`✅ Created: ${url}`);
  } catch (error) {
    console.error(`❌ Failed:`, error);
    process.exit(1);
  }
}

main();
