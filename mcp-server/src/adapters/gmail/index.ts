/**
 * Gmail Adapter
 * Exposes Gmail API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import { listEmails, getEmail, sendEmail, isAuthenticated } from './api.js';

// Schemas
const listSchema = z.object({
  query: z.string().optional().describe('Search query'),
  maxResults: z.number().optional().default(10).describe('Maximum results')
});

const readSchema = z.object({
  messageId: z.string().describe('Email message ID')
});

const sendSchema = z.object({
  to: z.string().describe('Recipient email'),
  subject: z.string().describe('Email subject'),
  body: z.string().describe('Email body')
});

// Tools
const tools: AdapterTool[] = [
  {
    name: 'list',
    description: 'List recent emails or search inbox',
    type: 'read',
    schema: listSchema,
    execute: async (params) => {
      const { query, maxResults } = params as z.infer<typeof listSchema>;
      const emails = await listEmails(query || '', maxResults || 10);
      return JSON.stringify(emails, null, 2);
    }
  },
  {
    name: 'read',
    description: 'Read full email by ID',
    type: 'read',
    schema: readSchema,
    execute: async (params) => {
      const { messageId } = params as z.infer<typeof readSchema>;
      const email = await getEmail(messageId);
      if (!email) return 'Email not found';
      return JSON.stringify(email, null, 2);
    }
  },
  {
    name: 'send',
    description: 'Send an email',
    type: 'dangerous',  // Marked as dangerous - requires approval
    schema: sendSchema,
    execute: async (params) => {
      const { to, subject, body } = params as z.infer<typeof sendSchema>;
      const result = await sendEmail(to, subject, body);
      return JSON.stringify(result);
    }
  }
];

export const gmailAdapter: Adapter = {
  name: 'gmail',
  isAuthenticated,
  tools
};
