/**
 * Notion Output
 * Exports research to Notion page
 */

import { ResearchJob, OutputResult } from '../types';
import { generateReport } from '../agents/synthesis';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function exportNotion(job: ResearchJob): Promise<OutputResult> {
  if (!NOTION_API_KEY) {
    return {
      format: 'notion',
      success: false,
      error: 'NOTION_API_KEY not configured'
    };
  }

  try {
    const report = generateReport(job);

    // Create Notion page
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: NOTION_DATABASE_ID
          ? { database_id: NOTION_DATABASE_ID }
          : { page_id: NOTION_DATABASE_ID },
        properties: {
          title: {
            title: [{ text: { content: `Research: ${job.topic}` } }]
          }
        },
        children: markdownToNotionBlocks(report)
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${error}`);
    }

    const result = await response.json() as { url?: string };

    return {
      format: 'notion',
      url: result.url,
      success: true
    };
  } catch (error) {
    return {
      format: 'notion',
      success: false,
      error: (error as Error).message
    };
  }
}

function markdownToNotionBlocks(markdown: string): unknown[] {
  // Simple conversion - headers and paragraphs
  const lines = markdown.split('\n');
  const blocks: unknown[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      blocks.push({
        type: 'heading_1',
        heading_1: { rich_text: [{ text: { content: line.slice(2) } }] }
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: line.slice(3) } }] }
      });
    } else if (line.startsWith('### ')) {
      blocks.push({
        type: 'heading_3',
        heading_3: { rich_text: [{ text: { content: line.slice(4) } }] }
      });
    } else if (line.startsWith('- ')) {
      blocks.push({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ text: { content: line.slice(2) } }] }
      });
    } else if (line.trim()) {
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: line } }] }
      });
    }
  }

  return blocks;
}
