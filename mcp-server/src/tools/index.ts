/**
 * MCP Tools Registry
 * Aggregates all tool modules
 */

export { Tool, ToolInputSchema } from './types.js';

import { gmailTools } from './gmail.js';
import { calendarTools } from './calendar.js';
import { notionTools } from './notion.js';
import { linkedinTools } from './linkedin.js';
import { perplexityTools } from './perplexity.js';
import { telegramTools } from './telegram.js';
import { slackTools } from './slack.js';
import { sheetsTools } from './sheets.js';
import { n8nTools } from './n8n.js';
import { docsTools } from './docs.js';
import { notebookTools } from './notebooklm.js';
import { Tool } from './types.js';

export const INTEGRATION_TOOLS: Tool[] = [
  ...gmailTools,
  ...calendarTools,
  ...notionTools,
  ...linkedinTools,
  ...perplexityTools,
  ...telegramTools,
  ...slackTools,
  ...sheetsTools,
  ...n8nTools,
  ...docsTools,
  ...notebookTools
];

// Re-export individual tool arrays for selective imports
export {
  gmailTools,
  calendarTools,
  notionTools,
  linkedinTools,
  perplexityTools,
  telegramTools,
  slackTools,
  sheetsTools,
  n8nTools,
  docsTools,
  notebookTools
};
