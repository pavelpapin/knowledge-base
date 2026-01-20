/**
 * Adapters Index
 * Exports all available adapters
 */

import { Adapter } from '../gateway/types.js';
import { gmailAdapter } from './gmail/index.js';
import { calendarAdapter } from './calendar/index.js';
import { telegramAdapter } from './telegram/index.js';
import { slackAdapter } from './slack/index.js';
import { notionAdapter } from './notion/index.js';
import { perplexityAdapter } from './perplexity/index.js';
import { sheetsAdapter } from './sheets/index.js';
import { docsAdapter } from './docs/index.js';
import { linkedinAdapter } from './linkedin/index.js';
import { n8nAdapter } from './n8n/index.js';
import { notebooklmAdapter } from './notebooklm/index.js';
import { databaseAdapter } from './database/index.js';
import { sqlAdapter } from './sql/index.js';
import { webscrapingAdapter } from './webscraping/index.js';

export const adapters: Adapter[] = [
  gmailAdapter,
  calendarAdapter,
  telegramAdapter,
  slackAdapter,
  notionAdapter,
  perplexityAdapter,
  sheetsAdapter,
  docsAdapter,
  linkedinAdapter,
  n8nAdapter,
  notebooklmAdapter,
  databaseAdapter,
  sqlAdapter,
  webscrapingAdapter
];

export {
  gmailAdapter,
  calendarAdapter,
  telegramAdapter,
  slackAdapter,
  notionAdapter,
  perplexityAdapter,
  sheetsAdapter,
  docsAdapter,
  linkedinAdapter,
  n8nAdapter,
  notebooklmAdapter,
  databaseAdapter,
  sqlAdapter,
  webscrapingAdapter
};
