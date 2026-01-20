/**
 * Slack Adapter
 * Exposes Slack API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as slack from '../../integrations/slack/index.js';
import { getSlackCredentials } from '../../utils/credentials.js';

const sendSchema = z.object({
  text: z.string().describe('Message text'),
  channel: z.string().optional().describe('Channel ID or name')
});

const channelsSchema = z.object({});

const historySchema = z.object({
  channel: z.string().describe('Channel ID'),
  limit: z.number().optional().default(10).describe('Number of messages')
});

const tools: AdapterTool[] = [
  {
    name: 'send',
    description: 'Send Slack message',
    type: 'write',
    schema: sendSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof sendSchema>;
      const channel = p.channel || getSlackCredentials()?.default_channel;
      if (!channel) return JSON.stringify({ error: 'No channel provided' });
      const result = await slack.sendMessage(channel, p.text);
      return JSON.stringify(result);
    }
  },
  {
    name: 'channels',
    description: 'List Slack channels',
    type: 'read',
    schema: channelsSchema,
    execute: async () => {
      const channels = await slack.listChannels();
      return JSON.stringify(channels, null, 2);
    }
  },
  {
    name: 'history',
    description: 'Get channel history',
    type: 'read',
    schema: historySchema,
    execute: async (params) => {
      const p = params as z.infer<typeof historySchema>;
      const messages = await slack.getChannelHistory(p.channel, { limit: p.limit });
      return JSON.stringify(messages, null, 2);
    }
  }
];

export const slackAdapter: Adapter = {
  name: 'slack',
  isAuthenticated: slack.isAuthenticated,
  tools
};
