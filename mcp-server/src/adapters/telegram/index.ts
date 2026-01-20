/**
 * Telegram Adapter
 * Exposes Telegram Bot API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as telegram from '../../integrations/telegram.js';

const sendSchema = z.object({
  text: z.string().describe('Message text'),
  chatId: z.string().optional().describe('Chat ID (uses default if not provided)')
});

const notifySchema = z.object({
  text: z.string().describe('Notification text')
});

const tools: AdapterTool[] = [
  {
    name: 'send',
    description: 'Send Telegram message',
    type: 'write',
    schema: sendSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof sendSchema>;
      const chatId = p.chatId || telegram.getDefaultChatId();
      if (!chatId) return 'Error: No chat ID provided';
      const result = await telegram.sendMessage(chatId, p.text);
      return JSON.stringify({ success: true, messageId: result.message_id });
    }
  },
  {
    name: 'notify',
    description: 'Send notification to default chat',
    type: 'write',
    schema: notifySchema,
    execute: async (params) => {
      const p = params as z.infer<typeof notifySchema>;
      const result = await telegram.sendNotification(p.text);
      return JSON.stringify({ success: true, messageId: result.message_id });
    }
  }
];

export const telegramAdapter: Adapter = {
  name: 'telegram',
  isAuthenticated: telegram.isAuthenticated,
  tools
};
