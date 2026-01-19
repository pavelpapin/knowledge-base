/**
 * Telegram Integration
 * Send notifications, read channels, interact with bot
 */

import * as fs from 'fs';
import * as https from 'https';

const CREDENTIALS_PATH = '/root/.claude/secrets/telegram-credentials.json';

interface TelegramCredentials {
  bot_token: string;
  default_chat_id?: string;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  from?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  description?: string;
}

function loadCredentials(): TelegramCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

async function telegramRequest(
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Telegram not authenticated. Add bot_token to /root/.claude/secrets/telegram-credentials.json');
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);

    const options: https.RequestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${credentials.bot_token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) {
            reject(new Error(json.description || 'Telegram API error'));
          } else {
            resolve(json.result);
          }
        } catch {
          reject(new Error('Invalid response from Telegram'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
  const params: Record<string, unknown> = {
    chat_id: chatId,
    text
  };

  if (options.parseMode) params.parse_mode = options.parseMode;
  if (options.disableNotification) params.disable_notification = true;
  if (options.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;

  return telegramRequest('sendMessage', params) as Promise<TelegramMessage>;
}

export async function sendNotification(
  text: string,
  options: { silent?: boolean } = {}
): Promise<TelegramMessage> {
  const credentials = loadCredentials();
  if (!credentials?.default_chat_id) {
    throw new Error('No default_chat_id configured');
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
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Telegram not authenticated');
  }

  // For simplicity, we'll just send the file path as a message
  // Full implementation would use multipart/form-data
  const params: Record<string, unknown> = {
    chat_id: chatId,
    document: filePath
  };

  if (caption) params.caption = caption;

  return telegramRequest('sendDocument', params) as Promise<TelegramMessage>;
}

export async function sendPhoto(
  chatId: string | number,
  photoUrl: string,
  caption?: string
): Promise<TelegramMessage> {
  const params: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl
  };

  if (caption) params.caption = caption;

  return telegramRequest('sendPhoto', params) as Promise<TelegramMessage>;
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

  return telegramRequest('editMessageText', params) as Promise<TelegramMessage>;
}

export async function deleteMessage(
  chatId: string | number,
  messageId: number
): Promise<boolean> {
  await telegramRequest('deleteMessage', {
    chat_id: chatId,
    message_id: messageId
  });
  return true;
}

// Chat info

export async function getChat(chatId: string | number): Promise<TelegramChat> {
  return telegramRequest('getChat', { chat_id: chatId }) as Promise<TelegramChat>;
}

export async function getChatMemberCount(chatId: string | number): Promise<number> {
  return telegramRequest('getChatMemberCount', { chat_id: chatId }) as Promise<number>;
}

// Updates (polling)

export async function getUpdates(
  options: {
    offset?: number;
    limit?: number;
    timeout?: number;
  } = {}
): Promise<Array<{
  update_id: number;
  message?: TelegramMessage;
}>> {
  const params: Record<string, unknown> = {
    limit: options.limit || 10,
    timeout: options.timeout || 0
  };

  if (options.offset) params.offset = options.offset;

  return telegramRequest('getUpdates', params) as Promise<Array<{
    update_id: number;
    message?: TelegramMessage;
  }>>;
}

// Bot info

export async function getMe(): Promise<{
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}> {
  return telegramRequest('getMe') as Promise<{
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  }>;
}

// Inline keyboard

export async function sendMessageWithButtons(
  chatId: string | number,
  text: string,
  buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>>
): Promise<TelegramMessage> {
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: buttons
    }
  }) as Promise<TelegramMessage>;
}

// Forward message

export async function forwardMessage(
  chatId: string | number,
  fromChatId: string | number,
  messageId: number
): Promise<TelegramMessage> {
  return telegramRequest('forwardMessage', {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId
  }) as Promise<TelegramMessage>;
}

// Pin message

export async function pinMessage(
  chatId: string | number,
  messageId: number,
  silent = false
): Promise<boolean> {
  await telegramRequest('pinChatMessage', {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: silent
  });
  return true;
}

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getDefaultChatId(): string | undefined {
  return loadCredentials()?.default_chat_id;
}

export function getAuthInstructions(): string {
  return `
Telegram Integration Setup:

1. Create a bot via @BotFather
2. Get your bot token
3. Get your chat ID (forward a message to @userinfobot)
4. Create /root/.claude/secrets/telegram-credentials.json:
   {
     "bot_token": "YOUR_BOT_TOKEN",
     "default_chat_id": "YOUR_CHAT_ID"
   }
`;
}
