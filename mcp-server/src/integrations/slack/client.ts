/**
 * Slack Client
 * HTTP client for Slack API
 */

import { httpRequest, HttpError } from '../../utils/http.js';
import { getSlackCredentials, SlackCredentials } from '../../utils/credentials.js';
import { SlackResponse } from './types.js';

export async function slackRequest<T extends SlackResponse>(
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

export function isAuthenticated(): boolean {
  return getSlackCredentials() !== null;
}

export function getDefaultChannel(): string | undefined {
  return getSlackCredentials()?.default_channel;
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
