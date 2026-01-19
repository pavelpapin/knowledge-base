/**
 * Calendar tools
 */

import * as calendar from '../integrations/calendar.js';
import { Tool, paramString } from './types.js';

export const calendarTools: Tool[] = [
  {
    name: 'calendar_today',
    description: "Get today's events",
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const events = await calendar.getTodayEvents();
      if (!events.length) return 'No events today';
      return events.map(e => `${e.start} - ${e.end}: ${e.summary}`).join('\n');
    }
  },
  {
    name: 'calendar_week',
    description: "Get this week's events",
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const events = await calendar.getWeekEvents();
      if (!events.length) return 'No events this week';
      return events.map(e => `${e.start} - ${e.end}: ${e.summary}`).join('\n');
    }
  },
  {
    name: 'calendar_create',
    description: 'Create calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601' },
        end: { type: 'string', description: 'ISO 8601' },
        description: { type: 'string' },
        location: { type: 'string' }
      },
      required: ['summary', 'start', 'end']
    },
    handler: async (params) => {
      const result = await calendar.createEvent('primary', {
        summary: paramString(params.summary),
        start: paramString(params.start),
        end: paramString(params.end),
        description: params.description ? paramString(params.description) : undefined,
        location: params.location ? paramString(params.location) : undefined
      });
      return result.success
        ? `Created: ${result.htmlLink}`
        : `Failed: ${result.error}`;
    }
  }
];
