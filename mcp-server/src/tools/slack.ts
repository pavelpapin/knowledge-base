/**
 * Slack tools
 */

import * as slack from '../integrations/slack.js';
import { Tool, paramString, paramNumber } from './types.js';

export const slackTools: Tool[] = [
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
      const text = paramString(params.text);
      if (params.channel) {
        const msg = await slack.sendMessage(paramString(params.channel), text);
        return `Sent: ${msg.ts}`;
      }
      const msg = await slack.sendNotification(text);
      return `Sent: ${msg.ts}`;
    }
  },
  {
    name: 'slack_channels',
    description: 'List Slack channels',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const channels = await slack.listChannels();
      if (!channels.length) return 'No channels';
      return channels.map(c => `#${c.name} (${c.id})`).join('\n');
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
      const messages = await slack.getChannelHistory(paramString(params.channel), {
        limit: paramNumber(params.limit, 10)
      });
      if (!messages.length) return 'No messages';
      return messages.map(m => `${m.user}: ${m.text}`).join('\n');
    }
  }
];
