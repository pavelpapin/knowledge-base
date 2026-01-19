/**
 * Gmail tools
 */

import * as gmail from '../integrations/gmail.js';
import { Tool, paramString, paramNumber } from './types.js';

export const gmailTools: Tool[] = [
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
      const emails = await gmail.listEmails(
        paramString(params.query),
        paramNumber(params.maxResults, 10)
      );
      if (!emails.length) return 'No emails found';
      return emails
        .map(e => `${e.date} | ${e.from}\n  ${e.subject}\n  ${e.snippet}`)
        .join('\n\n');
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
      const email = await gmail.getEmail(paramString(params.messageId));
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
      const result = await gmail.sendEmail(
        paramString(params.to),
        paramString(params.subject),
        paramString(params.body)
      );
      return result.success
        ? `Sent: ${result.messageId}`
        : `Failed: ${result.error}`;
    }
  }
];
