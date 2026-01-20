/**
 * Schedule Tools
 * Tools for scheduled task management
 */

import { z } from 'zod';
import { AdapterTool } from '../../../gateway/types.js';
import { getDb } from '../../../db/index.js';
import { scheduledTasksSchema, createScheduleSchema, safeJsonParse } from '../schemas.js';

export const scheduleTools: AdapterTool[] = [
  {
    name: 'schedules_list',
    description: 'List scheduled tasks',
    type: 'read',
    schema: scheduledTasksSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof scheduledTasksSchema>;
      const tasks = p.enabledOnly
        ? await getDb().schedule.getEnabled()
        : await getDb().schedule.findAll();
      return JSON.stringify(tasks, null, 2);
    }
  },
  {
    name: 'schedules_due',
    description: 'Get tasks that are due to run now',
    type: 'read',
    schema: z.object({}),
    execute: async () => {
      const tasks = await getDb().schedule.getDue();
      return JSON.stringify(tasks, null, 2);
    }
  },
  {
    name: 'schedule_create',
    description: 'Create a new scheduled task',
    type: 'write',
    schema: createScheduleSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof createScheduleSchema>;
      const config = safeJsonParse(p.config, {}) as Record<string, unknown>;
      const task = await getDb().schedule.createSchedule(
        p.name,
        p.workflowName,
        p.frequency,
        config,
        p.cronExpression
      );
      return JSON.stringify(task, null, 2);
    }
  }
];
