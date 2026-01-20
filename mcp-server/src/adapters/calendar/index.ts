/**
 * Calendar Adapter
 * Exposes Google Calendar API as MCP tools
 */

import { z } from 'zod';
import { Adapter, AdapterTool } from '../../gateway/types.js';
import * as calendar from '../../integrations/calendar/index.js';

const todaySchema = z.object({});

const weekSchema = z.object({});

const createSchema = z.object({
  summary: z.string().describe('Event title'),
  start: z.string().describe('Start time (ISO 8601)'),
  end: z.string().describe('End time (ISO 8601)'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location')
});

const tools: AdapterTool[] = [
  {
    name: 'today',
    description: "Get today's events",
    type: 'read',
    schema: todaySchema,
    execute: async () => {
      const events = await calendar.getTodayEvents();
      return JSON.stringify(events, null, 2);
    }
  },
  {
    name: 'week',
    description: "Get this week's events",
    type: 'read',
    schema: weekSchema,
    execute: async () => {
      const events = await calendar.getWeekEvents();
      return JSON.stringify(events, null, 2);
    }
  },
  {
    name: 'create',
    description: 'Create calendar event',
    type: 'write',
    schema: createSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createSchema>;
      const result = await calendar.createEvent('primary', p);
      return JSON.stringify(result);
    }
  }
];

export const calendarAdapter: Adapter = {
  name: 'calendar',
  isAuthenticated: calendar.isAuthenticated,
  tools
};
