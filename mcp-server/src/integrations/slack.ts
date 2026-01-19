/**
 * Slack Integration
 * Send messages, read channels, manage workspace
 */

import * as fs from 'fs';
import * as https from 'https';

const CREDENTIALS_PATH = '/root/.claude/secrets/slack-credentials.json';

interface SlackCredentials {
  bot_token: string;          // xoxb-...
  user_token?: string;        // xoxp-... (for user actions)
  default_channel?: string;
}

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
  profile: {
    display_name: string;
    image_72?: string;
  };
}

function loadCredentials(): SlackCredentials | null {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

async function slackRequest(
  method: string,
  params: Record<string, unknown> = {},
  useUserToken = false
): Promise<unknown> {
  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Slack not authenticated');
  }

  const token = useUserToken ? credentials.user_token : credentials.bot_token;
  if (!token) {
    throw new Error(useUserToken ? 'User token not configured' : 'Bot token not configured');
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params);

    const options: https.RequestOptions = {
      hostname: 'slack.com',
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) {
            reject(new Error(json.error || 'Slack API error'));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error('Invalid response from Slack'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Messages

export async function sendMessage(
  channel: string,
  text: string,
  options: {
    threadTs?: string;
    blocks?: unknown[];
    unfurlLinks?: boolean;
  } = {}
): Promise<SlackMessage> {
  const params: Record<string, unknown> = {
    channel,
    text
  };

  if (options.threadTs) params.thread_ts = options.threadTs;
  if (options.blocks) params.blocks = options.blocks;
  if (options.unfurlLinks !== undefined) params.unfurl_links = options.unfurlLinks;

  const response = await slackRequest('chat.postMessage', params) as {
    ts: string;
    channel: string;
    message: { text: string };
  };

  return {
    ts: response.ts,
    text: response.message.text,
    channel: response.channel
  };
}

export async function sendNotification(text: string): Promise<SlackMessage> {
  const credentials = loadCredentials();
  if (!credentials?.default_channel) {
    throw new Error('No default_channel configured');
  }

  return sendMessage(credentials.default_channel, text);
}

export async function updateMessage(
  channel: string,
  ts: string,
  text: string
): Promise<SlackMessage> {
  const response = await slackRequest('chat.update', {
    channel,
    ts,
    text
  }) as { ts: string; channel: string; text: string };

  return {
    ts: response.ts,
    text: response.text,
    channel: response.channel
  };
}

export async function deleteMessage(channel: string, ts: string): Promise<boolean> {
  await slackRequest('chat.delete', { channel, ts });
  return true;
}

export async function addReaction(
  channel: string,
  ts: string,
  emoji: string
): Promise<boolean> {
  await slackRequest('reactions.add', {
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
  const response = await slackRequest('conversations.list', {
    exclude_archived: options.excludeArchived ?? true,
    limit: options.limit || 100,
    types: 'public_channel,private_channel'
  }) as { channels: SlackChannel[] };

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
  const response = await slackRequest('conversations.info', {
    channel: channelId
  }) as { channel: SlackChannel };

  return response.channel;
}

export async function getChannelHistory(
  channel: string,
  options: { limit?: number; oldest?: string; latest?: string } = {}
): Promise<SlackMessage[]> {
  const params: Record<string, unknown> = {
    channel,
    limit: options.limit || 20
  };

  if (options.oldest) params.oldest = options.oldest;
  if (options.latest) params.latest = options.latest;

  const response = await slackRequest('conversations.history', params) as {
    messages: Array<{
      ts: string;
      text: string;
      user?: string;
      thread_ts?: string;
    }>;
  };

  return response.messages.map(msg => ({
    ts: msg.ts,
    text: msg.text,
    user: msg.user,
    channel,
    thread_ts: msg.thread_ts
  }));
}

export async function joinChannel(channelId: string): Promise<boolean> {
  await slackRequest('conversations.join', { channel: channelId });
  return true;
}

// Users

export async function listUsers(): Promise<SlackUser[]> {
  const response = await slackRequest('users.list') as {
    members: SlackUser[];
  };

  return response.members.filter(u => !u.is_bot).map(u => ({
    id: u.id,
    name: u.name,
    real_name: u.real_name,
    email: u.profile?.display_name,
    is_bot: u.is_bot,
    profile: u.profile
  }));
}

export async function getUser(userId: string): Promise<SlackUser> {
  const response = await slackRequest('users.info', {
    user: userId
  }) as { user: SlackUser };

  return response.user;
}

export async function getUserByEmail(email: string): Promise<SlackUser | null> {
  try {
    const response = await slackRequest('users.lookupByEmail', {
      email
    }) as { user: SlackUser };

    return response.user;
  } catch {
    return null;
  }
}

// Direct messages

export async function openDM(userId: string): Promise<string> {
  const response = await slackRequest('conversations.open', {
    users: userId
  }) as { channel: { id: string } };

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
  const response = await slackRequest('search.messages', {
    query,
    count: options.count || 20
  }, true) as {
    messages: {
      matches: Array<{
        ts: string;
        text: string;
        user: string;
        channel: { id: string };
      }>;
    };
  };

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
  link: (url: string, text?: string) => text ? `<${url}|${text}>` : `<${url}>`,
  user: (userId: string) => `<@${userId}>`,
  channel: (channelId: string) => `<#${channelId}>`,
  emoji: (name: string) => `:${name}:`
};

export function isAuthenticated(): boolean {
  return loadCredentials() !== null;
}

export function getAuthInstructions(): string {
  return `
Slack Integration Setup:

1. Create a Slack App at https://api.slack.com/apps
2. Add Bot Token Scopes:
   - chat:write
   - channels:read
   - channels:history
   - users:read
   - reactions:write
3. Install app to workspace
4. Get Bot User OAuth Token (xoxb-...)
5. Create /root/.claude/secrets/slack-credentials.json:
   {
     "bot_token": "xoxb-YOUR_TOKEN",
     "default_channel": "C0123456789"
   }

Optional: Add user token for search functionality:
   {
     "bot_token": "xoxb-...",
     "user_token": "xoxp-...",
     "default_channel": "C0123456789"
   }
`;
}
