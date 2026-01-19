/**
 * Telegram tools
 */

import * as telegram from '../integrations/telegram.js';
import { Tool, paramString } from './types.js';

export const telegramTools: Tool[] = [
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
      const text = paramString(params.text);
      if (params.chatId) {
        const msg = await telegram.sendMessage(paramString(params.chatId), text);
        return `Sent message ${msg.message_id}`;
      }
      const msg = await telegram.sendNotification(text);
      return `Sent notification ${msg.message_id}`;
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
      const msg = await telegram.sendNotification(paramString(params.text));
      return `Sent: ${msg.message_id}`;
    }
  }
];
