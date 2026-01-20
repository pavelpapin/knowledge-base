/**
 * Slack Channels API
 */

import { slackRequest } from './client.js';
import { SlackChannel, SlackMessage, SlackResponse } from './types.js';

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
