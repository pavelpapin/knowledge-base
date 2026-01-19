/**
 * MCP Tools Registry
 * All integration tools for the MCP server
 */

import * as gmail from './integrations/gmail.js';
import * as calendar from './integrations/calendar.js';
import * as notion from './integrations/notion.js';
import * as linkedin from './integrations/linkedin.js';
import * as perplexity from './integrations/perplexity.js';
import * as telegram from './integrations/telegram.js';
import * as slack from './integrations/slack.js';
import * as sheets from './integrations/sheets.js';
import * as n8n from './integrations/n8n.js';
import * as docs from './integrations/docs.js';
import * as notebooklm from './integrations/notebooklm.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<string>;
}

// Gmail Tools
const gmailTools: Tool[] = [
  {
    name: 'gmail_list',
    description: 'List recent emails or search inbox',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', default: 10 }
      }
    },
    handler: async (params) => {
      const emails = await gmail.listEmails(String(params.query || ''), Number(params.maxResults || 10));
      return emails.map(e => `${e.date} | ${e.from}\n  ${e.subject}\n  ${e.snippet}`).join('\n\n') || 'No emails found';
    }
  },
  {
    name: 'gmail_read',
    description: 'Read full email by ID',
    inputSchema: {
      type: 'object',
      properties: { messageId: { type: 'string' } },
      required: ['messageId']
    },
    handler: async (params) => {
      const email = await gmail.getEmail(String(params.messageId));
      if (!email) return 'Email not found';
      return `From: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body || email.snippet}`;
    }
  },
  {
    name: 'gmail_send',
    description: 'Send an email',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['to', 'subject', 'body']
    },
    handler: async (params) => {
      const result = await gmail.sendEmail(String(params.to), String(params.subject), String(params.body));
      return result.success ? `Sent: ${result.messageId}` : `Failed: ${result.error}`;
    }
  }
];

// Calendar Tools
const calendarTools: Tool[] = [
  {
    name: 'calendar_today',
    description: 'Get today\'s events',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const events = await calendar.getTodayEvents();
      return events.length ? events.map(e => `${e.start} - ${e.end}: ${e.summary}`).join('\n') : 'No events today';
    }
  },
  {
    name: 'calendar_week',
    description: 'Get this week\'s events',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const events = await calendar.getWeekEvents();
      return events.length ? events.map(e => `${e.start} - ${e.end}: ${e.summary}`).join('\n') : 'No events this week';
    }
  },
  {
    name: 'calendar_create',
    description: 'Create calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601' },
        end: { type: 'string', description: 'ISO 8601' },
        description: { type: 'string' },
        location: { type: 'string' }
      },
      required: ['summary', 'start', 'end']
    },
    handler: async (params) => {
      const result = await calendar.createEvent('primary', {
        summary: String(params.summary),
        start: String(params.start),
        end: String(params.end),
        description: params.description ? String(params.description) : undefined,
        location: params.location ? String(params.location) : undefined
      });
      return result.success ? `Created: ${result.htmlLink}` : `Failed: ${result.error}`;
    }
  }
];

// Notion Tools
const notionTools: Tool[] = [
  {
    name: 'notion_search',
    description: 'Search Notion pages and databases',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filter: { type: 'string', description: 'page or database' }
      },
      required: ['query']
    },
    handler: async (params) => {
      const results = await notion.search(String(params.query), params.filter as 'page' | 'database' | undefined);
      return results.map(r => `${r.title} - ${r.url}`).join('\n') || 'No results';
    }
  },
  {
    name: 'notion_databases',
    description: 'List all Notion databases',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const dbs = await notion.listDatabases();
      return dbs.map(d => `${d.title} (${d.id})`).join('\n') || 'No databases';
    }
  },
  {
    name: 'notion_query',
    description: 'Query a Notion database',
    inputSchema: {
      type: 'object',
      properties: { databaseId: { type: 'string' } },
      required: ['databaseId']
    },
    handler: async (params) => {
      const pages = await notion.queryDatabase(String(params.databaseId));
      return pages.map(p => `${p.title} - ${p.url}`).join('\n') || 'No results';
    }
  },
  {
    name: 'notion_create_page',
    description: 'Create a page in Notion database',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: { type: 'string' },
        title: { type: 'string' },
        properties: { type: 'string', description: 'JSON properties' }
      },
      required: ['databaseId', 'title']
    },
    handler: async (params) => {
      const props = params.properties ? JSON.parse(String(params.properties)) : {};
      props.Name = notion.propertyHelpers.title(String(params.title));
      const page = await notion.createPage(String(params.databaseId), props);
      return `Created: ${page.url}`;
    }
  }
];

// LinkedIn Tools
const linkedinTools: Tool[] = [
  {
    name: 'linkedin_profile',
    description: 'Get LinkedIn profile by URL',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url']
    },
    handler: async (params) => {
      const profile = await linkedin.getProfile(String(params.url));
      if (!profile) return 'Profile not found';
      return `${profile.firstName} ${profile.lastName}\n${profile.headline}\n${profile.location}\n${profile.currentCompany || ''} - ${profile.currentTitle || ''}`;
    }
  },
  {
    name: 'linkedin_search',
    description: 'Search LinkedIn people',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: { type: 'string' },
        company: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['keywords']
    },
    handler: async (params) => {
      const results = await linkedin.searchPeople(String(params.keywords), {
        currentCompany: params.company ? String(params.company) : undefined,
        title: params.title ? String(params.title) : undefined
      });
      return results.profiles.map(p => `${p.firstName} ${p.lastName} - ${p.headline}\n${p.profileUrl}`).join('\n\n') || 'No results';
    }
  }
];

// Perplexity Tools
const perplexityTools: Tool[] = [
  {
    name: 'perplexity_search',
    description: 'AI-powered web search via Perplexity',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        depth: { type: 'string', description: 'quick, standard, or deep' }
      },
      required: ['query']
    },
    handler: async (params) => {
      const result = await perplexity.research(String(params.query), {
        depth: (params.depth as 'quick' | 'standard' | 'deep') || 'standard'
      });
      return `${result.answer}\n\nSources:\n${result.citations.join('\n')}`;
    }
  },
  {
    name: 'perplexity_factcheck',
    description: 'Fact-check a claim',
    inputSchema: {
      type: 'object',
      properties: { claim: { type: 'string' } },
      required: ['claim']
    },
    handler: async (params) => {
      const result = await perplexity.factCheck(String(params.claim));
      return `Verdict: ${result.verdict}\n\n${result.explanation}\n\nSources:\n${result.citations.join('\n')}`;
    }
  }
];

// Telegram Tools
const telegramTools: Tool[] = [
  {
    name: 'telegram_send',
    description: 'Send Telegram message',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['text']
    },
    handler: async (params) => {
      if (params.chatId) {
        const msg = await telegram.sendMessage(String(params.chatId), String(params.text));
        return `Sent message ${msg.message_id}`;
      } else {
        const msg = await telegram.sendNotification(String(params.text));
        return `Sent notification ${msg.message_id}`;
      }
    }
  },
  {
    name: 'telegram_notify',
    description: 'Send notification to default chat',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    },
    handler: async (params) => {
      const msg = await telegram.sendNotification(String(params.text));
      return `Sent: ${msg.message_id}`;
    }
  }
];

// Slack Tools
const slackTools: Tool[] = [
  {
    name: 'slack_send',
    description: 'Send Slack message',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['text']
    },
    handler: async (params) => {
      if (params.channel) {
        const msg = await slack.sendMessage(String(params.channel), String(params.text));
        return `Sent: ${msg.ts}`;
      } else {
        const msg = await slack.sendNotification(String(params.text));
        return `Sent: ${msg.ts}`;
      }
    }
  },
  {
    name: 'slack_channels',
    description: 'List Slack channels',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const channels = await slack.listChannels();
      return channels.map(c => `#${c.name} (${c.id})`).join('\n') || 'No channels';
    }
  },
  {
    name: 'slack_history',
    description: 'Get channel history',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        limit: { type: 'number', default: 10 }
      },
      required: ['channel']
    },
    handler: async (params) => {
      const messages = await slack.getChannelHistory(String(params.channel), {
        limit: Number(params.limit || 10)
      });
      return messages.map(m => `${m.user}: ${m.text}`).join('\n') || 'No messages';
    }
  }
];

// Google Sheets Tools
const sheetsTools: Tool[] = [
  {
    name: 'sheets_read',
    description: 'Read data from Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string', description: 'A1 notation, e.g. Sheet1!A1:D10' }
      },
      required: ['spreadsheetId', 'range']
    },
    handler: async (params) => {
      const data = await sheets.getRange(String(params.spreadsheetId), String(params.range));
      return data.values.map(row => row.join('\t')).join('\n') || 'No data';
    }
  },
  {
    name: 'sheets_write',
    description: 'Write data to Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string' },
        values: { type: 'string', description: 'JSON 2D array' }
      },
      required: ['spreadsheetId', 'range', 'values']
    },
    handler: async (params) => {
      const values = JSON.parse(String(params.values));
      const result = await sheets.updateRange(String(params.spreadsheetId), String(params.range), values);
      return `Updated ${result.updatedCells} cells`;
    }
  },
  {
    name: 'sheets_append',
    description: 'Append rows to Google Sheets',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string' },
        range: { type: 'string' },
        values: { type: 'string', description: 'JSON 2D array' }
      },
      required: ['spreadsheetId', 'range', 'values']
    },
    handler: async (params) => {
      const values = JSON.parse(String(params.values));
      const result = await sheets.appendRows(String(params.spreadsheetId), String(params.range), values);
      return `Appended ${result.updatedRows} rows`;
    }
  }
];

// n8n Tools
const n8nTools: Tool[] = [
  {
    name: 'n8n_workflows',
    description: 'List n8n workflows',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const workflows = await n8n.listWorkflows();
      return workflows.map(w => `${w.name} (${w.id}) - ${w.active ? 'active' : 'inactive'}`).join('\n') || 'No workflows';
    }
  },
  {
    name: 'n8n_trigger',
    description: 'Trigger n8n webhook',
    inputSchema: {
      type: 'object',
      properties: {
        webhook: { type: 'string', description: 'Webhook path or ID' },
        data: { type: 'string', description: 'JSON data' }
      },
      required: ['webhook']
    },
    handler: async (params) => {
      const data = params.data ? JSON.parse(String(params.data)) : undefined;
      const result = await n8n.triggerWebhook(String(params.webhook), data);
      return result.success ? `Triggered: ${JSON.stringify(result.data)}` : `Failed: ${result.error}`;
    }
  },
  {
    name: 'n8n_executions',
    description: 'List recent n8n executions',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
        limit: { type: 'number', default: 10 }
      }
    },
    handler: async (params) => {
      const executions = await n8n.listExecutions({
        workflowId: params.workflowId ? String(params.workflowId) : undefined,
        limit: Number(params.limit || 10)
      });
      return executions.map(e => `${e.id} - ${e.status} (${e.startedAt})`).join('\n') || 'No executions';
    }
  }
];

// Google Docs Tools
const docsTools: Tool[] = [
  {
    name: 'docs_get',
    description: 'Get Google Doc content by ID',
    inputSchema: {
      type: 'object',
      properties: { documentId: { type: 'string' } },
      required: ['documentId']
    },
    handler: async (params) => {
      const doc = await docs.getDocument(String(params.documentId));
      return `Title: ${doc.title}\n\n${doc.content}`;
    }
  },
  {
    name: 'docs_create',
    description: 'Create a new Google Doc',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title']
    },
    handler: async (params) => {
      const doc = await docs.createDocument(String(params.title));
      return `Created: ${doc.title}\nURL: ${doc.url}`;
    }
  },
  {
    name: 'docs_append',
    description: 'Append text to Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        text: { type: 'string' }
      },
      required: ['documentId', 'text']
    },
    handler: async (params) => {
      await docs.appendText(String(params.documentId), String(params.text));
      return 'Text appended successfully';
    }
  },
  {
    name: 'docs_search',
    description: 'Search Google Docs',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number', default: 10 }
      },
      required: ['query']
    },
    handler: async (params) => {
      const results = await docs.searchDocuments(String(params.query), Number(params.maxResults || 10));
      return results.map(r => `${r.name}\n${r.url}`).join('\n\n') || 'No documents found';
    }
  },
  {
    name: 'docs_replace',
    description: 'Replace text in Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
        searchText: { type: 'string' },
        replaceText: { type: 'string' }
      },
      required: ['documentId', 'searchText', 'replaceText']
    },
    handler: async (params) => {
      const count = await docs.replaceText(
        String(params.documentId),
        String(params.searchText),
        String(params.replaceText)
      );
      return `Replaced ${count} occurrences`;
    }
  }
];

// NotebookLM Tools
const notebookTools: Tool[] = [
  {
    name: 'notebook_create',
    description: 'Create a research notebook',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['name']
    },
    handler: async (params) => {
      const nb = notebooklm.createNotebook(String(params.name), params.description ? String(params.description) : undefined);
      return `Created notebook: ${nb.name} (${nb.id})`;
    }
  },
  {
    name: 'notebook_list',
    description: 'List all notebooks',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const notebooks = notebooklm.listNotebooks();
      return notebooks.map(n => `${n.name} (${n.id}) - ${n.sources.length} sources`).join('\n') || 'No notebooks';
    }
  },
  {
    name: 'notebook_add_text',
    description: 'Add text source to notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['notebookId', 'title', 'content']
    },
    handler: async (params) => {
      const source = notebooklm.addTextSource(
        String(params.notebookId),
        String(params.title),
        String(params.content)
      );
      return source ? `Added source: ${source.title}` : 'Notebook not found';
    }
  },
  {
    name: 'notebook_add_url',
    description: 'Add URL source to notebook',
    inputSchema: {
      type: 'object',
      properties: {
        notebookId: { type: 'string' },
        title: { type: 'string' },
        url: { type: 'string' }
      },
      required: ['notebookId', 'title', 'url']
    },
    handler: async (params) => {
      const source = notebooklm.addUrlSource(
        String(params.notebookId),
        String(params.title),
        String(params.url)
      );
      return source ? `Added URL source: ${source.title}` : 'Notebook not found';
    }
  },
  {
    name: 'notebook_analyze',
    description: 'Generate analysis prompt from notebook sources',
    inputSchema: {
      type: 'object',
      properties: { notebookId: { type: 'string' } },
      required: ['notebookId']
    },
    handler: async (params) => {
      const prompt = notebooklm.generateAnalysisPrompt(String(params.notebookId));
      return prompt || 'Notebook not found';
    }
  },
  {
    name: 'notebook_export',
    description: 'Export notebook sources for NotebookLM import',
    inputSchema: {
      type: 'object',
      properties: { notebookId: { type: 'string' } },
      required: ['notebookId']
    },
    handler: async (params) => {
      const data = notebooklm.exportForNotebookLM(String(params.notebookId));
      return JSON.stringify(data, null, 2);
    }
  }
];

// Export all tools
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
