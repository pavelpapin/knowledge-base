/**
 * Slack Messages API
 */

import { slackRequest, getDefaultChannel } from './client.js';
import { SlackMessage, SlackResponse } from './types.js';
import { HttpError } from '../../utils/http.js';

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
  const defaultChannel = getDefaultChannel();
  if (!defaultChannel) {
    throw new HttpError('No default_channel configured');
  }
  return sendMessage(defaultChannel, text);
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
