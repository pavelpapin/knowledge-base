/**
 * Slack Integration
 * Send messages, read channels, manage workspace
 */

import { httpRequest, HttpError } from '../utils/http.js';
import { getSlackCredentials, SlackCredentials } from '../utils/credentials.js';

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  channel: string;
  thread_ts?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
}

interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  email?: string;
  is_bot: boolean;
  profile: { display_name: string; image_72?: string };
}

interface SlackResponse {
  ok: boolean;
  error?: string;
}

async function slackRequest<T extends SlackResponse>(
  method: string,
  params: Record<string, unknown> = {},
  useUserToken = false
): Promise<T> {
  const credentials = getSlackCredentials();
  if (!credentials) throw new HttpError('Slack not authenticated');

  const token = useUserToken
    ? (credentials as SlackCredentials & { user_token?: string }).user_token
    : credentials.bot_token;
  if (!token) {
    throw new HttpError(useUserToken ? 'User token not configured' : 'Bot token not configured');
  }

  const response = await httpRequest<T>({
    hostname: 'slack.com',
    path: `/api/${method}`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: params
  });

  if (!response.ok) {
    throw new HttpError(response.error || 'Slack API error');
  }
  return response;
}

// Messages

export async function sendMessage(
  channel: string,
  text: string,
  options: { threadTs?: string; blocks?: unknown[]; unfurlLinks?: boolean } = {}
): Promise<SlackMessage> {
  const params: Record<string, unknown> = { channel, text };
  if (options.threadTs) params.thread_ts = options.threadTs;
  if (options.blocks) params.blocks = options.blocks;
  if (options.unfurlLinks !== undefined) params.unfurl_links = options.unfurlLinks;

  const response = await slackRequest<SlackResponse & {
    ts: string;
    channel: string;
    message: { text: string };
  }>('chat.postMessage', params);

  return { ts: response.ts, text: response.message.text, channel: response.channel };
}

export async function sendNotification(text: string): Promise<SlackMessage> {
  const credentials = getSlackCredentials();
  if (!credentials?.default_channel) {
    throw new HttpError('No default_channel configured');
  }
  return sendMessage(credentials.default_channel, text);
}

export async function updateMessage(channel: string, ts: string, text: string): Promise<SlackMessage> {
  const response = await slackRequest<SlackResponse & {
    ts: string;
    channel: string;
    text: string;
  }>('chat.update', { channel, ts, text });

  return { ts: response.ts, text: response.text, channel: response.channel };
}

export async function deleteMessage(channel: string, ts: string): Promise<boolean> {
  await slackRequest<SlackResponse>('chat.delete', { channel, ts });
  return true;
}

export async function addReaction(channel: string, ts: string, emoji: string): Promise<boolean> {
  await slackRequest<SlackResponse>('reactions.add', {
    channel,
    timestamp: ts,
    name: emoji.replace(/:/g, '')
  });
  return true;
}

// Channels

export async function listChannels(
  options: { excludeArchived?: boolean; limit?: number } = {}
): Promise<SlackChannel[]> {
  const response = await slackRequest<SlackResponse & { channels: SlackChannel[] }>(
    'conversations.list',
    {
      exclude_archived: options.excludeArchived ?? true,
      limit: options.limit || 100,
      types: 'public_channel,private_channel'
    }
  );

  return response.channels.map(ch => ({
    id: ch.id,
    name: ch.name,
    is_private: ch.is_private,
    is_member: ch.is_member,
    topic: ch.topic,
    purpose: ch.purpose
  }));
}

export async function getChannel(channelId: string): Promise<SlackChannel> {
  const response = await slackRequest<SlackResponse & { channel: SlackChannel }>(
    'conversations.info',
    { channel: channelId }
  );
  return response.channel;
}

export async function getChannelHistory(
  channel: string,
  options: { limit?: number; oldest?: string; latest?: string } = {}
): Promise<SlackMessage[]> {
  const params: Record<string, unknown> = { channel, limit: options.limit || 20 };
  if (options.oldest) params.oldest = options.oldest;
  if (options.latest) params.latest = options.latest;

  const response = await slackRequest<SlackResponse & {
    messages: Array<{ ts: string; text: string; user?: string; thread_ts?: string }>;
  }>('conversations.history', params);

  return response.messages.map(msg => ({
    ts: msg.ts,
    text: msg.text,
    user: msg.user,
    channel,
    thread_ts: msg.thread_ts
  }));
}

export async function joinChannel(channelId: string): Promise<boolean> {
  await slackRequest<SlackResponse>('conversations.join', { channel: channelId });
  return true;
}

// Users

export async function listUsers(): Promise<SlackUser[]> {
  const response = await slackRequest<SlackResponse & { members: SlackUser[] }>('users.list');
  return response.members
    .filter(u => !u.is_bot)
    .map(u => ({
      id: u.id,
      name: u.name,
      real_name: u.real_name,
      email: u.profile?.display_name,
      is_bot: u.is_bot,
      profile: u.profile
    }));
}

export async function getUser(userId: string): Promise<SlackUser> {
  const response = await slackRequest<SlackResponse & { user: SlackUser }>(
    'users.info',
    { user: userId }
  );
  return response.user;
}

export async function getUserByEmail(email: string): Promise<SlackUser | null> {
  try {
    const response = await slackRequest<SlackResponse & { user: SlackUser }>(
      'users.lookupByEmail',
      { email }
    );
    return response.user;
  } catch {
    return null;
  }
}

// Direct messages

export async function openDM(userId: string): Promise<string> {
  const response = await slackRequest<SlackResponse & { channel: { id: string } }>(
    'conversations.open',
    { users: userId }
  );
  return response.channel.id;
}

export async function sendDM(userId: string, text: string): Promise<SlackMessage> {
  const channelId = await openDM(userId);
  return sendMessage(channelId, text);
}

// Search (requires user token)

export async function searchMessages(
  query: string,
  options: { count?: number } = {}
): Promise<SlackMessage[]> {
  const response = await slackRequest<SlackResponse & {
    messages: {
      matches: Array<{ ts: string; text: string; user: string; channel: { id: string } }>;
    };
  }>('search.messages', { query, count: options.count || 20 }, true);

  return response.messages.matches.map(msg => ({
    ts: msg.ts,
    text: msg.text,
    user: msg.user,
    channel: msg.channel.id
  }));
}

// Rich formatting helpers

export const formatters = {
  bold: (text: string) => `*${text}*`,
  italic: (text: string) => `_${text}_`,
  strike: (text: string) => `~${text}~`,
  code: (text: string) => `\`${text}\``,
  codeBlock: (text: string, lang = '') => `\`\`\`${lang}\n${text}\n\`\`\``,
  link: (url: string, text?: string) => (text ? `<${url}|${text}>` : `<${url}>`),
  user: (userId: string) => `<@${userId}>`,
  channel: (channelId: string) => `<#${channelId}>`,
  emoji: (name: string) => `:${name}:`
};

export function isAuthenticated(): boolean {
  return getSlackCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
Slack Integration Setup:

1. Create a Slack App at https://api.slack.com/apps
2. Add Bot Token Scopes: chat:write, channels:read, channels:history, users:read, reactions:write
3. Install app to workspace
4. Get Bot User OAuth Token (xoxb-...)
5. Create /root/.claude/secrets/slack.json:
   { "bot_token": "xoxb-YOUR_TOKEN", "default_channel": "C0123456789" }
`;
}
