/**
 * Task Tools
 * Tools for GTD task management
 */

import { z } from 'zod';
import { AdapterTool } from '../../../gateway/types.js';
import { getDb } from '../../../db/index.js';
import { taskSchema, taskListSchema } from '../schemas.js';

export const taskTools: AdapterTool[] = [
  {
    name: 'task_create',
    description: 'Create a new GTD task',
    type: 'write',
    schema: taskSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof taskSchema>;
      const task = await getDb().task.createTask(p.title, {
        priority: p.priority,
        project: p.project,
        due_date: p.dueDate
      });
      return JSON.stringify(task, null, 2);
    }
  },
  {
    name: 'task_stats',
    description: 'Get task statistics (inbox, next, waiting, etc)',
    type: 'read',
    schema: z.object({}),
    execute: async () => {
      const stats = await getDb().task.getStats();
      return JSON.stringify(stats, null, 2);
    }
  },
  {
    name: 'tasks_active',
    description: 'Get active tasks (not done, not someday)',
    type: 'read',
    schema: taskListSchema,
    execute: async (params) => {
      const p = params as z.infer<typeof taskListSchema>;
      const tasks = await getDb().task.getActive({ limit: p.limit });
      return JSON.stringify(tasks, null, 2);
    }
  }
];
