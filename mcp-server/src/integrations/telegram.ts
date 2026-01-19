/**
 * Telegram Integration
 * Send notifications, read channels, interact with bot
 */

import { httpRequest, HttpError } from '../utils/http.js';
import { getTelegramCredentials } from '../utils/credentials.js';

interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  from?: { id: number; first_name: string; last_name?: string; username?: string };
  chat: { id: number; type: string; title?: string; username?: string };
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  description?: string;
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

async function telegramRequest<T>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const credentials = getTelegramCredentials();
  if (!credentials) {
    throw new HttpError('Telegram not authenticated. Add bot_token to /root/.claude/secrets/telegram.json');
  }

  const response = await httpRequest<TelegramResponse<T>>({
    hostname: 'api.telegram.org',
    path: `/bot${credentials.bot_token}/${method}`,
    method: 'POST',
    body: params
  });

  if (!response.ok) {
    throw new HttpError(response.description || 'Telegram API error');
  }
  return response.result;
}

// Message sending

export async function sendMessage(
  chatId: string | number,
  text: string,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
    replyToMessageId?: number;
  } = {}
): Promise<TelegramMessage> {
  const params: Record<string, unknown> = { chat_id: chatId, text };
  if (options.parseMode) params.parse_mode = options.parseMode;
  if (options.disableNotification) params.disable_notification = true;
  if (options.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;

  return telegramRequest<TelegramMessage>('sendMessage', params);
}

export async function sendNotification(
  text: string,
  options: { silent?: boolean } = {}
): Promise<TelegramMessage> {
  const credentials = getTelegramCredentials();
  if (!credentials?.default_chat_id) {
    throw new HttpError('No default_chat_id configured');
  }

  return sendMessage(credentials.default_chat_id, text, {
    disableNotification: options.silent
  });
}

export async function sendDocument(
  chatId: string | number,
  filePath: string,
  caption?: string
): Promise<TelegramMessage> {
  const params: Record<string, unknown> = { chat_id: chatId, document: filePath };
  if (caption) params.caption = caption;
  return telegramRequest<TelegramMessage>('sendDocument', params);
}

export async function sendPhoto(
  chatId: string | number,
  photoUrl: string,
  caption?: string
): Promise<TelegramMessage> {
  const params: Record<string, unknown> = { chat_id: chatId, photo: photoUrl };
  if (caption) params.caption = caption;
  return telegramRequest<TelegramMessage>('sendPhoto', params);
}

// Message editing

export async function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
): Promise<TelegramMessage> {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text
  };
  if (parseMode) params.parse_mode = parseMode;
  return telegramRequest<TelegramMessage>('editMessageText', params);
}

export async function deleteMessage(chatId: string | number, messageId: number): Promise<boolean> {
  await telegramRequest<boolean>('deleteMessage', { chat_id: chatId, message_id: messageId });
  return true;
}

// Chat info

export async function getChat(chatId: string | number): Promise<TelegramChat> {
  return telegramRequest<TelegramChat>('getChat', { chat_id: chatId });
}

export async function getChatMemberCount(chatId: string | number): Promise<number> {
  return telegramRequest<number>('getChatMemberCount', { chat_id: chatId });
}

// Updates (polling)

export async function getUpdates(
  options: { offset?: number; limit?: number; timeout?: number } = {}
): Promise<Array<{ update_id: number; message?: TelegramMessage }>> {
  const params: Record<string, unknown> = {
    limit: options.limit || 10,
    timeout: options.timeout || 0
  };
  if (options.offset) params.offset = options.offset;

  return telegramRequest<Array<{ update_id: number; message?: TelegramMessage }>>('getUpdates', params);
}

// Bot info

export async function getMe(): Promise<{
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}> {
  return telegramRequest<{ id: number; is_bot: boolean; first_name: string; username: string }>('getMe');
}

// Inline keyboard

export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>>
): Promise<TelegramMessage> {
  return telegramRequest<TelegramMessage>('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { inline_keyboard: buttons }
  });
}

// Forward message

export async function forwardMessage(
  chatId: string | number,
  fromChatId: string | number,
  messageId: number
): Promise<TelegramMessage> {
  return telegramRequest<TelegramMessage>('forwardMessage', {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId
  });
}

// Pin message

export async function pinMessage(
  chatId: string | number,
  messageId: number,
  silent = false
): Promise<boolean> {
  await telegramRequest<boolean>('pinChatMessage', {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: silent
  });
  return true;
}

export function isAuthenticated(): boolean {
  return getTelegramCredentials() !== null;
}

export function getDefaultChatId(): string | undefined {
  return getTelegramCredentials()?.default_chat_id;
}

export function getAuthInstructions(): string {
  return `
Telegram Integration Setup:

1. Create a bot via @BotFather
2. Get your bot token
3. Get your chat ID (forward a message to @userinfobot)
4. Create /root/.claude/secrets/telegram.json:
   { "bot_token": "YOUR_BOT_TOKEN", "default_chat_id": "YOUR_CHAT_ID" }
`;
}
