/**
 * Slack Types
 */

export interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  channel: string;
  thread_ts?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  email?: string;
  is_bot: boolean;
  profile: { display_name: string; image_72?: string };
}

export interface SlackResponse {
  ok: boolean;
  error?: string;
}
