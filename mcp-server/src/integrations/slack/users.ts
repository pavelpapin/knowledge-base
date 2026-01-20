/**
 * Slack Users API
 */

import { slackRequest } from './client.js';
import { SlackUser, SlackMessage, SlackResponse } from './types.js';
import { sendMessage } from './messages.js';

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
