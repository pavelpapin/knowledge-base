/**
 * Slack Integration
 * Re-exports all Slack functionality
 */

export * from './types.js';
export { slackRequest, isAuthenticated, getAuthInstructions, getDefaultChannel } from './client.js';
export { sendMessage, sendNotification, updateMessage, deleteMessage, addReaction, searchMessages } from './messages.js';
export { listChannels, getChannel, getChannelHistory, joinChannel } from './channels.js';
export { listUsers, getUser, getUserByEmail, openDM, sendDM } from './users.js';

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
